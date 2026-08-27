/**
 * 兼容导出：旧的自研 Viewport2D 入口。
 *
 * @deprecated 建议迁移到模式化入口：`ViewportLite` 或 `ViewportModeHost`。
 */
export { Viewport2D } from '../Viewport2D';
export type { Viewport2DProps, Viewport2DChildrenArgs } from '../Viewport2D';
export type { Viewport2DController, Viewport2DCamera, Vec2 } from '../types';

export { installPreventPageZoom } from '../preventPageZoom';
export type { ViewBox, Camera2D } from '../viewportMath';
export {
  cameraToCssTransform,
  clamp,
  fitCameraToViewBox,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAtScreenPoint,
} from '../viewportMath';

export type { CameraConstraints } from '../constraints';
export { constrainCamera } from '../constraints';

export type { SerializedCamera2D, ViewportController } from '../controller';
export { serializeCamera, deserializeCamera, createViewportController } from '../controller';

export type { AnimateCameraOptions, EasingFn } from '../animation';
export { animateCamera, easeInOutCubic, easeOutCubic } from '../animation';

export {
  applyCameraToCanvas2D,
  cameraToSvgMatrix,
  getHiDpiCanvasPixelSize,
  getVisibleWorldBox,
  normalizeViewportPxRect,
  screenDeltaToWorldDelta,
} from '../renderers';

export {
  createViewportInteractions,
} from '../interactions';
export type {
  CreateViewportInteractionsOptions,
  ViewportCameraApi,
  ViewportInteractionMode,
  ViewportPointerEventLike,
  ViewportRect,
  ViewportWheelEventLike,
} from '../interactions';

export { useViewportCamera } from '../useViewportCamera';
export type { UseViewportCameraOptions } from '../useViewportCamera';

/**
 * 模式化导出：按场景选择引擎。
 */
export type {
  ViewportEngineDescriptor,
  ViewportModeCamera,
  ViewportModeController,
  ViewportModeKind,
} from '../modes';
export {
  ViewportLite,
  ViewportModeHost,
  listViewportEngineDescriptors,
  resolveViewportEngine,
} from '../modes';
export type { ViewportLiteController, ViewportLiteProps, ViewportModeHostProps } from '../modes';

export type { LegacyCamera, CssPoint, WorldPoint } from '../coordinateAdapters';
export {
  camera2DToLegacy,
  legacyToCamera2D,
  getDprScaleFromCanvas,
  localCssPxToCanvasPx,
  canvasPxToLocalCssPx,
  clientToLocalCssPoint,
  localCssToWorkspaceCss,
  workspaceCssToLocalCss,
  worldToWorkspaceCss,
  localCssToWorld,
  worldToLocalCss,
  worldToLocalCssWithScroll,
} from '../coordinateAdapters';
