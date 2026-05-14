# HOST_INTEGRATION_GUIDE

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

## 4. `viewport-2d-kit` 在 `main-ui` 中的位置

`viewport-2d-kit` 不属于 `main-ui/core`。

推荐位置是：

1. 宿主 renderer 内部。
2. `main-ui` demo 级验证 fixture。
3. 宿主通过 `rendererKey` 或 `mount adapter` 接入的 editor surface。

不推荐位置是：

1. `main-ui/core` 直接依赖 `viewport-2d-kit`。
2. 把 `viewport-2d-kit` 写成 `main-ui` 的强制业务语义层。

## 5. 三类宿主的标准接法

### 5.1 `autodo-app`

推荐角色：多资料、多工作区的信息管理宿主。

推荐 workspace：

1. `literature`
2. `knowledge`
3. `texdag`

推荐 editor：

1. 文献目录与表格。
2. 条目详情。
3. 知识图谱。
4. TeX DAG。
5. 设置页。

应留在宿主侧的内容：

1. 资料读取。
2. SQLite bridge。
3. 知识图谱服务。
4. TeX DAG 业务命令。

### 5.2 `matheshop`

推荐角色：强指针交互的数学画布宿主。

推荐 workspace：

1. `math-canvas-workspace`

推荐 editor：

1. `formula-canvas`
2. `math-tools`
3. `formula-inspector`
4. `engine-settings`
5. `layer-list`

应留在宿主侧的内容：

1. `CanvasBoard` 业务行为。
2. Inspector 逻辑。
3. 符号计算引擎。
4. React 过渡壳层。

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