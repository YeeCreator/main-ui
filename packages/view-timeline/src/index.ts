/**
 * @main-ui/view-timeline —— 通用时间轴/回放视图模板（MUI 控制视图）。
 *
 * - 呈现：帧序列滑块、当前帧 tick/time/label、进度、实时指示。
 * - 定位意图（Emits）：scrub（拖拽中）/ seek（提交）/ live（回到实时）。
 * - 独立性：全部为通用时间轴语义，不含任何游戏或领域专属术语。
 * - 契约：实现 MainUiViewLifecycle 四成员（本地定位索引进视图状态）。
 */
export * from './types';
export {
  clampIndex,
  computeTimelineProgress,
  computeTimelineTotalTicks,
  formatTimelineTime,
  normalizeCurrentIndex,
  resolveTimelineFrame,
} from './state';
export { TimelineView } from './TimelineView';
export {
  TIMELINE_VIEW_EDITOR_KIND,
  TIMELINE_VIEW_RENDERER_KEY,
  createTimelineViewEditorDescriptor,
  createTimelineViewEditorRenderer,
  registerTimelineViewEditor,
  type TimelineViewRuntimeLike,
  type TimelineViewEditorOptions,
  type EditorRenderContextLike,
} from './register';
