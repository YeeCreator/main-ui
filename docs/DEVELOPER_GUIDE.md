# 开发者指南（main-ui-react）

> 本文档用于说明 `main-ui-react` 的定位、边界与本地开发联调方式。

## 1. 项目定位

`main-ui-react` 是一个可复用的“主界面布局骨架”（UI Skeleton），常见用于对局类应用或需要“中央画布/地图 + 侧栏 + 顶栏”的应用。

它只负责**布局与侧栏渲染**，不负责内容区里的游戏/地图逻辑。

## 2. 包边界（重要）

- ✅ 只做 UI：`MatchFrame` / `Toolbar` / `Sidebar`
- ✅ 只依赖 `react`（以 peerDependency 形式声明，避免多个 React 实例）
- ❌ 不依赖 viewport-kit
- ❌ 不依赖 p5
- ❌ 不包含游戏规则、AI、命令总线（cmdBus）等业务逻辑

## 3. 组件与数据模型

### 3.1 MatchFrame

提供三栏布局：

- 顶部：`toolbar`（可选）
- 左侧：`leftSidebar`（可选）
- 中间：`center`（必填）
- 右侧：`rightSidebar`（可选）

### 3.2 Toolbar

插槽式工具条：

- `left`
- `center`
- `right`

### 3.3 Sidebar / SidebarModel

`Sidebar` 基于 `SidebarModel` 渲染。

关键约束：

- `SidebarSection.id` 必须唯一、稳定（作为 React key）。
- 不要使用 `title` 作为 key（避免同名 section 引发渲染异常）。

## 4. 开发与构建

### 4.1 常用命令

- 安装：`pnpm install`
- 监听构建：`pnpm dev`（tsup --watch，持续输出到 dist/）
- 构建：`pnpm build`
- 类型检查：`pnpm typecheck`

### 4.2 被其他项目以 file 依赖引用时（重要）

本包对外只导出 `dist/`，因此：

- 修改 `src/**` 后，需要让 `dist/` 更新，使用者项目才会感知。

推荐方式：

1. 在本项目运行 `pnpm dev`（watch）
2. 在使用者项目运行 dev server

备选方式（不想开 watcher）：

1. 在本项目运行 `pnpm build`
2. 在使用者项目运行一次 `pnpm install` 刷新 file 依赖
