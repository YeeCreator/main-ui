/**
 * @main-ui/view-node 数据契约：宿主适配层负责取数并转成节点/连边数据经 Props 注入，
 * 视图只呈现与抛出操作意图（Emits），绝不发起网络请求。
 */

/** 节点位置（画布坐标）。 */
export type NodePosition = { x: number; y: number };

/** 节点数据（不含网络语义字段；缩略图/资源地址等一律由宿主以数据字段注入）。 */
export type NodeGraphData = {
  id: string;
  label?: string;
  position: NodePosition;
  /** 宿主业务载荷（透传，不参与渲染逻辑） */
  data?: Record<string, unknown>;
};

/** 连边数据。 */
export type NodeGraphEdgeData = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

/** 画布视口（平移 + 缩放），进视图状态契约。 */
export type NodeViewport = { x: number; y: number; zoom: number };

/** 节点移动意图载荷：由宿主裁决是否落库。 */
export type NodeMoveIntentPayload = {
  nodeId: string;
  position: NodePosition;
};

/** 连线意图载荷（新建连边的意向，由宿主裁决）。 */
export type NodeConnectIntentPayload = {
  source: string;
  target: string;
};

/** 选择变更意图载荷。 */
export type NodeSelectionPayload = {
  nodeIds: string[];
};

/** 视图状态契约（MainUiViewLifecycle.getViewState 的产出形态）。 */
export type NodeViewState = {
  viewport: NodeViewport;
  selectedNodeIds: string[];
};

export const DEFAULT_NODE_VIEWPORT: NodeViewport = { x: 0, y: 0, zoom: 1 };
