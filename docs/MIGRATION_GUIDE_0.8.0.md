# MIGRATION GUIDE 0.8.0

> 从 `main-ui@0.7.0` / `@main-ui/core@0.6.0` 升级到 `main-ui@0.8.0` / `@main-ui/core@0.7.0`。
> `@main-ui/view-canvas` 同步至 `0.8.0`（消费 core 新子路径，世代号对齐）。

## 应用面（Surface）—— 纯增量，无破坏

`main-ui/vue` 新增三个导出，**不影响任何既有 API**：

```ts
import {
  createSurfaceStack,
  useSurfaceStack,
  SurfaceHost,
  SurfaceShell,
  type SurfaceDescriptor,
  type SurfacePayload,
} from 'main-ui/vue'
```

### 何时该用

宿主有「顶层整屏切换」需求（`menu → list → detail → settings` 之类）时用 `<SurfaceHost>`，
**不要**在 `App.vue` 里堆 `AppMode` + `v-if` 链。

### 何时不该用

| 情形 | 用什么 |
| --- | --- |
| 数据/任务一起换了、整窗替换 | **Surface** |
| 只是可用工具/面板换了、内容不变 | **Workspace** |
| 只是摆放位置不同 | **Layout Snapshot** |
| 编辑器内部 tab 级切换（外壳恒定） | 编辑器自己的状态机，**不要**上升为 Surface |

最后一条尤其重要：若某状态机在编辑器内部切换、外层 `.app-shell` 的 header/nav 恒不变，
它**不满足**「整窗替换」与「不进 Docking 树」两条判据。

### 迁移示例

改造前（约 250 行）：

```vue
<script setup lang="ts">
type AppMode = 'menu' | 'games' | 'designer' | 'play'
const mode = ref<AppMode>('menu')
// ... 大量 v-if 分支与返回逻辑
</script>
```

改造后（约 35 行）：

```vue
<script setup lang="ts">
const surfaces: SurfaceDescriptor[] = [
  { id: 'hall',     title: '主菜单', component: HallSurface, root: true },
  { id: 'gallery',  title: '列表',   component: GallerySurface },
  { id: 'content',  title: '内容',   component: ContentSurface },
  { id: 'designer', title: '编辑器', component: DesignerSurface },
]
</script>

<template>
  <SurfaceHost :surfaces="surfaces" initial="hall" />
</template>
```

面内部跳转：`const { open, back } = useSurfaceStack(); open('content', { itemId })`。

### 单屏宿主

不 import 即零影响，**无需改代码、无需升版本**。画布型宿主 / 多资料管理型宿主 / 治理型宿主 /
场景编辑型宿主 / 画廊型宿主 / 工作流型宿主 均属此类。

## 一句话结论

旧的 `registerKeybinding({ commandId, keybinding: 'Ctrl+X' })` 继续可用，语义完全不变（macOS 上 `Ctrl` 仍是 ⌘）。联合国项目组内的六家下游已在本世代内**全部改为新 API**，同时旧写法保留给未来接入者。

## 一、破坏面清单

| 已移除 | 位置 | 替代 |
| --- | --- | --- |
| `KeybindingRegistry` | `main-ui/core` | `runtime.input`（`@main-ui/core/input` 的 `createInputRouter` + 主包 `InputController`） |
| `KeybindingDescriptor` | `main-ui/core` | `Binding`（`@main-ui/core/input`） |
| `ParsedKeybinding` / `KeyModifier` | `main-ui/core` | `GesturePattern` / `BindingChord` |
| `parseKeybinding` | `main-ui/core` | `parseBinding`（`@main-ui/core/input`） |
| `normalizeKeybinding` | `main-ui/core` | `normalizeBinding` |
| `eventToKeybinding` | `main-ui/core` | `createDomInputSource` 产出的 `InputSignal` |
| `detectPlatform` | `main-ui/core` | `currentPlatform()` / `detectEnvironment().platform` |
| `runtime.core.unregisterKeybinding(commandId, keybinding)` | `main-ui/core` | `runtime.input.unregister(idOrCommandId)` |
| `KeyboardShortcutAdapter` | `main-ui/adapters` | `runtime.input` |

`evaluateWhen` **没有移除**，只是改由 `@main-ui/core/input` 提供；`main-ui/core` 继续再导出，贡献系统无需改动。

## 二、旧写法仍可用（保留给新接入者）

```ts
runtime.core.registerKeybinding({ commandId: 'demo.open', keybinding: 'Ctrl+Shift+P' })
runtime.core.registerKeybinding({ commandId: 'demo.run', keybinding: 'Cmd+R', allowInInput: false })
runtime.core.registerKeybinding({ commandId: 'demo.del', keybinding: 'Delete' })
```

