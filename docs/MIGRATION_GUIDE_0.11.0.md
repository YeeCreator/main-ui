# MIGRATION GUIDE 0.11.0

> 从 `main-ui@0.10.0` / `@main-ui/core@0.9.0` 升级到 `main-ui@0.11.0` / `@main-ui/core@0.10.0`。
> 本次集中修复**视口契约的介质歧义**，并把通用相机手势收回模板。

## 一、总览

| 层 | 改动 | 兼容性 |
| --- | --- | --- |
| `@main-ui/core/rendering` | 新增 `cameraToSvgTransform` / `CssTransform` / `SvgTransform` 品牌类型 | ✅ 只增 |
| `@main-ui/core/rendering` | `cameraToCssTransform` 返回类型改为 `CssTransform`（仍是 `string` 子类型） | ✅ 兼容 |
| `@main-ui/core/rendering` | 新增 `cameraToCssStyle`（返回含 `transformOrigin` 的样式对象） | ✅ 只增 |
| `@main-ui/core/rendering` | `classifyWheelIntent` 改为委托 `readWheel`（判型不再独立） | ⚠ 行为变更，见 §三 |
| `@main-ui/core/rendering` | `wheelPanDelta` 移除第二参数 `speed` | ⚠ 破坏性，见 §四 |
| `@main-ui/core/input` | 新增 `readWheel` 三维读数 + `detectWheelDevice` + `zoomFactorOf` | ✅ 只增 |
| `@main-ui/core/input` | 新增 `camera-gestures`：`isSpacePanGesture` / `isMiddleButton` / `isShiftWheel` / `shiftWheelPanDelta` / `isTypingTarget` / `createSpaceKeyState` | ✅ 只增 |
| `@main-ui/view-canvas` | 插槽新增 `svgTransform` / `cssTransform`；`cameraTransform` 标废弃 | ⚠ 弃用，见 §二 |
| `@main-ui/view-canvas` | 新增 props：`panOnMiddleDrag` / `panOnSpaceDrag` / `panOnShiftWheel`（默认全开） | ✅ 只增（默认行为增强） |
| `@main-ui/view-canvas` | **停止转发** `@main-ui/core/input` 与 `core/rendering` 的符号 | ⚠ 破坏性，见 §五 |
| `@main-ui/view-canvas` | 样式变量改用 `--mui-color-*` 真源（`--main-ui-*` 保留为兜底） | ✅ 兼容 |
| `@main-ui/view-sandbox` | `SandboxCamera` 改为 `Camera2D`；相机接进渲染 | ⚠ 破坏性，见 §六 |
| `@main-ui/view-sandbox` | 新增 `normalizeSandboxCamera`（迁移旧快照） | ✅ 只增 |
| `@main-ui/view-node` | 新增 `nodeViewportToCamera` / `cameraToNodeViewport`；补 `@main-ui/core` peer | ✅ 只增 |
| `@main-ui/view-flow` | 新增 `normalizeFlowViewport` / `flowViewportToCamera` / `cameraToFlowViewport` | ✅ 只增 |
| `main-ui/vue` | `SettingsEditor` 新增 `showAppearance` prop，内置外观（主题模式）区块 | ✅ 只增（默认开启） |
| `main-ui/core` | 新增 `resolveThemeMode` / `THEME_MODES` / `isSystemThemeMode` / `matchAppearance` | ✅ 只增 |
| `main-ui/vue` | 新增 `useThemeMode`（含 `setThemeMode`）与 `createSetThemeModeAction` | ✅ 只增 |
| `main-ui` 样式 | 补齐设置页四组 class 的样式 | ✅ 只增（此前无样式） |

## 二、`view-canvas` 插槽：一个裸名拆成两个分介质的值

**旧**：`cameraTransform: string` —— SVG 语法（无单位），但名字不说它属于哪种介质。

**症状**（真实发生过）：把它绑到 DOM 的 `style.transform` 上，浏览器判定为**非法值并静默丢弃整条声明**。表现为：

- 相机状态每帧都在变，画面一格不动；
- 拖拽位移被放大 `1/scale` 倍（世界层没被缩放，而位移按 `÷scale` 换算）。

排查方向会被全部引向事件层，而事件层是对的。

**新**：两个值各带介质。

```diff
  <template #default="{ width, height, cameraTransform }">
-   <g :transform="cameraTransform">…</g>
+   <g :transform="svgTransform">…</g>
  </template>
```

```diff
+ <div :style="{ transform: cssTransform, transformOrigin: '0 0' }">…</div>
```

