import type { ColumnDef } from '@tanstack/react-table';
import type { DataTableAdapter, DataTableColumn } from './types';

/**
 * TanStack 表格上下文。
 *
 * @typeParam TItem 行数据类型。
 */
export type TanStackTableContext<TItem extends object> = {
  /** 原始数据。 */
  data: TItem[];
  /** TanStack 列定义。 */
  columns: Array<ColumnDef<TItem>>;
};

/**
 * 将通用列契约转换为 TanStack 列定义。
 *
 * @typeParam TItem 行数据类型。
 * @param columns 通用列定义。
 * @returns TanStack 列定义。
 */
export function toTanStackColumns<TItem extends object>(columns: Array<DataTableColumn<TItem>>): Array<ColumnDef<TItem>> {
  return columns.map((column) => ({
    id: column.id,
    header: () => column.header,
    cell: ({ row }) => column.cell(row.original),
  }));
}

/**
 * TanStack 表格适配器实现。
 */
export const tanStackTableAdapter: DataTableAdapter = {
  /**
   * 创建 TanStack 表格上下文。
   *
   * @typeParam TItem 行数据类型。
   * @param options 数据与通用列定义。
   * @returns 表格上下文对象。
   */
  createTableContext<TItem extends object>(options: {
    data: TItem[];
    columns: Array<DataTableColumn<TItem>>;
  }): TanStackTableContext<TItem> {
    return {
      data: options.data,
      columns: toTanStackColumns(options.columns),
    };
  },
};
