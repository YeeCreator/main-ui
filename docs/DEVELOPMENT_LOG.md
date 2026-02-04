# 开发日志（Development Log）

> 记录每一次功能新增/改动/修复的摘要，便于回溯。

## 2026-02-02

### 初始化 main-ui-react（通用主界面布局包）

- 新增：`MatchFrame` / `Toolbar` / `Sidebar` 的最小可用实现。
  - `MatchFrame`：提供顶部工具条 + 左右侧边栏 + 中央内容区的布局骨架。
  - `Toolbar`：提供 left/center/right 插槽。
  - `Sidebar`：基于 `SidebarModel` schema 渲染可复用侧栏。
- 关键约定：`SidebarSection.id` 必须唯一，用于 React key，避免同名 section 导致的渲染异常。

### 开发联调：file 依赖 + dist/watch

- 约定：本包对外只导出 `dist/`（见 `main`/`types`/`exports`）。
- 工作流：
  - 推荐：`pnpm dev`（tsup --watch）持续产出 `dist/`，供消费者项目运行时刷新获取。
  - 备选：`pnpm build` 后在消费者项目执行一次 `pnpm install` 刷新 file 依赖。

## 2026-02-04

- 修复：`MatchFrame` 中心区域的 flex 策略调整为 `flex: 1 1 auto`（并设置 `minWidth: 0`），避免中心内容过宽时把右侧栏挤出视口导致“右侧栏看似未加载”。
- 增强：为 `MatchFrame` 新增 `layout` 参数，支持按需配置：
  - `heightMode: 'viewport' | 'parent'`
  - `leftSidebar/rightSidebar` 的 `width` 与 `scroll` 选项
- 约定：宿主项目如有主界面外壳定制需求，应优先通过 `layout` 参数驱动，不在宿主侧硬编码布局规则。
