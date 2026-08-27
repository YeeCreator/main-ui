# @main-ui/view-flow

流程/状态机文档编辑器模板（v0.5.0）。按「内核 + 组件 + 薄壳」三件套交付：

- **L2 内核**：`flow.ts` 不可变文档变换纯函数（节点/连边增删、悬空边剪除、环检测、拓扑序）+ `src/fsm/` 框架无关层级状态机库（machine/interpreter/hub + `machineToFlowDocument` 映射）；
- **L1 组件**：`FlowCanvas`——可嵌入任意面板/复合 View（如 `view-sandbox` 节点），不可挂 Slot；
- **L3 薄壳**：`FlowView`——实现 `MainUiViewLifecycle`，可独立停靠（双模式，同一套代码）。

与 `view-node` 的硬分界：类型化端口 + 数据流/控制流双边 + `node_type`/`content` 节点模型。执行运行时不进包（契约 JSON 对称，供下游后端镜像实现）。

## 安装

```bash
pnpm add @main-ui/view-flow main-ui vue @main-ui/core
pnpm add @vue-flow/core@^1.48   # 渲染内核，需显式安装
```

## 一键注册

```ts
import { registerFlowViewEditor } from '@main-ui/view-flow'

registerFlowViewEditor(
  runtime,
  { allowedWorkspaceIds: ['my-workspace'], title: 'Flow Editor' },
  (context) => ({ document: myStore.getFlowDoc(context.editor.id), loading: false, error: null }),
  (context) => ({
    onNodeMoveIntent: (p) => myStore.moveNode(context.editor.id, p),
    onConnectIntent: (p) => myStore.connect(context.editor.id, p),
    onSelection: (p) => myStore.select(context.editor.id, p),
  }),
)
```

kind 为 `view-flow`，需并入 `WorkspaceDescriptor.allowedEditorKinds`。

## Props

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `document` | `FlowDocument` | 流程文档（`nodes` + `edges` + `node_layouts`；节点含 `node_type` 与类型化 `ports`，边分 `data`/`control` 信号） |
| `loading` / `error` | — | 三态 |
| `editable` | `boolean` | 是否允许拖拽/连线（默认 `true`） |
| `editorInstanceId` | `string \| null` | 传入则自动挂载视图生命周期 |

## Emits

`node-move-intent(FlowMoveNodeIntent)` / `connect-intent(FlowConnectIntent)` / `selection(FlowSelectionIntent)`。

## 视图状态

`FlowViewState = { viewport, selectedNodeIds, selectedEdgeIds }`（视口与选择进快照，文档数据经 Props 由宿主管理）。

## 纯函数与 FSM 导出

`addNode` / `removeNodes` / `moveNode` / `addEdge` / `removeEdges` / `pruneDanglingEdges` / `hasCycle` / `topologicalSort` / `createMachine` / `interpret` / `assign` / `createHub` / `machineToFlowDocument` 等（详见 `src/index.ts`）。

## 红线

零网络请求；执行器/算子注册表不进包；颜色消费 `--mui-*`。