| 用途 | 用哪个 |
| --- | --- |
| SVG 元素的 `transform` **属性** | `svgTransform` |
| 元素的 `style.transform` | `cssTransform`（或在模板外调 `cameraToCssStyle(camera)`） |

`cameraTransform` 保留 **1 个 minor**，值为 `svgTransform` 的别名，带 `@deprecated` 标注。

### 为什么加品牌类型而不只是改名

两者底层都是 `string`。只改名时，把 `svgTransform` 赋给 `style` 仍然通过类型检查 —— 缺陷原样复发。
品牌类型（`string & { readonly __media: 'svg' | 'css' }`）使跨介质赋值在 `tsc` 阶段失败。

## 三、`classifyWheelIntent` 判型统一（行为变更）

**旧**：只看 `ctrlKey`，与 `core/input` 的 `classifyWheel`（含事件流密度与设备判定）各自实现。

后果：**同一个鼠标在两个模板上表现不同** —— 行模式滚轮（`deltaMode ≠ 0`）在 `view-canvas` 判缩放、在 `view-world` 判平移。

**新**：`classifyWheelIntent` 委托 `readWheel`。只传 `ctrlKey` 时按原退化规则；给全 `deltaX`/`deltaY`/`deltaMode` 时走完整设备判定。

**宿主需要做什么**：若此前因该差异写了绕行分支，可删除。

## 四、`wheelPanDelta` 移除 `speed` 参数（破坏性）

```diff
- wheelPanDelta({ deltaX, deltaY }, 2)
+ (() => { const d = wheelPanDelta({ deltaX, deltaY }); return { x: d.x * 2, y: d.y * 2 } })()
```

理由：同一概念曾有两份实现（`core/input` 一份、`core/rendering/interactions` 一份，参数不同）。灵敏度现在是两个明确层次：

| 层次 | 归属 | 用途 |
| --- | --- | --- |
| **设备档**（触控板 / 鼠标） | `core/input` 的 `zoomFactorOf` | 由 `readWheel` 的 `device` 自动选择，**不要手工判断** |
| **控制器级** | `createViewportInteractions` 的 `wheelPanSpeed` | 单个控制器实例的可调项 |

## 五、`view-canvas` 停止转发 core 符号（破坏性）

原先 `view-canvas` 转发了 `classifyWheel` / `wheelZoomFactor` / `WHEEL_ZOOM_SPEED` 等 6 个符号。这使同一个值有**三条取得路径**，契约变更时无法用类型闸门收敛。

改从真源引入：

```diff
- import { classifyWheel, wheelZoomFactor, WHEEL_ZOOM_SPEED } from '@main-ui/view-canvas'
+ import { classifyWheel, wheelZoomFactor, WHEEL_ZOOM_SPEED } from '@main-ui/core/input'
```

`view-canvas` 自身的 API（`ViewportCanvas` / `ViewportCanvasShell` / `buildHostBridge` / `fitCamera` / `panCamera` / `zoomByFactor` / `constrainScale` / `ZOOM_STEP`）不受影响。

## 六、`view-sandbox`：相机改为 `Camera2D`（破坏性）

```diff
- const camera: SandboxCamera = { x: 0, y: 0, zoom: 1 }
+ const camera: Camera2D = { scale: 1, pan: { x: 0, y: 0 } }
```

`SandboxCamera` 现在是 `Camera2D` 的别名。字段映射：`zoom` ↔ `scale`，`x/y` ↔ `pan.x/y`。

**持久化快照无需手工迁移**：`fromJSON` 内部经 `normalizeSandboxCamera` 自动识别旧形状。若宿主持有旧格式 JSON 并自行解析，请改调 `normalizeSandboxCamera(raw)`。

**同时修复**：相机此前是「只写不读」的死状态（渲染侧从未消费），现接入渲染 —— 拖拽平移与滚轮缩放开始生效。

## 七、通用相机手势：改用模板内置

以下三个手势此前需要宿主自建（`view-canvas` 未内置）：

| 手势 | 新 prop | 默认 |
| --- | --- | --- |
| 中键拖拽平移 | `panOnMiddleDrag` | `true` |
| 空格 + 左键拖拽平移 | `panOnSpaceDrag` | `true` |
| Shift + 滚轮横向平移 | `panOnShiftWheel` | `true` |

**宿主应删除自建实现**。与既有 prop 的关系：

| prop | 语义 |
| --- | --- |
| `disablePan` | **全部平移的总开关**（含新增三档） |
| 左键直拖 | 恒生效（`disablePan` 为 false 时）；空格按住时改由「空格+左键」接管 |

