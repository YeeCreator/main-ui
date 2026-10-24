/**
 * view-canvas/viewport-state —— 纯函数：相机约束 / 缩放 / 坐标桥。
 *
 * 纪律（对齐 view-world F-3 教训）：对外暴露的相机状态必须是**普通值**，
 * 绝不返回 Vue 响应式 Proxy。
 */
import {
  clamp,
  fitCameraToViewBox,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAtScreenPoint,
  type Camera2D,
  type Vec2,
  type ViewBox,
} from '@main-ui/core/rendering';
import type { ViewportContainerSize, ViewportHostBridge } from './types';

/** 默认缩放档（zoomIn/out 每档倍数）。 */
export const ZOOM_STEP = 1.15;

/** 滚轮缩放灵敏度（指数底数系数）。 */
export const WHEEL_ZOOM_SPEED = 0.0016;

/** 把相机缩放到 [minScale, maxScale] 区间内（产出全新普通对象）。 */
export function constrainScale(camera: Camera2D, minScale: number, maxScale: number): Camera2D {
  const scale = clamp(camera.scale, minScale, maxScale);
  const next: Camera2D = { scale, pan: { x: camera.pan.x, y: camera.pan.y } };
  const rotation = camera.rotation;
  if (typeof rotation === 'number' && rotation !== 0) next.rotation = rotation;
  return next;
}

/** 适配 viewBox 到容器（居中 + 等比缩放 + padding）；尺寸非法时返回 null。 */
export function fitCamera(
  size: ViewportContainerSize,
  viewBox: ViewBox,
  paddingPx: number,
  minScale: number,
  maxScale: number,
): Camera2D | null {
  if (size.width <= 0 || size.height <= 0) return null;
  return constrainScale(
    fitCameraToViewBox({ containerPx: { width: size.width, height: size.height }, viewBox, paddingPx }),
    minScale,
    maxScale,
  );
}

/** 按给定倍率在锚点处缩放（锚点缺省为容器中心）。 */
export function zoomByFactor(
  camera: Camera2D,
  size: ViewportContainerSize,
  factor: number,
  anchor: Vec2 | null,
  minScale: number,
  maxScale: number,
): Camera2D {
  const anchorScreen = anchor ?? { x: size.width / 2, y: size.height / 2 };
  return constrainScale(zoomAtScreenPoint(camera, { factor, anchorScreen }), minScale, maxScale);
}

/** 由滚轮 deltaY 计算缩放倍率。 */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * WHEEL_ZOOM_SPEED);
}

/**
 * 触控板捏合缩放灵敏度。
 *
 * 为何与鼠标滚轮分开：macOS 触控板捏合产生的 `wheel` 事件 `deltaY` 通常只有
 * ±1..±30（远小于鼠标滚轮的 ±100），套用 `WHEEL_ZOOM_SPEED` 时
 * `exp(-4 × 0.0016) ≈ 0.9936`，每次只缩放 0.6% —— 表现为「捏合几乎没反应」。
 */
export const PINCH_ZOOM_SPEED = 0.01;

/** 由捏合 deltaY 计算缩放倍率（灵敏度高于鼠标滚轮）。 */
export function pinchZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * PINCH_ZOOM_SPEED);
}

/**
 * 滚轮类手势的三种语义。
 *
 * - `pinch`：触控板双指捏合（浏览器一律置 `ctrlKey`）或 Cmd/Ctrl+滚轮 → **缩放**
 * - `pan`：触控板双指平移 → **平移视口**
 * - `zoom`：传统鼠标滚轮 → **缩放**（PRD FR-001 的既有行为，不可回归）
 */
export type WheelGesture = 'pinch' | 'pan' | 'zoom';

/** `classifyWheel` 的输入：只取判定所需字段，便于纯函数单测。 */
export type WheelLike = {
  ctrlKey: boolean;
  metaKey: boolean;
  deltaX: number;
  deltaY: number;
  deltaMode: number;
};

