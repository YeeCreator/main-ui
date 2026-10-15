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
  WHEEL_ZOOM_SPEED,
  buildHostBridge,
  cameraTransformOf,
  constrainScale,
  fitCamera,
  panCamera,
  wheelZoomFactor,
  zoomByFactor,
} from './viewport-state';
