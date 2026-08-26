# HOST_INTEGRATION_GUIDE

## 当前版本与升级方式

当前接入基线为 `main-ui 0.1.0`，对应本地包 `main-ui-0.1.0.tgz`。本次升级不要求重写现有 editor renderer；下游应显式选择是否安装该包。源码联调可继续使用 `file:../main-ui`，版本验收使用 `.tgz` 包。

本文档面向宿主项目维护者，说明 `main-ui` 作为工作台内核时，宿主应如何注册 workspace、editor、renderer、mount adapter，以及哪些职责必须继续留在宿主侧。

本文不是 API 手册的重复版本，而是宿主接入顺序与边界说明。

## 0. 接入前必读规范

任何宿主项目在接入 `main-ui` 之前，都必须先阅读并遵守以下文档中的开发规范。这里不是建议项，而是接入前置条件。

必须先阅读：

1. `main-ui/docs/DEVELOPER_GUIDE.md`
2. `main-ui/docs/HOST_INTEGRATION_GUIDE.md`
3. `main-ui/docs/HOST_PROFILE_VALIDATION.md`
4. 若宿主会组合 2D 视口能力，再额外阅读 `viewport-2d-kit/docs/DEVELOPER_GUIDE.md`
5. 若宿主会把 `viewport-2d-kit` 放进 `main-ui` editor 体系，再额外阅读 `viewport-2d-kit/docs/MAIN_UI_INTEGRATION_GUIDE.md`

宿主在开始实现前，至少要确认以下规则已经被接受：

1. 业务状态不进入 `main-ui/core`。
2. 第三方渲染库不进入 `main-ui`。
3. 宿主 renderer、mount adapter 与业务 model 仍留在宿主侧。
4. payload 只保存轻量恢复参数，不保存大对象或服务实例。

如果以上前置阅读没有完成，则不应开始接入实现，也不应直接进入升级或反馈阶段。

## 1. `main-ui` 解决什么问题

`main-ui` 负责以下通用工作台能力：

1. workspace 切换。
2. split tree 与 tab group 布局。
3. tab 生命周期。
4. overlay 生命周期。
5. renderer registry。
6. 工作台持久化状态。

`main-ui` 不负责以下内容：

1. 宿主业务数据加载。
2. 宿主数据库桥接。
3. 宿主业务命令与规则引擎。
4. 宿主画布、图谱、棋盘或数学引擎的内部语义。
5. React、p5、Konva、Three.js 等第三方业务渲染运行时。

## 2. 宿主必须提供的四类注册信息

一个宿主项目接入 `main-ui` 时，只需要稳定提供四类东西：

1. `WorkspaceDescriptor`
2. `EditorDescriptor`
3. renderer 或 mount adapter
4. persistence key 或自定义持久化层

最小运行时入口如下：

```ts
import { createMainUiRuntime } from 'main-ui/vue'

const runtime = createMainUiRuntime()
```

### 2.1 注册 workspace

```ts
runtime.core.registerWorkspace({
  id: 'knowledge-workspace',
  title: '知识图谱',
  icon: 'graph',
  allowedEditorKinds: ['knowledge-graph', 'knowledge-detail', 'settings'],
  createDefaultLayout: () => createThreePaneLayout({
    id: 'knowledge-layout',
    leftGroupId: 'knowledge-left',
    centerGroupId: 'knowledge-center',
    rightGroupId: 'knowledge-right',
  }),
  defaultOpenRequests: [
    { editorKind: 'knowledge-graph', targetGroupId: 'knowledge-center' },
  ],
})
```

宿主需要保证：

1. workspace id 稳定。
2. `allowedEditorKinds` 与真实注册的 editor kind 一致。
3. 默认 layout 能被当前宿主真实消费。

### 2.2 注册 editor

