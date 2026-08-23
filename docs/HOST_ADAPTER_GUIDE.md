# HOST_ADAPTER_GUIDE

## 当前版本

当前适配基线为 `main-ui 0.0.2`。外部 mount adapter、rendererKey 和宿主 editor 契约保持兼容；下游可通过 `main-ui-0.0.2.tgz` 做隔离升级验证。

本文说明 `main-ui` 如何作为通用工作台内核接入首批宿主：`autodo-app`、`matheshop`、`yeegames`。这些内容是适配草案，不迁移宿主业务代码。

## 1. 通用接入模型

宿主应用只需要提供四类注册信息：

1. `WorkspaceDescriptor`：声明工作区、默认布局、允许打开的 editor kind。
2. `EditorDescriptor`：声明 editor kind、rendererKey、payload、能力策略与展示策略。
3. renderer 注册：Vue 组件使用 `registerEditorRenderer`，非 Vue 内容使用 `registerEditorMountAdapter`。
4. persistence：使用宿主自己的 key 或 adapter 保存 `WorkbenchDocument`。

`main-ui` 不读取宿主数据库，不调用宿主业务服务，不内置业务编辑器。

## 2. autodo-app 适配草案

定位：多资料、多工作区的信息管理宿主。

建议 workspace：

1. `literature-workspace`：文献表格、筛选队列、详情面板。
2. `knowledge-workspace`：知识图谱、节点详情、关系检查。
3. `texdag-workspace`：TeX DAG 图、文件树、编译/检查状态。

建议 editor：

1. `literature-sidebar`：文献库导航和阅读队列。
2. `literature-table`：文献条目表。
3. `literature-detail`：条目详情和附件信息。
4. `knowledge-graph`：知识图谱 surface。
5. `texdag-graph`：TeX DAG surface。
6. `settings`：系统设置 overlay。

宿主保留内容：SQLite bridge、文献状态机、知识图谱服务、TeX DAG 解析与业务命令。

当前 demo 对应 fixture：`autodo-profile`，使用三栏布局模拟资料侧栏、表格和基于 `viewport-2d-kit` 的图谱底座。

## 3. matheshop 适配草案

定位：数学画布型宿主，核心是强指针交互 surface。

建议 workspace：

1. `math-canvas-workspace`：公式画布主工作台。

建议 editor：

1. `formula-canvas`：主画布，payload 保存文档 id、工具状态引用、引擎选择引用。
2. `math-tools`：工具、颜色、符号、历史入口。
3. `formula-inspector`：选中对象属性面板。
4. `engine-settings`：引擎设置 overlay。
5. `layer-list`：图层或对象列表。

宿主保留内容：`CanvasBoard`、Inspector 业务逻辑、符号计算引擎路由、React 过渡层或后续 Vue 迁移。

当前 demo 对应 fixture：`matheshop-profile`，使用三栏布局模拟工具面板、基于 `viewport-2d-kit` 的公式画布底座和 Inspector。画布 fixture 支持平移、缩放与 fit，用于验证主界面不会吞掉强交互 surface。

## 4. yeegames 适配草案

定位：游戏库与多对局实例宿主。

建议 workspace：

1. `game-library-workspace`：游戏广场、资源树、设置入口。

建议 editor：

1. `game-gallery`：游戏选择页。
2. `game-session`：参数化对局 editor，payload 至少包含 `{ gameId, sessionId }`。
3. `game-resource-tree`：游戏资源树。
4. `move-history`：走子历史。
5. `game-state-inspector`：当前对局状态。
6. `game-settings`：设置 tab 或 overlay。

宿主保留内容：棋盘渲染、规则引擎、存档、p5/Canvas/SVG 具体实现。

当前 demo 对应 fixture：`yeegames-profile`，`game-gallery` 可以连续打开多个 `game-session`，`viewport-foundation` 用于模拟棋盘视口底座。

## 5. 外部 Mount Adapter 契约

非 Vue 内容使用 `EditorMountAdapter`：

```ts
type EditorMountAdapter = {
  mount: (container: HTMLElement, context: EditorRenderContext) => void | (() => void)
  update?: (container: HTMLElement, context: EditorRenderContext) => void
  unmount?: (container: HTMLElement) => void
}
```

规则：

1. adapter 由宿主实现。
2. `main-ui` 不导入 React、ReactDOM、p5、Konva、Three.js 或业务渲染库。
3. adapter 必须负责 mount、update、unmount 生命周期。
4. adapter 内部可以临时承载 React 或 Canvas 内容，但这些依赖留在宿主项目。
5. editor payload 只存恢复参数，不存大体量业务数据。

当前 demo 的 `external-mount-demo` 使用原生 DOM 实现 adapter smoke test，验证 mount adapter 不需要任何外部框架。

## 6. 验收口径

适配草案通过以下条件视为成立：

1. 三类宿主都能由同一套 `WorkspaceDescriptor`、`EditorDescriptor`、`LayoutDocument` 表达。
2. `matheshop-profile` 的画布能通过 `viewport-2d-kit` 完成平移、缩放与 fit。
3. `yeegames-profile` 能打开多个 `game-session` tab，且 payload 不互相覆盖。
4. `external-mount-demo` 能通过 `registerEditorMountAdapter` 渲染内容。
5. `package.json` 不出现 React 运行时依赖。
