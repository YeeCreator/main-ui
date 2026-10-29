/**
 * view-canvas/viewport-state —— 纯函数：相机约束 / 缩放 / 坐标桥。
 *
 * 纪律（对齐 view-world F-3 教训）：对外暴露的相机状态必须是**普通值**，
 * 绝不返回 Vue 响应式 Proxy。
 */
import {
  cameraToSvgTransform,
  clamp,
  fitCameraToViewBox,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAtScreenPoint,
  type Camera2D,
  type SvgTransform,
  type Vec2,
  type ViewBox,
} from '@main-ui/core/rendering';
import { WHEEL_ZOOM_SPEED, PINCH_ZOOM_SPEED } from '@main-ui/core/input';
import type { ViewportContainerSize, ViewportHostBridge } from './types';

/** 默认缩放档（zoomIn/out 每档倍数）。 */
export const ZOOM_STEP = 1.15;

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

/** 由捏合 deltaY 计算缩放倍率（灵敏度高于鼠标滚轮）。 */
export function pinchZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * PINCH_ZOOM_SPEED);
}

/** 相机自增平移（屏幕像素）。 */
export function panCamera(camera: Camera2D, deltaScreen: Vec2): Camera2D {
  return panBy(camera, deltaScreen);
}

/**
 * 供 `<g :transform>` 使用的相机变换串。
 *
 * @deprecated 改用 `@main-ui/core/rendering` 的 {@link cameraToSvgTransform}
 *   —— 本函数是它的历史别名，仅为不破坏既有 import 路径而保留。
 *   同名存在两处产出点是"多个真相源"的来源，请勿在新代码中使用。
 */
export function cameraTransformOf(camera: Camera2D): SvgTransform {
  return cameraToSvgTransform(camera);
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
