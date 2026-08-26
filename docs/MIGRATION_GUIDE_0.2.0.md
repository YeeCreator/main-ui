# main-ui 0.2.0 migration guide

`0.2.0` 是「契约先行 + 工程底座」版本：仓库转 pnpm workspace monorepo，公开 API 只增不改，持久化格式不变。宿主升级零破坏，可按需消费新契约。

## 仓库结构变更

- 仓库根转 pnpm workspace，主包源码迁入 `packages/main-ui/`；**包名保持 `main-ui`，导出面（`main-ui/core`、`main-ui/vue`、`main-ui/adapters`、`main-ui/tokens`、`main-ui/styles.css`）与产物结构不变**。
- `viewport-2d-kit` 迁入 `packages/viewport-2d-kit`，包名改 `@main-ui/viewport-2d-kit`（入口面不变：core / pixi / vue / main-ui / react-legacy）。
- `viewport-3d-kit` 迁入 `packages/viewport-3d-kit`，包名改 `@main-ui/viewport-3d-kit`（React 依赖转 optional，React 层为兼容层、非主线）。
- 安装路径：`pnpm add ../main-ui/main-ui-0.2.0.tgz`；源码联调仍可指向仓库根（workspace 自动解析主包）。

## 行为增强（无需迁移，注意感知）

1. **快照降级占位**：布局快照中引用了未注册的视图类型时，不再丢弃节点，而是渲染「视图不可用（类型缺失）」占位表面（保留原标题，可关闭）；类型重新注册后按原 `restoreKey` 恢复。
2. **Tab 溢出收纳**：组内页签超宽时提供左右滚动按钮与溢出下拉菜单；活动页签自动滚动可见。
3. **主题根属性**：`WorkbenchShell` 根元素新增 `data-mui-theme`（`light` / `dark` / `high-contrast`）；`--main-ui-*` 变量与 `main-ui-theme--*` 类名继续兼容，但新代码应消费 `--mui-*` 令牌（见 DEVELOPER_GUIDE「主题变量规范」）。

## 新增可选契约（opt-in）

- `runtime.core.slots`（`SlotRegistry`）：类型化插槽管理；`resolve(viewType)` 返回显式 `registered` / `missing`。`registerEditor` 自动叠加登记，宿主无需改动。
- `runtime.core.registerSlot(descriptor)`：纯视图插槽登记入口（模板库/插件消费）。
- `MainUiViewLifecycle` + `runtime.core.viewLifecycles`：视图内部状态收集/恢复契约，自愿实现；完整串联在 v0.3。
- `DockingViewContribution` / `PluginContributes`：插件契约纯类型预埋，无运行时调度。

## 必须检查

- 升级本地包后运行 `pnpm typecheck`、宿主测试与 demo smoke test。
- 若宿主自绘样式依赖旧的硬编码主题色值，建议改为消费 `--mui-*` 变量（旧变量名仍可用，无强制）。
- 若宿主依赖 demo 端口（4173），注意已改为 **4183**。

## 迁移成本

零破坏：公开 API、`rendererKey` 契约、`WorkbenchDocument` schema 均只增不改；结构变更仅影响从仓库源码直接引用的路径。
