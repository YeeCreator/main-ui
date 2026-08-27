import type { TableRow, TableSort } from './types';
import { computeVirtualWindow } from '@main-ui/core';

/** 取单元格显示值（null/undefined 归一为空串）。 */
export const getCellValue = (row: TableRow, columnKey: string): unknown => row[columnKey];

const compareValues = (a: unknown, b: unknown): number => {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''));
};

/**
 * 按排序状态稳定排序（纯函数，可单测）：
 * `null` 时保持注入顺序；同值保持原相对顺序。
 */
export const sortRows = (rows: TableRow[], sort: TableSort): TableRow[] => {
  if (!sort) return rows.slice();
  const direction = sort.direction === 'desc' ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const result = compareValues(left.row[sort.key], right.row[sort.key]) * direction;
      return result !== 0 ? result : left.index - right.index;
    })
    .map((entry) => entry.row);
};

/** 解析行标识（缺省字段回退行索引）。 */
export const resolveRowId = (row: TableRow, index: number, rowKey: string): string => {
  const value = row[rowKey];
  return value === undefined || value === null ? String(index) : String(value);
};

/** 排序循环：无 → asc → desc → 无（纯函数，可单测）。 */
export const nextSort = (current: TableSort, key: string): TableSort => {
  if (!current || current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
};

/** 虚拟滚动窗口计算（纯函数，可单测）：委托 @main-ui/core 公共基座。 */
export const computeTableRowWindow = (
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  totalCount: number,
  overscan = 4,
): { start: number; end: number; totalHeight: number } => {
  const result = computeVirtualWindow(scrollTop, viewportHeight, rowHeight, totalCount, overscan);
  return { start: result.start, end: result.end, totalHeight: result.totalHeight };
};
