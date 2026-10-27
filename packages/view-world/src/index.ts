/**
 * @main-ui/view-world —— 世界可视化视图模板（MUI L1 中级游戏引擎层，**后端无关**）。
 *
 * - 自动渲染：消费通用 EntitySnapshot + GridSpec，交后端渲染图元。
 * - 手动模式：`@ready` 逃生舱，宿主拿后端无关最小句柄（尺寸 / 根对象 / requestRender）。
 * - InteractionLayer：点击/拖拽 + screen→world 命中，抛出 world/cell 意图。
 * - 后端：`ViewportBackend` 抽象（设计 §十九 2–3）。二维缺省走 Pixi（core 内实现），
 *   三维由宿主注入 `@main-ui/render-3d`。**模板不 import 任何渲染库**。
 * - 维度开关：`dimension` 变化时只换后端，组件实例不销毁、相机态连续。
 */
export * from './types';
export {
  buildWorldViewState,
  parseCssColorToNumber,
  sanitizeCameraState,
  toCamera2D,
} from './world-state';
export { WorldView, PIXI_BACKEND_KEY, THREE_BACKEND_KEY } from './WorldView';
export { useWorldDimension, type WorldDimensionController } from './useWorldDimension';
export { WorldDimensionToggle } from './WorldDimensionToggle';
export {
  registerThreeBackend,
  mergeBackends,
  type RegisterThreeBackendOptions,
} from './registerThreeBackend';
export {
  createWorldStageRenderer,
  type CreateWorldStageRendererOptions,
  type WorldStagePayload,
  type WorldStageRenderContextLike,
} from './worldStageEditor';
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
