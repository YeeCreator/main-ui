/**
 * view-flow/viewport —— `FlowViewport` ↔ `Camera2D` 的**显式桥**。
 *
 * 两种形状只是命名不同（`zoom`↔`scale`、`x/y`↔`pan.x/y`）。
 * **不统一形状**是刻意的：`FlowViewport` 的形状就是 `@vue-flow/core` 的
 * viewport 契约，改形会引入每次调用的来回转换与第三处真相源
 * （design-main-ui §二十 5）。本文件把这层转换**显式化并单测**，
 * 使「存在几套相机表示、它们如何互转」成为可查的事实而非隐式约定。
 */
import type { Camera2D } from '@main-ui/core/rendering';
import type { FlowViewport } from './types';
import { DEFAULT_FLOW_VIEWPORT } from './types';

/** vue-flow 的缩放合理区间（与 `view-node` 同口径）。 */
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

/**
 * 规范化流程视口：非有限值回退默认，`zoom` 收敛到 `[0.1, 4]`。
 *
 * @param viewport 可能残缺或异常的视口。
 * @returns 一定合法的视口。
 * @example
 * normalizeFlowViewport(null)              // { x: 0, y: 0, zoom: 1 }
 * normalizeFlowViewport({ zoom: 99 })      // { x: 0, y: 0, zoom: 4 }
 */
export function normalizeFlowViewport(viewport: Partial<FlowViewport> | null | undefined): FlowViewport {
  const candidate = viewport ?? {};
  const x = Number.isFinite(candidate.x) ? candidate.x! : DEFAULT_FLOW_VIEWPORT.x;
  const y = Number.isFinite(candidate.y) ? candidate.y! : DEFAULT_FLOW_VIEWPORT.y;
  const rawZoom = Number.isFinite(candidate.zoom) ? candidate.zoom! : DEFAULT_FLOW_VIEWPORT.zoom;
  return { x, y, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, rawZoom)) };
}

/**
 * `FlowViewport` → `Camera2D`。
 *
 * `FlowViewport` 的 `x/y` 是 vue-flow 的平移量语义，与 `Camera2D.pan`
 * 同一口径（屏幕像素），故直接映射。
 *
 * @param viewport vue-flow 视口状态。
 * @returns 统一相机表示。
 * @example
 * flowViewportToCamera({ x: 10, y: 20, zoom: 1.5 })
 * // → { scale: 1.5, pan: { x: 10, y: 20 } }
 */
export function flowViewportToCamera(viewport: FlowViewport): Camera2D {
  return { scale: viewport.zoom, pan: { x: viewport.x, y: viewport.y } };
}

/**
 * `Camera2D` → `FlowViewport`（经 {@link normalizeFlowViewport} 约束缩放区间）。
 *
 * @param camera 统一相机表示。
 * @returns vue-flow 视口状态（已约束）。
 * @example
 * cameraToFlowViewport({ scale: 2, pan: { x: 5, y: 6 } })
 * // → { x: 5, y: 6, zoom: 2 }
 */
export function cameraToFlowViewport(camera: Camera2D): FlowViewport {
  return normalizeFlowViewport({ x: camera.pan.x, y: camera.pan.y, zoom: camera.scale });
}
