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

## 2026-03-11

### 工作台主壳层第二轮完善

- 新增：`StatusBar`，用于承接底部状态区语义。
- 新增：`ViewportHost`，用于承接外部视口工具包的嵌入挂载位。
- 扩展：`MatchFrame` 新增 `statusbar` 插槽与 `preset` 属性。
- 扩展：`Toolbar` 新增 `preset` 与 `translucent` 属性。
- 扩展：`tokens` 新增 `LayoutPreset`、`LayoutPresetStyles` 与 `getLayoutPresetStyles()`。

### 预设体系落地

- 新增三种主界面风格预设：
  - `default`
  - `vscodium`
  - `konva`
- 调整：`Sidebar` 与 `Panel` 已接入完整的 `preset` 联动，覆盖文本、边框、控件、分组块与背景。
- 结论：`vscodium` 与 `konva` 在本仓库中被正式定义为“工作台视觉预设”，而不是第三方产品本体依赖。

### 示例与文档同步

- 新增示例：
  - [docs/demos/VSCodiumWorkspaceDemo.tsx](docs/demos/VSCodiumWorkspaceDemo.tsx)
  - [docs/demos/KonvaWorkspaceDemo.tsx](docs/demos/KonvaWorkspaceDemo.tsx)
  - [docs/demos/EmbeddedViewportHostDemo.tsx](docs/demos/EmbeddedViewportHostDemo.tsx)
- 重写：`docs/USER_MANUAL.md`
- 重写：`docs/DEVELOPER_GUIDE.md`
- 新增：`docs/API_MANUAL.md`
- 更新：`docs/DEVELOPMENT_LOG.md`

### 验证

- 验证命令：`pnpm typecheck`
- 结果：通过。

### 2026-03-11 追加：演示分包与 Activity Rail

- 新增：`ActivityRail` 左侧活动轨道组件。
- 扩展：`MatchFrame` 新增 `activityRail` 插槽。
- 更新：`VSCodiumWorkspaceDemo` 接入 `ActivityRail`，工作台结构更接近 VS Code / VSCodium。
- 优化：本地 demo 宿主改为 `React.lazy + Suspense` 懒加载三个示例，降低首屏单包体积。
- 新增：任务记录 [task-main-ui-react-radix-table-arborist-20260311-003.md](../.github/docs/tasks/task-main-ui-react-radix-table-arborist-20260311-003.md)

### 2026-03-11 追加：编辑器标签区、底部 Panel 与细粒度分包

- 新增：`EditorTabs`，用于承接中心区顶部编辑器标签栏语义。
- 新增：`BottomPanel`，用于承接中心区底部“问题 / 输出 / 终端”式多标签区域。
- 扩展：`MatchFrame` 新增 `editorTabs` 与 `bottomPanel` 插槽，中心区现在可表达更完整的编辑器工作台结构。
- 更新：`VSCodiumWorkspaceDemo` 接入编辑器标签栏与底部 Panel，工作台结构进一步接近 VS Code / VSCodium。
- 优化：`demo/vite.config.ts` 新增手动 `manualChunks` 策略，已将 React、Radix、表单相关依赖、树依赖拆成独立共享 chunk。
- 新增：任务记录 [task-main-ui-react-radix-table-arborist-20260311-005.md](../.github/docs/tasks/task-main-ui-react-radix-table-arborist-20260311-005.md)