/** 触控板平移判定阈值：像素模式下超过此值的纵向滚轮视为鼠标滚轮。 */
export const TRACKPAD_PAN_MAX_DELTA_Y = 40;

/**
 * 判定一次 `wheel` 事件属于哪种手势。
 *
 * 判定顺序不可调换：
 * 1. `ctrlKey`/`metaKey` → **捏合**。这是浏览器对触控板捏合的既定约定
 *    （Safari/Chrome 都置 `ctrlKey=true`），也是 Cmd+滚轮的语义，均属缩放。
 * 2. `deltaMode !== 0`（行/页模式）→ 老式鼠标滚轮 → 缩放。
 * 3. `deltaX !== 0` → 触控板横向平移。鼠标滚轮**不产生**横向分量
 *    （除非按 Shift，而那属另一条手势），故这是可靠的触控板特征。
 * 4. `|deltaY|` 非整数 → 触控板（其上报为浮点）；鼠标滚轮上报整数刻度。
 * 5. `|deltaY| < TRACKPAD_PAN_MAX_DELTA_Y` → 小幅滚动，按触控板平移处理。
 * 6. 其余 → 鼠标滚轮 → 缩放。
 *
 * @param event 具备 `ctrlKey` / `metaKey` / `deltaX` / `deltaY` / `deltaMode` 的事件。
 * @returns 手势语义。
 * @example
 * classifyWheel({ ctrlKey: true, metaKey: false, deltaX: 0, deltaY: 4, deltaMode: 0 }) // 'pinch'
 * classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 12, deltaY: -3, deltaMode: 0 }) // 'pan'
 * classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -100, deltaMode: 0 }) // 'zoom'
 */
export function classifyWheel(event: WheelLike): WheelGesture {
  if (event.ctrlKey || event.metaKey) return 'pinch';
  if (event.deltaMode !== 0) return 'zoom';
  if (event.deltaX !== 0) return 'pan';
  if (!Number.isInteger(event.deltaY)) return 'pan';
  if (Math.abs(event.deltaY) < TRACKPAD_PAN_MAX_DELTA_Y) return 'pan';
  return 'zoom';
}

/**
 * 触控板平移的**屏幕**位移。
 *
 * 取负号：滚轮向上（`deltaY < 0`）应使内容上移、即相机 `pan.y` 增大方向的观感；
 * 与 Figma/Excalidraw 的「双指推内容」一致。
 */
export function wheelPanDelta(event: { deltaX: number; deltaY: number }): Vec2 {
  return { x: -event.deltaX, y: -event.deltaY };
}

/** 相机自增平移（屏幕像素）。 */
export function panCamera(camera: Camera2D, deltaScreen: Vec2): Camera2D {
  return panBy(camera, deltaScreen);
}

/** 供 `<g :transform>` 使用的相机变换串。 */
export function cameraTransformOf(camera: Camera2D): string {
  return `translate(${camera.pan.x} ${camera.pan.y}) scale(${camera.scale})`;
}

/**
 * 构建宿主自绘坐标桥（client -> world 等）。
 * `toLocal` 由组件提供（把 client 坐标换算为容器内局部屏幕坐标）。
 */
export function buildHostBridge(
  viewBox: ViewBox,
  toLocal: (clientX: number, clientY: number) => Vec2 | null,
): ViewportHostBridge {
  return {
    viewBoxText: `0 0 ${viewBox.width} ${viewBox.height}`,
    worldStyle: { width: `${viewBox.width}px`, height: `${viewBox.height}px` },
    clientEventToWorld: (camera, event) => {
      const local = toLocal(event.clientX, event.clientY) ?? { x: 0, y: 0 };
      return screenToWorld(camera, local);
    },
    screenDeltaToWorld: (camera, deltaScreen) => ({
      x: deltaScreen.x / camera.scale,
      y: deltaScreen.y / camera.scale,
    }),
  };
}

/** 屏幕 -> 世界（透传 core 纯函数，便于宿主直接使用）。 */
export { screenToWorld, worldToScreen };