```ts
runtime.core.registerEditor({
  kind: 'knowledge-graph',
  rendererKey: 'knowledge-graph-editor',
  capability: {
    multiOpen: true,
    closable: true,
    movable: true,
  },
  presentation: {
    defaultSurface: 'tab',
  },
  availability: {
    workspaceIds: ['knowledge-workspace'],
  },
})
```

宿主需要保证：

1. `kind` 是业务无关但稳定的编辑器类型名。
2. `rendererKey` 与后续注册的 renderer 或 adapter 完全一致。
3. `payload` 只保存恢复参数，不保存大体量业务对象。

### 2.3 注册 Vue renderer

如果宿主内容本身是 Vue 组件，使用：

```ts
runtime.vue.registerEditorRenderer('knowledge-graph-editor', KnowledgeGraphEditor)
```

适用场景：

1. 宿主本身是 Vue 项目。
2. 编辑器内容已经是 Vue 组件。
3. 希望直接复用宿主现有 provider / composables。

### 2.4 注册 mount adapter

如果宿主内容不是 Vue 组件，使用：

```ts
runtime.vue.registerEditorMountAdapter('react-canvas-editor', {
  mount(container, context) {
    const dispose = mountReactCanvas(container, context)
    return dispose
  },
  update(container, context) {
    updateReactCanvas(container, context)
  },
  unmount(container) {
    unmountReactCanvas(container)
  },
})
```

适用场景：

1. React 过渡壳层。
2. 原生 Canvas/SVG 内容。
3. 第三方渲染库必须由宿主自己控制生命周期的场景。

规则：

1. `main-ui` 不导入第三方渲染库。
2. 宿主必须自行处理 mount / update / unmount。
3. adapter 内部依赖留在宿主项目，不进入 `main-ui`。

### 2.5 持久化

`main-ui` 只持久化 `WorkbenchDocument`，宿主业务数据仍然由宿主自己存储。

建议：

1. 为每个宿主使用独立 persistence key。
2. 将 `documentId`、`sessionId`、`projectId` 这类轻量引用写入 payload。
3. 不把大型业务对象写入工作台状态。

## 3. 推荐接入顺序

宿主接入时，按以下顺序执行：

1. 创建 runtime。
2. 注册 renderer 或 mount adapter。
3. 注册 editor descriptor。
4. 注册 workspace descriptor。
5. 在宿主入口挂载 `MainUiProvider` 与 `WorkbenchShell`。
6. 验证默认 workspace、tab、overlay 与持久化行为。

推荐入口形态：

```ts
import { createMainUiRuntime, MainUiProvider, WorkbenchShell } from 'main-ui/vue'
```

## 4. `main-ui`、`viewport-2d-kit`、`flow-graph-kit` 的分层协同

在画布型宿主中，建议固定使用以下四层协同模型：

1. `main-ui`：workbench shell，负责 workspace、layout tree、tab、overlay、renderer registry 与工作台持久化。
2. `viewport-2d-kit`：viewport engine，负责平移/缩放、坐标换算、视口壳层与 host bridge。
3. `flow-graph-kit`（含 `flow-graph-kit-vue`）：graph canvas editor kit，负责图文档、节点/连边语义、选择状态、图编辑交互 surface。
4. 宿主画布 editor renderer：负责把宿主业务状态映射到图文档，组合工具栏、检查器与业务命令。

职责边界：

1. `main-ui` 不理解节点、连边、公式块等业务语义。
2. `viewport-2d-kit` 不承载流程图语义与业务命令。
3. `flow-graph-kit` 不接管宿主业务数据源和领域规则。
4. 宿主 renderer 不重写通用视口底层与通用图编辑契约。

推荐放置位置：

1. `viewport-2d-kit` 与 `flow-graph-kit-vue` 放在宿主 renderer 内部组合使用。
2. `main-ui` 只通过 `rendererKey` 或 `mount adapter` 承载宿主 editor。
3. demo fixture 用于验证分层协同，不用于沉淀宿主业务逻辑。

