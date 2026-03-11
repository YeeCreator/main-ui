# 用户手册（main-ui-react）

`main-ui-react` 是一个面向工作台类应用的 React 主界面组件库。它的职责是提供稳定的主壳层，而不是提供具体的视口渲染能力。

适合的典型场景包括：

1. 资源编辑器。
2. 2D 画布编辑器。
3. 3D 工具软件的外围工作台。
4. 笔记、绘图、流程、配置管理等需要“左树 + 中央视口 + 右属性”布局的应用。

## 核心认识

使用 `main-ui-react` 时，请先记住两个边界：

1. 本库负责主界面壳层：顶部工具条、左右侧栏、中央宿主区、底部状态栏。
2. 本库不负责视口引擎本体。Konva、Three.js、X6、地图引擎或自研渲染器应由宿主项目自行接入。

## 你能得到什么

当前版本提供以下能力：

1. `MatchFrame`：完整工作台布局容器。
2. `ActivityRail`：左侧活动轨道。
3. `EditorTabs`：中心区顶部编辑器标签栏。
4. `Toolbar`：顶部工具条。
5. `BottomPanel`：中心区底部多标签面板。
6. `StatusBar`：底部状态栏。
7. `ViewportHost`：中间视口嵌入宿主容器。
8. `Sidebar`：基于 `SidebarModel` 的通用侧栏。
9. `Panel`：通用面板容器。
10. `TreePanel`：目录树与资源树语义壳层。
11. `DataTablePanel`：数据表格语义壳层。
12. `InspectorFormPanel`：属性编辑语义壳层。
13. `CommandPalette`：命令检索与执行面板。

## 预设风格

当前布局层支持三种主界面风格预设：

1. `default`：通用浅色工作台风格。
2. `vscodium`：更接近 VS Code / VSCodium 的深色工作台风格。
3. `konva`：偏画布工具台的暖色风格。

这里的 `vscodium` 和 `konva` 都是“风格预设”概念，不代表库内部直接依赖它们的产品本体。

## 最常见的接入方式

### 方式一：作为完整主壳层使用

最常见的组合是：

1. 顶部使用 `Toolbar`。
2. 最左侧使用 `ActivityRail`。
3. 左侧使用 `TreePanel` 或 `Sidebar`。
4. 中心上方使用 `EditorTabs`。
5. 中间使用 `ViewportHost`。
6. 中心下方使用 `BottomPanel`。
7. 右侧使用 `InspectorFormPanel` 或 `Panel`。
8. 底部使用 `StatusBar`。

### 方式二：只使用布局层

如果宿主已经有自己的树、表格、表单和命令系统，也可以只使用：

1. `MatchFrame`
2. `Toolbar`
3. `StatusBar`
4. `ViewportHost`
5. `Panel`

## 外部视口如何接入

推荐流程如下：

1. 用 `ViewportHost` 作为中心区域容器。
2. 在 `useEffect` 中通过 `ref` 拿到宿主 DOM。
3. 在该 DOM 上初始化外部视口实例。
4. 在组件卸载时销毁视口实例。

这样可以把视口逻辑完全留在宿主项目中，而 `main-ui-react` 只负责工作台外壳。

## 推荐导入方式

建议优先使用子路径入口，而不是根入口整包导入。

推荐入口如下：

1. `main-ui-react/layout`
2. `main-ui-react/data`
3. `main-ui-react/navigation`
4. `main-ui-react/form`
5. `main-ui-react/command`
6. `main-ui-react/tokens`
7. `main-ui-react/adapters`

## 示例索引

仓库已补充以下示例代码，可直接参考：

1. [docs/demos/VSCodiumWorkspaceDemo.tsx](docs/demos/VSCodiumWorkspaceDemo.tsx)
2. [docs/demos/KonvaWorkspaceDemo.tsx](docs/demos/KonvaWorkspaceDemo.tsx)
3. [docs/demos/EmbeddedViewportHostDemo.tsx](docs/demos/EmbeddedViewportHostDemo.tsx)

## 本地预览

如果你想直接在本仓库预览三套 preset 效果，可以运行：

1. `pnpm install`
2. `pnpm demo:dev`

默认会启动一个本地 demo 宿主，你可以在浏览器中切换：

1. `VSCodium 预设`
2. `Konva 预设`
3. `纯嵌入宿主`

当前 demo 已改为懒加载，首次进入页面只会加载当前激活示例，对比之前更适合继续扩展更多 demo 场景。

同时，demo 构建已加入手动 chunk 策略，会把 React、表单相关依赖、树组件依赖、Radix 依赖等公共部分拆成独立 chunk，便于继续观察不同示例的体积构成。

## 常见问题

### 1. 为什么我切换成 `vscodium` 预设后，视口没有自动变成 VS Code 编辑器？

因为 `preset` 只控制主壳层视觉，不控制中间视口的内容与渲染逻辑。

### 2. 为什么我切换成 `konva` 预设后，没有自动获得 Konva 画布？

同样因为 `preset` 只代表风格。Konva 视口仍需宿主项目自己挂载到 `ViewportHost`。

### 3. 为什么我的 `Sidebar` 内容更新后顺序错乱？

请确保 `SidebarSection.id` 稳定且唯一，不要用标题文案代替 ID。

### 4. 我是否必须使用 `TreePanel`、`DataTablePanel` 和 `InspectorFormPanel`？

不是必须。它们只是语义壳层，你可以换成宿主自己的实现。

### 5. 我是否必须使用深色主题？

不是必须。当前默认预设就是浅色工作台风格。

## 迁移建议

如果你当前历史代码大量从根入口导入，建议按下面顺序迁移：

1. 先把布局组件改为 `main-ui-react/layout`。
2. 再把树、表格、表单、命令面板迁移到各自子入口。
3. 最后把设计令牌和适配器也拆到 `tokens` 与 `adapters` 子入口。
