/**
 * @main-ui/view-asset —— 资产网格 / 列表视图模板。
 *
 * - 呈现：网格（响应式列数）与列表两种布局、虚拟滚动、搜索过滤、缩略图三态、徽标。
 * - 意图（Emits）：`select` / `selection-change` / `open` / `layout-change`。
 * - 独立性：**零网络** —— 缩略图 URL 与三态状态由宿主注入，模板只塞进 `<img src>`。
 * - 契约：实现 `MainUiViewLifecycle` 四成员（布局 / 选中 / 滚动 / 预览进视图状态），
 *   并实现可选的 `onResize`（尺寸走 main-ui 统一下发，不自挂观察器）。
 */
export * from './types';
export {
  computeAssetRowWindow,
  filterAssets,
  nextSelection,
  normalizeLayout,
  pruneSelection,
  resolveGridColumns,
} from './asset';
export { AssetView } from './AssetView';
export {
  ASSET_VIEW_EDITOR_KIND,
  ASSET_VIEW_RENDERER_KEY,
  createAssetViewEditorDescriptor,
  createAssetViewEditorRenderer,
  registerAssetViewEditor,
  type AssetViewRuntimeLike,
  type AssetViewEditorOptions,
  type EditorRenderContextLike,
} from './register';
