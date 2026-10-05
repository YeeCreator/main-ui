# packages/

main-ui monorepo 的包目录（v0.2 起）。

| 目录 | 包名 | 状态 | 说明 |
| --- | --- | --- | --- |
| `main-ui/` | `main-ui` | 已实现 | 核心工作台库（包名与导出面保持 0.1.x 不变） |
| `core/` | `@main-ui/core` | 已实现 | 框架无关表单基座；渲染基础设施（`core/rendering`）与图元系统（`core/primitives`） |
| `view-world/` | `@main-ui/view-world` | 已实现 | 世界视口视图（L1 视口层） |
| `view-*` | `@main-ui/view-*` | 已实现 | 官方视图模板，一模板一包 |
| `preset-views/` | `@main-ui/preset-views` | 已实现 | 模板聚合包 |

预视口能力层（原 `@main-ui/viewport-2d-kit` / `@main-ui/viewport-3d-kit`）已于 1.0.0 移除，相机数学、约束与交互迁入 `@main-ui/core/rendering`，Vue 视口组件迁入 `@main-ui/view-world`。
