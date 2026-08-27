import type { NodeViewport } from './types';
import { DEFAULT_NODE_VIEWPORT } from './types';

/** 数值钳制（纯函数，可单测）。 */
export const clampNumber = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * 规范化视口（纯函数，可单测）：非有限值回退默认视口，
 * zoom 收敛到 [0.1, 4] 合理区间，避免快照异常值导致画布失控。
 */
export const normalizeViewport = (viewport: Partial<NodeViewport> | null | undefined): NodeViewport => {
  const candidate = viewport ?? {};
  const x = Number.isFinite(candidate.x) ? candidate.x! : DEFAULT_NODE_VIEWPORT.x;
  const y = Number.isFinite(candidate.y) ? candidate.y! : DEFAULT_NODE_VIEWPORT.y;
  const rawZoom = Number.isFinite(candidate.zoom) ? candidate.zoom! : DEFAULT_NODE_VIEWPORT.zoom;
  return { x, y, zoom: clampNumber(rawZoom, 0.1, 4) };
};

/** 节点 id 去重保序（纯函数）：宿主数据偶发重复时以先到者为准。 */
export const dedupeById = <T extends { id: string }>(items: readonly T[]): T[] => {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
};

/**
 * 过滤悬空连边（纯函数）：端点不在节点集合内的边不呈现，
 * 避免内核渲染报错（数据问题仍由宿主经 Emits 之外的通道自查）。
 */
export const pruneDanglingEdges = <T extends { source: string; target: string }>(
  edges: readonly T[],
  nodeIds: ReadonlySet<string>,
): T[] => edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
