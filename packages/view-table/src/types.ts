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
  /** 最小列宽（px，仅列宽可拉伸时生效） */
  minWidth?: number;
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
  /** 多选集（仅多选模式启用时有实际意义） */
  selectedRowIds: string[];
  sort: TableSort;
  /** 用户拉伸后的列宽（key → px；未拉伸的列不出现） */
  columnWidths: Record<string, number>;
};

/** 列宽变更意图载荷。 */
export type TableColumnResizeIntent = {
  columnKey: string;
  /** 新宽度（已钳制到 minWidth） */
  width: number;
};

export const DEFAULT_TABLE_ROW_HEIGHT = 28;

/** 列宽拖动的最小像素（避免拖成零宽无法恢复）。 */
export const MIN_COLUMN_WIDTH = 40;
