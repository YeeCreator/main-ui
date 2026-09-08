/**
 * @main-ui/view-storyboard —— 通用分镜/截图/注释视图模板（MUI 控制视图）。
 *
 * - 呈现：卡片列表（截图 + tick + 可编辑注释）、注释草稿、添加/导出操作。
 * - 增删改意图（Emits）：add-card / remove-card / update-note / update-draft / export。
 * - 独立性：全部为通用分镜语义，不含任何游戏或领域专属术语；截图由宿主生成回填。
 * - 契约：实现 MainUiViewLifecycle 四成员（本地注释草稿进视图状态）。
 */
export * from './types';
export {
  removeCard,
  serializeStoryboard,
  sortCardsByTick,
  updateCardNote,
} from './state';
export { StoryboardView } from './StoryboardView';
export {
  STORYBOARD_VIEW_EDITOR_KIND,
  STORYBOARD_VIEW_RENDERER_KEY,
  createStoryboardViewEditorDescriptor,
  createStoryboardViewEditorRenderer,
  registerStoryboardViewEditor,
  type StoryboardViewRuntimeLike,
  type StoryboardViewEditorOptions,
  type EditorRenderContextLike,
} from './register';
