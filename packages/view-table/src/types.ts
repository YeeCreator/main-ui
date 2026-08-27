/**
 * @main-ui/view-table 数据契约：宿主适配层负责取数并转成列定义 + 行数据经 Props 注入，
 * 视图只呈现与抛出操作意图（Emits），绝不发起网络请求。
 */

/** 列定义。 */
export type TableColumn = {
  key: string;
  title: string;
  /** 固定列宽（px）；省略时按 flex 均分 */
  width?: number;
  align?: 'left' | 'right' | 'center';
  /** 允许点击表头排序 */
  sortable?: boolean;
};

/** 行数据（键值表；行标识由 `rowKey` 指定，默认 'id'）。 */
export type TableRow = Record<string, unknown>;

export type TableSortDirection = 'asc' | 'desc';

/** 排序状态；`null` 表示不排序（恢复注入顺序）。 */
export type TableSort = { key: string; direction: TableSortDirection } | null;

/** 单元格编辑意图载荷：由宿主裁决是否落库。 */
export type TableCellEditIntent = {
  rowId: string;
  columnKey: string;
  value: string;
};

/** 视图状态契约（MainUiViewLifecycle.getViewState 的产出形态）。 */
export type TableViewState = {
  scrollTop: number;
  selectedRowId: string | null;
  sort: TableSort;
};

export const DEFAULT_TABLE_ROW_HEIGHT = 28;
