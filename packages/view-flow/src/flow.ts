/**
 * @main-ui/view-flow 逻辑层：不可变文档变换纯函数。
 *
 * 所有操作返回新文档（不修改入参），可单测。
 * 约束：零 DOM / 零 Vue / 零网络依赖。
 */

import type { FlowDocument, FlowEdgeData, FlowNodeData, FlowNodeLayout, FlowPortRef } from './types';

// ============================================================
// 节点变换
// ============================================================

/** 添加节点（幂等：相同 id 不重复添加）。 */
export const addNode = (
  doc: FlowDocument,
  node: FlowNodeData,
  layout: FlowNodeLayout,
): FlowDocument => {
  if (doc.nodes.some((n) => n.id === node.id)) return doc;
  return {
    nodes: [...doc.nodes, node],
    edges: doc.edges,
    node_layouts: [...doc.node_layouts, layout],
  };
};

/** 删除节点并级联删除关联边（纯函数）。 */
export const removeNodes = (
  doc: FlowDocument,
  nodeIds: readonly string[],
): FlowDocument => {
  const idSet = new Set(nodeIds);
  return {
    nodes: doc.nodes.filter((n) => !idSet.has(n.id)),
    edges: doc.edges.filter(
      (e) => !idSet.has(e.source.nodeId) && !idSet.has(e.target.nodeId),
    ),
    node_layouts: doc.node_layouts.filter((l) => !idSet.has(l.id)),
  };
};

/** 移动节点（更新布局坐标，不影响连边）。 */
export const moveNode = (
  doc: FlowDocument,
  nodeId: string,
  position: { x: number; y: number },
): FlowDocument => ({
  ...doc,
  node_layouts: doc.node_layouts.map((l) =>
    l.id === nodeId ? { ...l, x: position.x, y: position.y } : l,
  ),
});

/** 更新节点 content 载荷（浅合并）。 */
export const updateNodeContent = (
  doc: FlowDocument,
  nodeId: string,
  patch: Record<string, unknown>,
): FlowDocument => ({
  ...doc,
  nodes: doc.nodes.map((n) =>
    n.id === nodeId ? { ...n, content: { ...(n.content ?? {}), ...patch } } : n,
  ),
});

// ============================================================
// 连边变换
// ============================================================

/** 添加连边（幂等：相同 id 不重复；方向校验：源 output → 目标 input）。 */
export const addEdge = (
  doc: FlowDocument,
  edge: FlowEdgeData,
): FlowDocument => {
  if (doc.edges.some((e) => e.id === edge.id)) return doc;
  // 方向校验：源端口必须为 output，目标端口必须为 input
  const sourceNode = doc.nodes.find((n) => n.id === edge.source.nodeId);
  const targetNode = doc.nodes.find((n) => n.id === edge.target.nodeId);
  if (!sourceNode || !targetNode) return doc;
  const sourcePort = sourceNode.ports.find((p) => p.id === edge.source.portId);
  const targetPort = targetNode.ports.find((p) => p.id === edge.target.portId);
  if (!sourcePort || sourcePort.direction !== 'output') return doc;
  if (!targetPort || targetPort.direction !== 'input') return doc;
  return { ...doc, edges: [...doc.edges, edge] };
};

/** 删除连边。 */
export const removeEdges = (
  doc: FlowDocument,
  edgeIds: readonly string[],
): FlowDocument => {
  const idSet = new Set(edgeIds);
  return { ...doc, edges: doc.edges.filter((e) => !idSet.has(e.id)) };
};

/** 过滤悬空连边（端点节点不存在时剪除）。 */
export const pruneDanglingEdges = (doc: FlowDocument): FlowDocument => {
  const nodeIds = new Set(doc.nodes.map((n) => n.id));
  return {
    ...doc,
    edges: doc.edges.filter(
      (e) => nodeIds.has(e.source.nodeId) && nodeIds.has(e.target.nodeId),
    ),
  };
};

// ============================================================
// uid 去重
// ============================================================

/** 节点 id 去重保序（宿主数据偶发重复时以先到者为准）。 */
export const dedupeNodes = (nodes: readonly FlowNodeData[]): FlowNodeData[] => {
  const seen = new Set<string>();
  return nodes.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
};

/** 连边 id 去重保序。 */
export const dedupeEdges = (edges: readonly FlowEdgeData[]): FlowEdgeData[] => {
  const seen = new Set<string>();
  return edges.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
};

// ============================================================
// 环检测与拓扑序
// ============================================================

/**
 * 检测有向图中是否存在环（纯函数，可单测）。
 * 仅基于控制流边（signal='control'）做结构校验，不影响执行。
 */
export const hasCycle = (doc: FlowDocument): boolean => {
  const controlEdges = doc.edges.filter((e) => e.signal === 'control');
  const adj = new Map<string, string[]>();
  for (const edge of controlEdges) {
    const list = adj.get(edge.source.nodeId) ?? [];
    list.push(edge.target.nodeId);
    adj.set(edge.source.nodeId, list);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const node of doc.nodes) color.set(node.id, WHITE);

  const dfs = (nodeId: string): boolean => {
    color.set(nodeId, GRAY);
    for (const neighbor of adj.get(nodeId) ?? []) {
      const c = color.get(neighbor) ?? WHITE;
      if (c === GRAY) return true; // 回边 = 环
      if (c === WHITE && dfs(neighbor)) return true;
    }
    color.set(nodeId, BLACK);
    return false;
  };

  for (const node of doc.nodes) {
    if ((color.get(node.id) ?? WHITE) === WHITE && dfs(node.id)) return true;
  }
  return false;
};

/**
 * 计算拓扑序（纯函数）。仅基于控制流边。
 * 存在环时返回空数组（调用方应先 hasCycle 检查）。
 */
export const topologicalSort = (doc: FlowDocument): string[] => {
  const controlEdges = doc.edges.filter((e) => e.signal === 'control');
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of doc.nodes) {
    adj.set(node.id, []);
    inDegree.set(node.id, 0);
  }
  for (const edge of controlEdges) {
    adj.get(edge.source.nodeId)?.push(edge.target.nodeId);
    inDegree.set(edge.target.nodeId, (inDegree.get(edge.target.nodeId) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const neighbor of adj.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return result.length === doc.nodes.length ? result : [];
};

// ============================================================
// diff / invert 契约位预留
// ============================================================

/** Op 差异计算（预留契约位，v0.6 实现）。 */
export type FlowDiff = { type: 'placeholder' };

/** Op 反转计算（预留契约位，v0.6 实现）。 */
export type FlowInverse = { type: 'placeholder' };
