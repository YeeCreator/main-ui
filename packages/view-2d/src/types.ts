/**
 * @main-ui/view-2d 数据契约：宿主适配层负责取数并经 Props 注入（viewBox / 渲染参数），
 * 世界内容绘制由宿主在 `ready` 事件拿到 viewport 后完成；视图只管理相机与抛出意图。
 */

/** 可序列化的相机状态（世界→屏幕：screen = pan + world * scale）。 */
export type View2dCameraState = {
  scale: number;
  pan: { x: number; y: number };
};

/** 世界范围（首次打开时相机会 fit 到此范围）。 */
export type View2dViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** 视图状态契约（MainUiViewLifecycle.getViewState 的产出形态）：相机进快照。 */
export type View2dState = {
  camera: View2dCameraState;
};

/** 默认世界范围。 */
export const DEFAULT_VIEW_2D_VIEWBOX: View2dViewBox = { x: -160, y: -120, width: 680, height: 420 };