不推荐：

1. `main-ui/core` 直接依赖 `viewport-2d-kit` 或 `flow-graph-kit`。
2. 把 `viewport-2d-kit` 或 `flow-graph-kit` 上升为 `main-ui` 内置业务层。
3. 在宿主 renderer 中复制一套平移/缩放或图编辑核心状态机。

## 5. 三类宿主的标准接法

### 5.1 `autodo-app`

推荐角色：多资料、多工作区的信息管理宿主。

推荐 workspace：

1. `literature`
2. `knowledge`
3. `texdag`

推荐 editor：

1. 顶部工具栏 editor，可直接基于 `ToolbarEditor` 包装；该组件默认按横向滚动工具栏条带渲染。
2. 左侧资源 / 事务树 editor，可直接基于 `TreeEditor` 包装。
3. 中心矩阵、表格、关系图或 graph editor。
4. 右侧详情 editor。
5. 设置页。

推荐结构：

1. 顶部一条工具栏窗口承接高频动作。
2. 左侧窄窗口承接树状导航。
3. 中央主窗口承接矩阵、表格、graph 或关系视图。
4. 右侧窗口承接详情或第二棵工具树。

应留在宿主侧的内容：

1. 资料读取。
2. SQLite bridge。
3. 知识图谱服务。
4. TeX DAG 业务命令。

### 5.2 `matheshop`

推荐角色：强指针交互的数学画布宿主。

推荐 workspace：

1. `math-canvas-workspace`：计算白板主工作区。
2. `math-assets-workspace`：公式模板、片段、符号资源与素材管理。
3. `math-analysis-workspace`：求值历史、推导轨迹、结果比对与诊断。

推荐 editor：

1. `formula-canvas`：计算白板画布 editor。
2. `math-tools`：工具与绘制策略面板。
3. `formula-inspector`：选中对象属性与编辑面板。
4. `engine-settings`：引擎与求值策略设置。
5. `layer-list`：图层与对象结构列表。
6. `calc-history`：计算历史与重放入口。

计算白板文件与标签页模型：

1. 一个计算白板文件对应一个独立文档标识（建议 `whiteboardFileId`）。
2. `formula-canvas` payload 只保存轻量恢复参数，至少包含：`whiteboardFileId`、`sessionId`、`activeTool`、`engineProfileId`。
3. 每个标签页绑定一个 `whiteboardFileId`，不同标签页可以是不同白板文件。
4. 同一白板文件允许多标签页实例时，所有实例共享同一文件源并同步到宿主文档层。
5. 若同一白板文件不允许多实例，则以 `restoreKey = whiteboardFileId` 实现“激活既有标签页而非重复打开”。
6. `main-ui` 仅管理标签页与恢复参数，白板文件正文与版本历史由宿主持久化层管理。

建议的打开策略：

1. 默认打开白板文件时，优先定位到当前工作区的中心组。
2. 支持“新建白板文件并打开新标签页”。
3. 支持“从文件列表打开既有白板文件到新标签页或激活既有标签页”。
4. 支持“最近打开白板文件”恢复，但恢复内容仍以宿主文件层为准。

推荐的能力策略（`formula-canvas`）：

1. 允许创建、关闭、跨组移动与分栏拖放。
2. 是否允许同文件多标签页实例，由宿主按白板协作策略决定。
3. 默认 surface 为 tab，不建议把主白板设为 modal overlay。

应留在宿主侧的内容：

1. 计算白板文件读写、版本化与冲突处理。
2. `CanvasBoard` 或等价业务状态机。
3. Inspector 业务逻辑与领域命令。
4. 符号计算引擎路由与执行策略。
5. 数学表达式块、公式渲染与领域校验。

### 5.3 `yeegames`

推荐角色：游戏广场与多对局实例宿主。

推荐 workspace：

1. `game-library-workspace`

推荐 editor：

