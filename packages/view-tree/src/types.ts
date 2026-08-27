/**
 * @main-ui/view-tree 数据契约：宿主适配层负责取数并转成此契约经 Props 注入，
 * 视图只呈现与抛出操作意图（Emits），绝不发起网络请求。
 */

/** 树节点（嵌套结构；children 省略视为叶子）。 */
export type ViewTreeNode = {
  id: string;
  label: string;
  icon?: string;
  children?: ViewTreeNode[];
};

/** 树视图 Props 契约（含 loading / error 三态）。 */
export type TreeViewProps = {
  /** 数据经 Props 注入；适配层负责取数与结构转换 */
  items: ViewTreeNode[];
  loading?: boolean;
  error?: string | null;
  /** 受控选中；省略时由视图内部管理 */
  selectedId?: string | null;
  /** 受控展开集合；省略时由视图内部管理 */
  expandedIds?: string[];
  /** 是否显示搜索过滤框 */
  filterable?: boolean;
  /** 虚拟滚动行高（px） */
  itemHeight?: number;
  /** 在 main-ui 内作为编辑器表面挂载时传入编辑实例 id，用于登记视图生命周期契约 */
  editorInstanceId?: string;
};

/** 树视图 Emits 契约：操作意图一律抛出，由宿主裁决。 */
export type TreeViewEmits = {
  (event: 'select', nodeId: string): void;
  (event: 'toggle', nodeId: string, expanded: boolean): void;
  (event: 'filter-change', keyword: string): void;
};

/** 视图状态契约（MainUiViewLifecycle.getViewState 的产出形态）。 */
export type TreeViewState = {
  expandedIds: string[];
  selectedId: string | null;
  filter: string;
  scrollTop: number;
};

export const DEFAULT_TREE_ITEM_HEIGHT = 26;
