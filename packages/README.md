# packages/

main-ui monorepo 的包目录（v0.2 起）。

| 目录 | 包名 | 状态 | 说明 |
| --- | --- | --- | --- |
| `main-ui/` | `main-ui` | 已实现 | 核心工作台库（包名与导出面保持 0.1.x 不变） |
| `core/` | `@main-ui/core` | 已实现 | 框架无关表单基座；渲染基础设施（`core/rendering`）与图元系统（`core/primitives`） |
| `view-world/` | `@main-ui/view-world` | 已实现 | 世界视口视图（L1 视口层）。二维与三维两档共用同一模板 |
| `view-*` | `@main-ui/view-*` | 已实现 | 官方视图模板，一模板一包 |
| `render-3d/` | `@main-ui/render-3d` | 已实现 | 三维渲染后端（three.js，`WebGPURenderer` + TSL）。**无 editorKind**，只实现 `ViewportBackend` |
| `preset-views/` | `@main-ui/preset-views` | 已实现 | 模板聚合包 |

## 命名 lane（两条，判据可机械校验）

| 前缀 | 含义 | 判据 |
| --- | --- | --- |
| `view-*` | **视图模板** | 有 editorKind、可注册为编辑器、实现 `MainUiViewLifecycle`、有 `getViewState` |
| `render-*` | **渲染后端** | **无** editorKind、不可注册为编辑器、只实现 `ViewportBackend`；被模板解析，不被宿主直接挂载 |

维度是**后端属性**，不是包名属性。因此不设 `view-3d`：三维能力是 `@main-ui/render-3d` 接入 `view-world` 的一个后端，宿主用 `dimension` 一个开关在两档间切换（组件实例不销毁、相机态连续）。

**模板与后端不是同一个包**：`view-world` 不 import 任何渲染库，二维档缺省后端在 `@main-ui/core/rendering` 内实现（pixi 为 optional peer），三维档由宿主注入 `@main-ui/render-3d`。

## 历史映射（防混读）

| 旧名 | 现位置 | 说明 |
| --- | --- | --- |
| `@main-ui/view-2d` | `@main-ui/view-world`（手动模式） | `view-2d` 已删除并入 `view-world`；**`view-world ≠ view-2d`**，前者是唯一世界视口模板 |
| `@main-ui/viewport-2d-kit` | `@main-ui/core/rendering` | 2026-09 移除，相机数学/约束/交互内化进 core |
| `@main-ui/viewport-3d-kit` | `@main-ui/render-3d` | 2026-09-05 删除后坑空一年多；本次以**可插拔后端**形态回归，不是独立模板包 |
