/**
 * @main-ui/view-canvas —— DOM/SVG 2D 画布视口（MUI 官方视图模板）。
 *
 * - `ViewportCanvas`：相机 + 指针/滚轮交互 + 坐标系换算；默认插槽暴露 `cameraTransform` 供宿主自绘。
 * - `ViewportCanvasShell`：三栏业务画布壳（左面板 + 舞台 + 右面板）。
 * - `useViewportHostBridge`：宿主自绘坐标桥（client→world）。
 * - 相机数学基于 `@main-ui/core/rendering`（原 viewport-2d-kit 吸收后的官方基座）。
 *
 * 与 `@main-ui/view-world`（PixiJS 图元自动渲染）互补：本模板面向「宿主自绘 SVG/DOM」。
 * 取代已废弃的 `viewport-2d-kit/vue`。
 */
export * from './types';
export { ViewportCanvas } from './ViewportCanvas';
export { ViewportCanvasShell, type ViewportCanvasShellProps } from './ViewportCanvasShell';
export { useViewportHostBridge } from './useViewportHostBridge';
export {
  ZOOM_STEP,
  buildHostBridge,
  cameraTransformOf,
  constrainScale,
  fitCamera,
  panCamera,
  zoomByFactor,
} from './viewport-state';
// 滚轮判型已上移到 @main-ui/core/input（唯一真相源）；此处再导出仅为
// 不破坏既有 import 路径，新代码应直接从 `@main-ui/core/input` 引入。
export {
  WHEEL_ZOOM_SPEED,
  PINCH_ZOOM_SPEED,
  TRACKPAD_PAN_MAX_DELTA_Y,
  classifyWheel,
  pinchZoomFactor,
  wheelPanDelta,
  wheelZoomFactor,
  type WheelGesture,
  type WheelLike,
} from '@main-ui/core/input';
