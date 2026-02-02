# 使用说明（main-ui-react）

`main-ui-react` 是一个 UI 组件包，不是完整应用。

你可以把它当作一个“对局/画布类页面”的布局积木：

- 顶部工具条（Toolbar）
- 左/右侧边栏（Sidebars）
- 中央内容区（center，通常放棋盘/地图/画布/viewport）

## 快速上手

### 1) 组合一个标准页面

- 用 `MatchFrame` 放置整体结构
- 用 `Toolbar` 放置顶部按钮/状态
- 用 `Sidebar` 渲染左右侧栏

### 2) 侧边栏内容

侧边栏推荐使用 `SidebarModel` 来表达“分区 + 控件 + 操作”。

注意：

- `sections[].id` 必须唯一。

## 常见问题

### 为什么我的侧边栏有时会出现渲染错乱？

很大概率是 React key 问题：

- 请确保 `SidebarSection.id` 唯一且稳定。
