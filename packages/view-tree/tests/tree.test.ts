import { describe, expect, it } from 'vitest';
import { computeVirtualWindow, flattenTree } from '../src/tree';
import type { ViewTreeNode } from '../src/types';

const items: ViewTreeNode[] = [
  {
    id: 'root',
    label: 'Root',
    children: [
      { id: 'child-a', label: 'Child A' },
      {
        id: 'child-b',
        label: 'Child B',
        children: [{ id: 'grand', label: 'Grand Leaf' }],
      },
    ],
  },
  { id: 'sibling', label: 'Sibling' },
];

describe('flattenTree', () => {
  it('只展开显式展开的节点', () => {
    const rows = flattenTree(items, new Set(['root']));
    expect(rows.map((row) => row.node.id)).toEqual(['root', 'child-a', 'child-b', 'sibling']);
    expect(rows[0]?.depth).toBe(0);
    expect(rows[1]?.depth).toBe(1);
    expect(rows[2]?.expanded).toBe(false);
  });

  it('递归展开并携带深度', () => {
    const rows = flattenTree(items, new Set(['root', 'child-b']));
    expect(rows.map((row) => row.node.id)).toEqual(['root', 'child-a', 'child-b', 'grand', 'sibling']);
    expect(rows[3]?.depth).toBe(2);
  });

  it('过滤时自动展开命中路径', () => {
    const rows = flattenTree(items, new Set(), 'grand');
    expect(rows.map((row) => row.node.id)).toEqual(['root', 'child-b', 'grand']);
  });

  it('过滤大小写不敏感且剔除未命中子树', () => {
    const rows = flattenTree(items, new Set(['root']), 'CHILD A');
    expect(rows.map((row) => row.node.id)).toEqual(['root', 'child-a']);
  });

  it('空关键词等价于不过滤', () => {
    const rows = flattenTree(items, new Set(), '   ');
    expect(rows.map((row) => row.node.id)).toEqual(['root', 'sibling']);
  });
});

describe('computeVirtualWindow', () => {
  it('空列表返回零窗口', () => {
    expect(computeVirtualWindow(0, 500, 26, 0)).toEqual({ start: 0, end: 0, offsetY: 0, totalHeight: 0 });
  });

  it('顶部视口从 0 开始并带缓冲', () => {
    const win = computeVirtualWindow(0, 260, 26, 1000, 4);
    expect(win.start).toBe(0);
    expect(win.end).toBe(18); // 10 可见 + 8 后置缓冲（起点被 0 钳制）
    expect(win.totalHeight).toBe(26000);
  });

  it('中部滚动按 overscan 前后扩窗并计算偏移', () => {
    const win = computeVirtualWindow(2600, 260, 26, 1000, 4);
    expect(win.start).toBe(96); // 100 - 4
    expect(win.end).toBe(114); // 96 + 10 + 8
    expect(win.offsetY).toBe(96 * 26);
  });

  it('底部滚动钳制到总数', () => {
    const win = computeVirtualWindow(25740, 260, 26, 1000, 4);
    expect(win.end).toBe(1000);
    expect(win.start).toBeLessThan(1000);
  });

  it('非法行高返回零窗口', () => {
    expect(computeVirtualWindow(0, 500, 0, 100)).toEqual({ start: 0, end: 0, offsetY: 0, totalHeight: 0 });
  });
});
