# 使用说明（main-ui-react）

`main-ui-react` 是一个 UI 组件包，不是完整应用。

你可以把它当作一个“对局/画布类页面”的布局积木：

- 顶部工具条（Toolbar）
- 左/右侧边栏（Sidebars）
- 中央内容区（center，通常放棋盘/地图/画布/viewport）

当前版本还提供：

- 数据条目管理面板（`DataTablePanel`）
- 目录树面板（`TreePanel`）
- 属性编辑面板（`InspectorFormPanel`）
- 命令面板（`CommandPalette`）

## 快速上手

### 1) 组合一个标准页面

- 用 `MatchFrame` 放置整体结构
- 用 `Toolbar` 放置顶部按钮/状态
- 用 `Sidebar` 渲染左右侧栏

如需更完整能力，可结合：

- `TreePanel` 作为左侧资源/目录树
- `DataTablePanel` 作为中间条目列表
- `InspectorFormPanel` 作为右侧属性编辑
- `CommandPalette` 作为命令检索与快速操作入口

### 2) 侧边栏内容

侧边栏推荐使用 `SidebarModel` 来表达“分区 + 控件 + 操作”。

注意：

- `sections[].id` 必须唯一。

## 常见问题

### 为什么我的侧边栏有时会出现渲染错乱？

很大概率是 React key 问题：

- 请确保 `SidebarSection.id` 唯一且稳定。

### 如何控制包体？

优先使用子路径导入，而不是根入口整包导入：

- `main-ui-react/layout`
- `main-ui-react/data`
- `main-ui-react/navigation`
- `main-ui-react/form`
- `main-ui-react/command`

## 迁移建议

如果你历史上从根入口导入所有组件，建议分步迁移到子路径入口：

1. 先把布局组件迁移到 `main-ui-react/layout`。
2. 再按需迁移 `data/navigation/form/command`。
3. 最后将 `tokens/adapters` 也改成子路径导入。