1. `game-gallery`
2. `game-session`
3. `game-resource-tree`
4. `move-history`
5. `game-state-inspector`
6. `game-settings`

应留在宿主侧的内容：

1. 棋盘渲染。
2. 游戏规则与状态机。
3. 存档与会话管理。
4. React 宿主过渡壳层。

## 6. 常见错误接法

以下接法应避免：

1. 把业务状态写入 `main-ui/core`。
2. 让 `main-ui` 直接理解宿主业务模型。
3. 将第三方渲染库依赖塞进 `main-ui`。
4. 在没有 renderer 或 adapter 的情况下，只注册 editor descriptor。
5. 将不同宿主复用同一个 persistence key。

## 7. 最小验收清单

宿主接入 `main-ui` 后，至少应通过以下检查：

1. workspace 能切换。
2. 默认 editor 能按 workspace 正确打开。
3. tab 可打开、关闭、移动。
4. overlay 能打开并关闭。
5. renderer 与 mount adapter 生命周期正常。
6. 刷新后布局与轻量 payload 可恢复。
7. 业务数据仍由宿主自己负责，不被 `main-ui` 接管。

## 8. 与其他文档的关系

建议结合以下文档一起使用：

1. `API_MANUAL.md`：查 API 与类型。
2. `HOST_PROFILE_VALIDATION.md`：查 demo 级宿主画像验证口径。
3. `HOST_ADAPTER_GUIDE.md`：查适配草案与早期宿主示例。

本文件作为正式宿主接入指南，应优先用于后续宿主项目实施。

## 附录 A：对接后端（宿主适配层分层）

`main-ui` 自身不发起任何网络请求（发布检查项：`grep -rE "fetch\(|axios|XMLHttpRequest|WebSocket" packages/main-ui/src` 零命中）。所有后端交互由宿主适配层承担，推荐四层分工：

1. **main-ui 内核**：只管布局、插槽、持久化快照；不认识任何业务模型。
2. **视图模板**（`@main-ui/view-*` 或宿主自绘视图）：声明式消费 Props 数据（含 `loading / error / data` 三态），业务意图经 Emits 向外声明；模板包零网络请求。
3. **宿主适配层**：宿主项目内的业务层，负责取数、缓存、乐观更新、错误归一化；向下调后端接口，向上把数据注入视图 Props、把视图意图翻译为后端调用。
4. **后端**：REST/HTTP 提供查询与命令，WebSocket 提供推送。

HTTP 与 WebSocket 分工：

1. 一次性查询、提交、增删改走 HTTP（请求-响应语义清晰，便于重试与缓存）。
2. 实时性推送（协作变更、任务进度、服务状态）走 WebSocket；适配层维护单一连接并做断线重连，视图不感知连接细节。
3. 视图模板永不直连 WebSocket；适配层把推送归一为普通数据更新后经 Props 下发。

长任务范式：

1. 提交长任务时后端立即返回 `taskId`，不同步阻塞等待结果。
2. 适配层以 `taskId` 订阅进度（WebSocket 推送优先，轮询兜底），把 `{ status, progress, result?, error? }` 归一后下发给视图。
3. 视图按三态渲染：进行中显示进度，失败显示可重试错误，成功显示结果；任务本身的重试与取消由适配层负责。
4. `main-ui` 的 editor payload 只存 `taskId` 等引用，不存任务结果大对象。

类型对齐建议（Pydantic → OpenAPI → TypeScript）：

1. 后端用 Pydantic 定义接口模型，作为唯一事实来源。
2. 由 FastAPI/类似框架导出 OpenAPI schema，用 `openapi-typescript` 等工具生成 TS 类型，纳入宿主适配层构建流程。
3. 视图模板消费的 Props 类型从生成的类型收窄而来；避免手写与后端模型漂移的接口定义。
4. 分页、错误体、时间戳等公共结构建议在后端统一定义，前端生成后全局复用。
