# MIGRATION GUIDE 0.10.0

> 从 `main-ui@0.9.0` / `@main-ui/core@0.8.0` 升级到 `main-ui@0.10.0` / `@main-ui/core@0.9.0`。
> 本次为 **docking 结构性增量 + 模板增强 + 新模板** 版本。**没有破坏性变更**。

## 一、总览

| 层 | 改动 | 兼容性 |
| --- | --- | --- |
| `main-ui/core` | 新增 `FocusService` / `deriveFocus`（焦点事实源） | ✅ 只增 |
| `main-ui/core` | 新增 `ViewAuxiliaryContract` / `AuxiliaryItem` / `normalizeAuxiliaryModel` / `mergeAuxiliaryModels` | ✅ 只增 |
| `main-ui/core` | 新增 `listSlotBindings` / `findBindingsByInstance` / `findBindingsByViewType` / `checkInstanceQuota` | ✅ 只增 |
| `main-ui/core` | 新增 `createFiveZoneLayout` / `LAYOUT_TEMPLATES` | ✅ 只增 |
| `main-ui/core` | `MainUiViewLifecycle` 新增**可选** `onResize?(width, height)` | ✅ 只增（不实现则零影响） |
| `main-ui/core` | `WorkspaceState.auxiliary`（微件配置）+ `WorkbenchDocument.meta`（宿主透传） | ✅ 只增（全可选） |
| `main-ui/core` | 快照版本 **v3 → v4** | ⚠ 自动迁移（见 §二） |
| `main-ui/core` | keybinding 的 `when` 上下文新增 `focusedView` / `focusedViewType` | ✅ 只增 |
| `main-ui` | 新增 `EditorSurfaceResizeBoundary`（尺寸统一下发） | ✅ 只增 |
| `@main-ui/view-tree` | 多选：`multiSelect` / `selectedIds` prop，`selection-change` 事件 | ✅ 只增（默认关闭） |
| `@main-ui/view-table` | 多选 + 列宽拉伸：`multiSelect` / `selectedRowIds` / `resizableColumns` prop，`selection-change` / `column-resize-intent` 事件 | ✅ 只增（默认关闭） |
| `@main-ui/view-console` | `wrap` / `exportEnabled` / `autoScroll` prop，`export-intent` 事件 | ✅ 只增（`wrap`/`exportEnabled` 默认关闭） |
| `@main-ui/view-inspector` | `readonly` 字段类型 + schema 分组 | ✅ 只增 |
| `@main-ui/view-asset` | **新模板**：资产网格 / 列表 | ✅ 新增 |

## 二、快照版本 v3 → v4

v4 新增两个字段，**都是可选的**：

| 字段 | 缺省含义 |
| --- | --- |
| `WorkspaceState.auxiliary` | 「宿主未设置微件配置」→ 消费方使用默认显隐 |
| `WorkbenchDocument.meta` | 「宿主没有元数据」 |

因此迁移只是把 `version` 标为 4，**数据结构原样保留**。这一点是刻意的：若补一堆空对象，就再也分不清「宿主从未设置过」与「宿主显式设为空」。

**宿主需要做什么**：不需要做任何事。旧快照读取后自动升为 v4，布局不变。

## 三、新能力用法

### 3.1 焦点服务

```ts
runtime.getFocus()                                  // { viewInstanceId, viewType, groupId, tabId, ... }
runtime.onFocusChange((next, previous) => { /* 跨视图联动 */ })
```

焦点**由布局派生**（`deriveFocus(document)` 纯函数），不自持状态 —— 因此「布局关了页签但焦点还指着它」在结构上不可能发生。

**keybinding 的 `when` 已并入同一焦点源**，可写：

```ts
runtime.registerKeybinding({
  commandId: 'world.reset',
  keybinding: 'F5',
  when: "focusedViewType == 'view-world'",
})
```

### 3.2 实例独占校验

宿主此前只能靠「打开前猜」实现「某类视图整窗只有一个」。现在可查证：

```ts
const result = runtime.checkInstanceQuota('view-world', 1)
if (result.status === 'duplicated') {
  focusExisting(result.existing[0].viewInstanceId)   // 改为聚焦已有的那个
}
```

### 3.3 视图尺寸回调

```ts
const lifecycle: MainUiViewLifecycle = {
  // ...四成员
  onResize(width, height) { renderer.resize(width, height) },
}
```

不实现就完全不变。**不要**再自挂 `ResizeObserver` —— 尺寸由 `EditorSurfaceResizeBoundary` 统一观察并下发（content box），自挂会造出 N 个观察器，且首次尺寸与布局计算存在竞态。

### 3.4 五区布局模板

```ts
const layout = createFiveZoneLayout({ weights: { top: 0.1, bottom: 0.2 } })
```

生成的是普通 `LayoutDocument`，装配后与手工拖出来的布局完全等价。

### 3.5 局部微件

视图想让工具栏出现一个按钮时，**不要再让宿主写死**，也**不要 import 菜单/工具栏组件**：

```ts
const aux: ViewAuxiliaryContract = {
  getAuxiliaryItems: () => ({
    toolbar: [{ id: 'zoom-in', commandId: 'world.zoomIn', label: '放大' }],
  }),
}
```

条目一律绑 `commandId`（唯一行为入口），不带回调。

### 3.6 新模板 `@main-ui/view-asset`

```bash
pnpm add @main-ui/view-asset
```

```ts
import { registerAssetViewEditor } from '@main-ui/view-asset'

registerAssetViewEditor(
  runtime,
  { allowedWorkspaceIds: ['my-workspace'], title: 'Assets' },
  (context) => ({ items: store.getAssets(context.editor.id), loading: store.isLoading(context.editor.id) }),
  (context) => ({ onSelect: (payload) => store.select(context.editor.id, payload.id) }),
)
```

**缩略图由宿主注入**（`thumbnailUrl` + `thumbnailState` 三态），模板零网络、不重试。

## 四、包版本矩阵

| 包 | 0.9.0 | 0.10.0 | 说明 |
| --- | --- | --- | --- |
| `main-ui` | 0.9.0 | **0.10.0** | 纯增量 |
| `@main-ui/core` | 0.8.0 | **0.9.0** | 焦点服务 / 微件 / 绑定查询 / 五区布局 / `onResize` / 快照 v4 |
| `@main-ui/view-tree` | 0.3.0 | **0.4.0** | 多选 |
| `@main-ui/view-table` | 0.3.0 | **0.4.0** | 多选 + 列宽拉伸 |
| `@main-ui/view-console` | 0.4.0 | **0.5.0** | 换行 / 导出 / `autoScroll` |
| `@main-ui/view-inspector` | 0.4.0 | **0.5.0** | `readonly` 字段 + 分组 |
| `@main-ui/view-asset` | — | **0.1.0** | 新模板 |
| `@main-ui/preset-views` | 0.9.0 | **0.10.0** | 纳入 `asset` 命名空间 |
| 其余模板包 | — | 不变 | 无 API 变化 |

## 五、升级检查清单

```
[ ] 旧布局快照能正常读取（自动升 v4，布局不变）
[ ] 若用过「整套 view 类型只能开一个」的宿主侧记账，改为 checkInstanceQuota
[ ] 若有视图自挂 ResizeObserver，改为实现 onResize（可选但推荐）
[ ] 若 keybinding 的 when 里用字符串拼过「当前视图」，改用 focusedViewType
[ ] 若启用了多选/换行/列宽拉伸等新开关，确认事件消费已接上
[ ] 若接入 view-asset，确认缩略图 URL 与三态状态由宿主提供（模板不取图）
```
