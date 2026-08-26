# packages/

main-ui monorepo 的包目录（v0.2 起）。

| 目录 | 包名 | 状态 | 说明 |
| --- | --- | --- | --- |
| `main-ui/` | `main-ui` | 已实现 | 核心工作台库（包名与导出面保持 0.1.x 不变） |
| `viewport-2d-kit/` | `@main-ui/viewport-2d-kit` | 已迁入 | 2D 视口能力层（PixiJS 内核） |
| `viewport-3d-kit/` | `@main-ui/viewport-3d-kit` | 已迁入 | 3D 视口能力层（Three.js 内核，React 层为兼容层） |
| `view-*` | `@main-ui/view-*` | 预留 | 官方视图模板，一模板一包（v0.3 起交付一期） |
| `preset-views/` | `@main-ui/preset-views` | 预留 | 模板聚合包（v0.3 起） |
| `theme/` | `@main-ui/theme` | 预留 | 高级主题独立包（远期） |

预留位本版本不实现，仅为 monorepo 结构占位说明。
