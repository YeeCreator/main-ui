# main-ui-react

一个可复用的“主界面布局骨架”（UI Skeleton），适用于需要以下结构的应用：

- 顶部工具条
- 左/右侧边栏
- 中央内容区（棋盘/地图/画布/视口）

本包刻意保持“纯 UI、无业务”的边界：

- 不依赖 viewport-kit
- 不依赖 p5
- 不包含任何游戏逻辑

## 核心概念

- `MatchFrame`：顶部工具条 + 左右侧边栏 + 中央内容区 的布局容器。
- `Toolbar`：插槽式工具条（`left` / `center` / `right`）。
- `Sidebar`：基于 `SidebarModel` 渲染侧边栏（分区、控件、按钮、可复制字段等）。

## 本地开发（作为 `file:` 依赖被其他项目引用时）

本包对外**只导出** `dist/`（见 `main` / `types` / `exports`），因此：

- 使用者项目只有在 `dist/` 更新后，才会看到改动。

推荐工作流：

- 在本仓库运行 `pnpm dev`（tsup --watch），保持 `dist/` 持续更新。
- 在使用者项目运行其 dev server，需要时刷新页面即可看到变更。

备选工作流：

- 在本仓库运行 `pnpm build` 生成最新 `dist/`。
- 在使用者项目运行 `pnpm install`（某些 package manager 在 Windows + file 依赖场景下需要刷新链接/类型）。
