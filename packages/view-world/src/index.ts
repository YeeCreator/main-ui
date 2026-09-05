/**
 * @main-ui/view-world —— 2D 世界可视化视图模板（MUI L1 中级游戏引擎层）。
 *
 * - 自动渲染：消费通用 EntitySnapshot + GridSpec，自动渲染 Grid/Sprite/Text/Polygon 图元。
 * - 手动模式：@ready 逃生舱，宿主直接操作 PixiJS world 容器（取代已废弃的 view-2d）。
 * - InteractionLayer：点击/拖拽 + screen→world 命中，抛出 world/cell 意图。
 * - 内核：@main-ui/core/rendering 的 PixiViewport（PixiJS WebGL，唯一 2D 渲染核心）。
 */
export * from './types';
export {
  buildWorldViewState,
  parseCssColorToNumber,
  sanitizeCameraState,
  toCamera2D,
} from './world-state';
export { WorldView } from './WorldView';
export {
  WORLD_VIEW_EDITOR_KIND,
  WORLD_VIEW_RENDERER_KEY,
  createWorldViewEditorDescriptor,
  createWorldViewEditorRenderer,
  registerWorldViewEditor,
  type WorldViewRuntimeLike,
  type WorldViewEditorOptions,
  type WorldEditorRenderContextLike,
} from './register';
