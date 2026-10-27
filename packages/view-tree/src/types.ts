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
  /**
   * 多选模式开关（opt-in，缺省 false = 单选，行为与此前完全一致）。
   *
   * 开启后 `selectedIds` 生效，`selectedId` 仍表示「最后单点的那一个」——
   * 两者并存而不是互斥：宿主做属性面板绑定时通常需要一个主选中项。
   */
  multiSelect?: boolean;
  /** 受控多选集（仅在 `multiSelect` 为真时生效） */
  selectedIds?: string[];
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
  /**
   * 多选集变更（仅在 `multiSelect` 开启时抛）。
   *
   * 与 `select` 的关系：单选与多选**同时**抛——`select` 供主选中消费，
   * `selection-change` 供批量操作消费。不让宿主从其中一个推导另一个，
   * 是因为推导规则（点空区是否清空、Shift 是否连选）属于视图语义。
   */
  (event: 'selection-change', selectedIds: string[]): void;
};

/** 视图状态契约（MainUiViewLifecycle.getViewState 的产出形态）。 */
export type TreeViewState = {
  expandedIds: string[];
  selectedId: string | null;
  /** 多选集（仅在多选模式下有实际意义） */
  selectedIds: string[];
  filter: string;
  scrollTop: number;
};

export const DEFAULT_TREE_ITEM_HEIGHT = 26;
