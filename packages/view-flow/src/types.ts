/**
 * @main-ui/view-flow 数据契约：流程/状态机文档编辑器。
 *
 * 按「内核 + 组件 + 薄壳」三件套交付（D1–D8 决策，备忘录 -009/-010）。
 * 与 view-node 的硬分界 = 类型化端口 + 数据流/控制流双边 + node_type/content 节点模型。
 *
 * 约束：零网络语义字段（无 url / token）；事件命名语义化；
 * 视图模板只呈现与抛出意图，数据获取与落库一律在宿主适配层完成。
 */

// ============================================================
// 端口与节点模型
// ============================================================

/** 端口方向。 */
export type FlowPortDirection = 'input' | 'output';

/** 端口信号类型：数据流（实线）与控制流（虚线）。 */
export type FlowPortSignal = 'data' | 'control';

/** 类型化端口定义（节点上的连接锚点）。 */
export type FlowPortDef = {
  id: string;
  direction: FlowPortDirection;
  signal: FlowPortSignal;
  /** 端口数据类型标识（宿主自定义，如 'number' / 'string' / 'event'） */
  dataType?: string;
  label?: string;
};

/** 流程节点类型（宿主可扩展）。 */
export type FlowNodeType = 'state' | 'action' | 'decision' | 'start' | 'end' | string;

/** 流程节点数据。 */
export type FlowNodeData = {
  id: string;
  /** 节点类型（决定端口集合与呈现形态） */
  node_type: FlowNodeType;
  /** 节点显示标签 */
  label?: string;
  /** 类型化端口列表 */
  ports: FlowPortDef[];
  /** 宿主业务载荷（透传，不参与渲染逻辑） */
  content?: Record<string, unknown>;
};

/** 流程节点布局（画布坐标，进文档模型）。 */
export type FlowNodeLayout = {
  id: string;
  x: number;
  y: number;
};

// ============================================================
// 连边模型
// ============================================================

/** 连边端点引用（节点 id + 端口 id）。 */
export type FlowPortRef = {
  nodeId: string;
  portId: string;
};

/** 流程连边数据。 */
export type FlowEdgeData = {
  id: string;
  source: FlowPortRef;
  target: FlowPortRef;
  /** 信号类型：数据流（实线）或控制流（虚线） */
  signal: FlowPortSignal;
  label?: string;
};

// ============================================================
// 文档与视图状态
// ============================================================

/** 流程图文档模型（进持久化；Op 分类 FLOW_CORE_OP_TYPES 操作此结构）。 */
export type FlowDocument = {
  nodes: FlowNodeData[];
  edges: FlowEdgeData[];
  node_layouts: FlowNodeLayout[];
};

/** 画布视口（平移 + 缩放），进视图状态契约（非文档）。 */
export type FlowViewport = { x: number; y: number; zoom: number };

/** 视图状态契约（MainUiViewLifecycle.getViewState 的产出形态；FLOW_EDITOR_OP_TYPES 操作此结构）。 */
export type FlowViewState = {
  viewport: FlowViewport;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
};

/** 文档级操作类型标识（进文档快照历史）。 */
export const FLOW_CORE_OP_TYPES = [
  'addNode', 'removeNode', 'moveNode',
  'addEdge', 'removeEdge',
  'updateNodeContent',
] as const;

/** 编辑器级操作类型标识（仅进视图状态，不进文档）。 */
export const FLOW_EDITOR_OP_TYPES = [
  'select', 'panViewport', 'zoomViewport',
] as const;

// ============================================================
// 意图载荷
// ============================================================

/** 节点移动意图。 */
export type FlowMoveNodeIntent = {
  nodeId: string;
  position: { x: number; y: number };
};

/** 连边创建意图。 */
export type FlowConnectIntent = {
  source: FlowPortRef;
  target: FlowPortRef;
  signal: FlowPortSignal;
};

/** 节点删除意图（级联删边）。 */
export type FlowRemoveNodeIntent = {
  nodeIds: string[];
};

/** 连边删除意图。 */
export type FlowRemoveEdgeIntent = {
  edgeIds: string[];
};

/** 选择变更意图。 */
export type FlowSelectionIntent = {
  nodeIds: string[];
  edgeIds: string[];
};

// ============================================================
// 默认值
// ============================================================

export const DEFAULT_FLOW_VIEWPORT: FlowViewport = { x: 0, y: 0, zoom: 1 };

export const createEmptyFlowDocument = (): FlowDocument => ({
  nodes: [],
  edges: [],
  node_layouts: [],
});
