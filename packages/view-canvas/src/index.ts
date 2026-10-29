/**
 * @main-ui/view-canvas —— DOM/SVG 2D 画布视口（MUI 官方视图模板）。
 *
 * - `ViewportCanvas`：相机 + 指针/滚轮交互 + 坐标系换算；默认插槽暴露
 *   `svgTransform`（SVG 属性位）与 `cssTransform`（CSS 样式位）两个**分介质**的变换串。
 * - `ViewportCanvasShell`：三栏业务画布壳（左面板 + 舞台 + 右面板）。
 * - `useViewportHostBridge`：宿主自绘坐标桥（client→world）。
 * - 相机数学基于 `@main-ui/core/rendering`（原 viewport-2d-kit 吸收后的官方基座）。
 *
 * 与 `@main-ui/view-world`（PixiJS 图元自动渲染）互补：本模板面向「宿主自绘 SVG/DOM」。
 * 取代已废弃的 `viewport-2d-kit/vue`。
 *
 * **入口纪律**：本包**不转发** `@main-ui/core/*` 的符号。
 * 同一概念只许一条取得路径 —— 转发面会让「该值来自哪里」不可判，
 * 也使契约变更时无法用类型闸门收敛。滚轮判型、灵敏度、相机数学一律
 * 从 `@main-ui/core/input` / `@main-ui/core/rendering` 直接引入。
 */
export * from './types';
export { ViewportCanvas } from './ViewportCanvas';
export { ViewportCanvasShell, type ViewportCanvasShellProps } from './ViewportCanvasShell';
export { useViewportHostBridge } from './useViewportHostBridge';
export {
  ZOOM_STEP,
  buildHostBridge,
  constrainScale,
  fitCamera,
  panCamera,
  zoomByFactor,
} from './viewport-state';
export { cameraTransformOf } from './viewport-state';