这是**解析层语法糖**：字符串键位被解析为 `press:<key>` 草稿，`Ctrl` 在 macOS 上仍映射为 ⌘。

## 二之二、现有下游的迁移结果

六家下游共 11 处调用点已全部改为新 API（`draftFromText` + `runtime.input.register`）：

| 仓库 | 处数 | 文件 |
| --- | --- | --- |
| 画布型宿主 | 5 | `src/core/workbench.ts` |
| 对局宿主 | 4 | `src/main-ui/createMatchesRuntime.ts` |
| 场景编辑型宿主 | 1 | `src/studioRuntime.ts`（循环内） |
| 画廊型宿主 | 1 | `src/runtime/createGalleryRuntime.ts` |
| 多资料管理型宿主 | 0 | 无调用点 |
| 工作流型宿主 | 0 | 无调用点 |

写法对照：

```ts
// 旧
runtime.core.registerKeybinding({ commandId: 'a', keybinding: 'Ctrl+Shift+K' })
// 新
runtime.core.input.register({ commandId: 'a', ...draftFromText('cmd+shift+press:KeyK') })
```

注意 `Ctrl+,` 需写为 `press:Comma`（逗号的物理键位），`Ctrl+Enter` 为 `press:Enter`。

## 三、要用新能力时怎么写

```ts
import { draftFromText } from '@main-ui/core/input'

// 长按（旧体系无法表达）
runtime.input.register({ commandId: 'demo.hold', ...draftFromText('hold:Space:250') })

// 序列（旧体系无法表达）
runtime.input.register({ commandId: 'demo.goto', ...draftFromText('press:KeyG then press:KeyG') })

// 鼠标拖拽（旧体系无法表达）
runtime.input.register({ commandId: 'demo.erase', ...draftFromText('alt+drag:0:x:8') })

// 触控板捏合
runtime.input.register({ commandId: 'demo.zoom', ...draftFromText('cmd+pinch:out') })

// 完整绑定（需要作用域与流式语义时）
runtime.input.register({
  id: 'host:demo.pan:0',
  commandId: 'demo.pan',
  origin: 'host',
  ...draftFromText('drag:1:4'),
  mode: 'stream',
  scope: 'canvas',
})
```

## 四、行为变更（须知悉）

| 项 | 0.7.0 | 0.8.0 |
| --- | --- | --- |
| 命令面板 / Quick Open | 组件内硬编码 `⌘P` / `⌘⇧P`，不可改绑 | 注册为默认绑定，可在 `ShortcutEditor` 中改绑或解绑 |
| 叠加层 `Escape` | `OverlayLayer` 内硬编码键名 | 命令 `main-ui.overlay.dismiss` + 默认绑定（`when: 'overlayActive'`），可改绑 |
| 叠加层 `Tab` 焦点陷阱 | 硬编码 | **保持不变**（可访问性保障，不应可改绑） |
| 绑定冲突 | 仅能查询 | `diagnose()` 区分 `conflict` / `unreachable` / `modifier-press` / `unavailable` / `stream-unsafe` / `input-shadowed`，前两者阻断保存 |
| 焦点在输入框内 | `allowInInput` 控制 | 同上，但由 `runtime.input.setInInput()` 统一上报 |

## 五、依赖声明

版本对齐（`workspace:` 协议在本地工作区里不校验版本范围，但声明应如实反映代次）：

| 包 | 旧声明 | 新声明 |
| --- | --- | --- |
| `main-ui` | `workspace:^0.7.0` | `workspace:^0.8.0` |
| `@main-ui/core` | `workspace:^0.6.0` | `workspace:^0.7.0` |

`@main-ui/core` 新增子路径 `./input`，无需额外安装。

## 六、升级检查清单

```
[ ] grep 确认没有直接使用 KeybindingRegistry / parseKeybinding / eventToKeybinding
[ ] grep 确认没有使用 unregisterKeybinding 的两参数形式
[ ] grep 确认没有使用 KeyboardShortcutAdapter
[ ] 跑一次 typecheck
[ ] 若注册了自定义 `data-main-ui-scope`，确认 focus scope 语义未变
[ ] 若有自定义 `Escape` 处理，确认与新默认绑定不冲突（诊断会提示 conflict）
[ ] grep `registerKeybinding`：若仍存在，可保留（语法糖）或改为 `input.register`
```

## 七、内部依赖注意

`main-ui` 自 0.8.0 起把 `@main-ui/core` 声明为 **peerDependency** 并在 tsup 中 `external`。若你的宿主曾依赖「`main-ui` 自带一份 core」这一事实，需显式安装 `@main-ui/core`。不显式安装会让打包产出两份 core 副本，导致绑定对象互不相等这类难查问题。
