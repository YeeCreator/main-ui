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

## 2026-03-10

### 阶段 A：基础设施改造

- 新增：`tokens/` 设计令牌层，统一颜色、间距、圆角、阴影、层级。
- 新增：`adapters/` 适配层，定义 `DataTableAdapter`、`TreeAdapter`、`FormAdapter` 契约及注册机制。
- 改造：`tsup` 多入口构建与 `package.json` 子路径导出（`layout/data/form/navigation/tokens/adapters`）。

### 阶段 B：组件迁移

- 迁移：`Sidebar` 内部 `select/radio/segmented` 控件替换为 Radix 原语实现。
- 新增：`DataTablePanel`（TanStack Table 语义壳层）。
- 新增：`TreePanel`（react-arborist 语义壳层）。
- 新增：`InspectorFormPanel`（react-hook-form + zod 语义壳层）。
- 新增：`adapters` 对应库的轻封装实现（tanstack/arborist/rhf-zod）。

### 阶段 C：稳定化与文档

- 文档：补充 `README.md`、`docs/DEVELOPER_GUIDE.md`、`docs/USER_MANUAL.md` 的分层入口说明与示例。
- 示例：补充“游戏配置条目管理”与“笔记目录树 + 属性编辑”两类组合示例。
- 验证：`pnpm typecheck` 与 `pnpm build` 均通过。

### 阶段 C 追加：计划尾项补齐（2026-03-10）

- 新增：`CommandPalette`（`cmdk` 语义壳层）与 `main-ui-react/command` 子入口。
- 改造：`tsup` 与 `package.json exports` 同步增加 `command` 多入口产物与导出。
- 文档：补充“根入口迁移清单”，明确从扁平导入到分层导入的映射关系。
- 工具：新增 `pnpm analyze:dist`（`scripts/report-dist-size.mjs`）用于输出 dist 体积排行。
