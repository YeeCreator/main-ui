import React from 'react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

/**
 * 数据表格面板属性。
 *
 * @typeParam TData 行数据类型。
 */
export type DataTablePanelProps<TData extends object> = {
  /** 面板标题。 */
  title?: string;
  /** 表格数据。 */
  data: TData[];
  /** TanStack 列定义。 */
  columns: ColumnDef<TData, unknown>[];
  /** 初始分页大小。 */
  initialPageSize?: number;
  /** 空数据提示文案。 */
  emptyText?: string;
  /** 外层样式。 */
  style?: React.CSSProperties;
};

/**
 * 数据条目管理面板（TanStack Table 语义壳层）。
 *
 * @typeParam TData 行数据类型。
 * @param props 面板属性。
 * @returns 数据条目管理面板。
 *
 * @example
 * ```tsx
 * type Row = { id: string; name: string };
 *
 * <DataTablePanel<Row>
 *   title="配置列表"
 *   data={[{ id: '1', name: '示例' }]}
 *   columns=[
 *     { accessorKey: 'id', header: 'ID' },
 *     { accessorKey: 'name', header: '名称' },
 *   ]
 * />
 * ```
 */
export function DataTablePanel<TData extends object>(props: DataTablePanelProps<TData>): React.JSX.Element {
  const { title = '数据列表', data, columns, initialPageSize = 10, emptyText = '暂无数据', style } = props;

  const [globalFilter, setGlobalFilter] = React.useState<string>('');
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: initialPageSize });

  const table = useReactTable<TData>({
    data,
    columns,
    state: {
      globalFilter,
      pagination,
    },
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <section
      style={{
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 10,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: '#fff',
        ...style,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 14 }}>{title}</strong>
        <input
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder="搜索..."
          aria-label="搜索"
          style={{ height: 30, border: '1px solid rgba(0,0,0,0.2)', borderRadius: 8, padding: '0 10px', width: 220 }}
        />
      </header>

      <div style={{ overflow: 'auto', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{
                      textAlign: 'left',
                      borderBottom: '1px solid rgba(0,0,0,0.12)',
                      padding: '8px 10px',
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={table.getAllLeafColumns().length || 1} style={{ padding: 16, fontSize: 13, color: '#666' }}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '8px 10px', fontSize: 13 }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#666' }}>
          第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1} 页
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            上一页
          </button>
          <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            下一页
          </button>
          <select
            aria-label="每页条数"
            value={table.getState().pagination.pageSize}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>
                每页 {size}
              </option>
            ))}
          </select>
        </div>
      </footer>
    </section>
  );
}
