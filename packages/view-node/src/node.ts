import type { NodeViewport } from './types';
import { DEFAULT_NODE_VIEWPORT } from './types';
import type { Camera2D } from '@main-ui/core/rendering';

/**
 * `NodeViewport` → `Camera2D` 的**显式桥**。
 *
 * 两种形状只是命名不同（`zoom`↔`scale`、`x/y`↔`pan.x/y`）。
 * **不统一形状**是刻意的：`NodeViewport` 的形状就是 `@vue-flow/core` 的
 * viewport 契约，改形会引入每次调用的来回转换与第三处真相源
 * （design-main-ui §二十 5）。
 *
 * `NodeViewport` 的 `x/y` 是 vue-flow 的**平移量语义**，与 `Camera2D.pan`
 * 同一口径（屏幕像素），故直接映射；`rotation` 在 vue-flow 侧无对应字段，不设置。
 *
 * @param viewport vue-flow 视口状态。
 * @returns 统一相机表示。
 * @example
 * nodeViewportToCamera({ x: 10, y: 20, zoom: 1.5 })
 * // → { scale: 1.5, pan: { x: 10, y: 20 } }
 */
export const nodeViewportToCamera = (viewport: NodeViewport): Camera2D => ({
  scale: viewport.zoom,
  pan: { x: viewport.x, y: viewport.y },
});

/**
 * `Camera2D` → `NodeViewport` 的**显式桥**（与 {@link nodeViewportToCamera} 互逆）。
 *
 * 输出经 {@link normalizeViewport} 约束 `zoom` 到 `[0.1, 4]`：vue-flow 的
 * 缩放区间比 `view-world` / `view-canvas` 窄，直接灌入大倍率会让其内部状态失序。
 *
 * @param camera 统一相机表示。
 * @returns vue-flow 视口状态（已约束）。
 * @example
 * cameraToNodeViewport({ scale: 2, pan: { x: 5, y: 6 } })
 * // → { x: 5, y: 6, zoom: 2 }
 */
export const cameraToNodeViewport = (camera: Camera2D): NodeViewport =>
  normalizeViewport({ x: camera.pan.x, y: camera.pan.y, zoom: camera.scale });

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