空格在输入控件内不触发（不打断打字）；窗口失焦自动清空空格状态。

**如需自行判定**（非模板宿主，如自建视口），`@main-ui/core/input` 提供纯函数：
`isSpacePanGesture` / `isMiddleButton` / `isShiftWheel` / `shiftWheelPanDelta` / `isTypingTarget` / `createSpaceKeyState`。

> **Shift+滚轮的平台差异**：macOS 与其他平台对 `deltaX` / `deltaY` 的填充不一致。
> `shiftWheelPanDelta` 只负责「给定一个量 → 屏幕位移」，取哪个量由调用方决定。
> 模板当前取 `deltaY`，**该取值须真机核对**。

## 八、相机表示：内部唯一 + 边界别名

| 类别 | 形态 | 处置 |
| --- | --- | --- |
| 内部可计算表示 | `Camera2D` | **唯一** |
| 同形持久化别名 | `WorldCameraState` | 允许（防响应式 Proxy 泄入快照） |
| 外部契约形状 | `NodeViewport` / `FlowViewport` / `SandboxCamera` | 保留原形 + 显式已测的桥 |
| 三维表示 | `OrbitCamera` | 与 `Camera2D` 双向桥，翻转单点在 core |

**不追求"全部退化成一种形状"**：`NodeViewport` / `FlowViewport` 的形状就是 `@vue-flow/core` 的契约，改形会引入每次调用的来回转换与第三处真相源。

## 九、设置页：内置外观区块，宿主删除自建副本

**旧状**：`SettingsEditor` 只渲染宿主注册的 schema 项，**4 个 class 完全没有样式**（裸 HTML）。于是宿主各自包一层带样式的设置面板，主题下拉也各画一遍。

后果：同一份 101 行的主题设置组件在多个宿主仓里**逐字节相同**；官方设置页形同虚设。

**新状**：

1. `SettingsEditor` 内置「外观 → 主题模式（浅色 / 深色 / 跟随系统）」区块；
2. 四组 class（`main-ui-settings-editor` / `__toolbar` / `__list`、`main-ui-setting-row`）已有样式；
3. 外观区块参与同一套搜索与分类筛选（分类名「外观」）。

**宿主应删除自建的主题设置面板**，直接渲染官方组件：

```diff
- import ThemeSettingsPanel from './editors/ThemeSettingsPanel.vue'
+ import { SettingsEditor } from 'main-ui/vue'

  <MainUiProvider :runtime="runtime">
-   <ThemeSettingsPanel />
+   <SettingsEditor />
  </MainUiProvider>
```

**主题切换必须走 `theme/setMode`**，且**必须同时给出 `resolvedMode`**。两种写法：

```ts
// A. 组件内（MainUiProvider 子树中）
import { useThemeMode } from 'main-ui/vue'
const { themeMode, setThemeMode } = useThemeMode()
setThemeMode('system')

// B. Provider 之外（启动初始化 / 命令 / 普通函数）
import { createSetThemeModeAction } from 'main-ui/vue'
void runtime.core.dispatch(createSetThemeModeAction('system'))
```

❗**不要自行拼 action**：

```ts
// 错：reducer 按「非 dark 即 light」兜底 ⇒ system 被解析成 light，不跟随系统
dispatch({ type: 'theme/setMode', mode: 'system' })
```

该错误无报错、无告警，症状仅为「选了跟随系统却没反应」。实测有多处宿主如此写。

`showAppearance: false` 可关掉内置区块（**不建议** —— 除非宿主确有自建主题 UI 且同样走 `theme/setMode`）。

## 十、升级检查清单

```
[ ] view-canvas 插槽：cameraTransform → svgTransform / cssTransform
[ ] 若有自建 CSS 变换串：删除，改用 cssTransform 或 cameraToCssStyle(camera)
[ ] 若有自建相机手势：删除，改用模板 props 或 core/input 纯函数
[ ] 若从 view-canvas 导入过 classifyWheel / WHEEL_ZOOM_SPEED 等：改从 @main-ui/core/input
[ ] 若调用 wheelPanDelta 并传第二参数：改为自行乘系数
[ ] 若使用 view-sandbox 且持久化过相机：确认 normalizeSandboxCamera 已覆盖读取路径
[ ] 若有绕开「行模式滚轮判型不一致」的临时分支：删除
[ ] 若有自建的主题设置面板：删除，改用官方 SettingsEditor（见 §九）
[ ] 若自行发过 theme/setMode：改用 useThemeMode / createSetThemeModeAction（否则 system 不跟随系统）
[ ] 跑一遍 build + 单测，基线不降
```
