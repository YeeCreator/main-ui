import { describe, expect, it } from 'vitest';
import { computeTableRowWindow, nextSort, resolveRowId, sortRows } from '../src/table';
import type { TableRow } from '../src/types';

const rows: TableRow[] = [
  { id: 'b', name: 'Beta', score: 30 },
  { id: 'a', name: 'Alpha', score: 50 },
  { id: 'c', name: 'Gamma', score: 30 },
];

describe('sortRows', () => {
  it('null 排序保持注入顺序（返回副本）', () => {
    const result = sortRows(rows, null);
    expect(result.map((row) => row.id)).toEqual(['b', 'a', 'c']);
    expect(result).not.toBe(rows);
  });

  it('字符串列升序/降序', () => {
    expect(sortRows(rows, { key: 'name', direction: 'asc' }).map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(sortRows(rows, { key: 'name', direction: 'desc' }).map((row) => row.id)).toEqual(['c', 'b', 'a']);
  });

  it('数值列按数值比较且同值稳定', () => {
    expect(sortRows(rows, { key: 'score', direction: 'asc' }).map((row) => row.id)).toEqual(['b', 'c', 'a']);
    expect(sortRows(rows, { key: 'score', direction: 'desc' }).map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('nextSort', () => {
  it('循环：无 → asc → desc → 无', () => {
    const first = nextSort(null, 'name');
    expect(first).toEqual({ key: 'name', direction: 'asc' });
    const second = nextSort(first, 'name');
    expect(second).toEqual({ key: 'name', direction: 'desc' });
    expect(nextSort(second, 'name')).toBeNull();
  });

  it('切换列重置为 asc', () => {
    expect(nextSort({ key: 'name', direction: 'desc' }, 'score')).toEqual({ key: 'score', direction: 'asc' });
  });
});

describe('resolveRowId', () => {
  it('取指定字段，缺省回退行索引', () => {
    expect(resolveRowId({ id: 'x1' }, 0, 'id')).toBe('x1');
    expect(resolveRowId({ uid: 7 }, 3, 'uid')).toBe('7');
    expect(resolveRowId({}, 9, 'id')).toBe('9');
    expect(resolveRowId({ id: null }, 4, 'id')).toBe('4');
  });
});

describe('computeTableRowWindow', () => {
  it('空表返回零窗口', () => {
    expect(computeTableRowWindow(0, 400, 28, 0)).toEqual({ start: 0, end: 0, totalHeight: 0 });
  });

  it('中部滚动窗口计算正确', () => {
    const win = computeTableRowWindow(2800, 280, 28, 500, 4);
    expect(win.start).toBe(96);
    expect(win.end).toBe(114); // 96 + 10 + 8
    expect(win.totalHeight).toBe(14000);
  });

  it('底部钳制到行数', () => {
    const win = computeTableRowWindow(13720, 280, 28, 500, 4);
    expect(win.end).toBe(500);
  });
});
