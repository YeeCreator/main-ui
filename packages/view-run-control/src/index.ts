/**
 * @main-ui/view-run-control —— 通用运行控制视图模板（MUI 控制视图）。
 *
 * - 呈现：运行状态（idle/running/paused）、速率、tick。
 * - 操作意图（Emits）：play / pause / step / reset / rate-change。
 * - 独立性：全部为通用仿真/控制语义，不含任何游戏或领域专属术语。
 * - 契约：实现 MainUiViewLifecycle 四成员（本地速率草稿进视图状态）。
 */
export * from './types';
export {
  clampRate,
  computeRunControlAvailability,
  normalizeRunControlStatus,
  parseRate,
} from './state';
export { RunControlView } from './RunControlView';
export {
  RUN_CONTROL_VIEW_EDITOR_KIND,
  RUN_CONTROL_VIEW_RENDERER_KEY,
  createRunControlViewEditorDescriptor,
  createRunControlViewEditorRenderer,
  registerRunControlViewEditor,
  type RunControlViewRuntimeLike,
  type RunControlViewEditorOptions,
  type EditorRenderContextLike,
} from './register';
