import { describe, expect, it } from 'vitest';
import {
  computeAssetRowWindow,
  filterAssets,
  nextSelection,
  normalizeLayout,
  pruneSelection,
  resolveGridColumns,
} from '../src/asset';
import type { AssetItem } from '../src/types';

const item = (id: string, title: string, extra: Partial<AssetItem> = {}): AssetItem => ({
  id, title, ...extra,
});

describe('resolveGridColumns · 断点解析', () => {
  it('按容器宽度返回列数', () => {
    expect(resolveGridColumns(1300)).toBe(6);
    expect(resolveGridColumns(1000)).toBe(5);
    expect(resolveGridColumns(800)).toBe(4);
    expect(resolveGridColumns(500)).toBe(3);
    expect(resolveGridColumns(300)).toBe(2);
  });

  it('非法宽度回退 1 列（不抛错）', () => {
    expect(resolveGridColumns(0)).toBe(1);
    expect(resolveGridColumns(-10)).toBe(1);
    expect(resolveGridColumns(Number.NaN)).toBe(1);
  });

  it('断点边界值归入较高列数', () => {
    expect(resolveGridColumns(960)).toBe(5);
    expect(resolveGridColumns(959)).toBe(4);
  });
});

describe('computeAssetRowWindow · 网格行窗口', () => {
  it('空内容返回零窗口', () => {
    expect(computeAssetRowWindow(0, 400, 132, 0)).toEqual({ start: 0, end: 0, totalHeight: 0 });
  });

  it('总高度按行数计算', () => {
    expect(computeAssetRowWindow(0, 400, 132, 10).totalHeight).toBe(1320);
  });

  it('overscan 生效（上下各多渲染）', () => {
    const window = computeAssetRowWindow(264, 264, 132, 100, 2);
    expect(window.start).toBe(0); // 第 2 行 - 2 = 0
    expect(window.end).toBe(6);   // 2 + 2 + 2
  });

  it('滚到底部时不越界', () => {
    const window = computeAssetRowWindow(999999, 264, 132, 10, 2);
    expect(window.end).toBe(10);
    // start 必须钳制在合法行号内，不能超过 totalRows
    expect(window.start).toBeLessThanOrEqual(10);
    expect(window.start).toBeGreaterThanOrEqual(0);
  });

  it('末屏首行不会被 overscan 推到末尾之外', () => {
    // 10 行、视口 2 行、overscan 2 → 末屏首行应为 max(0, 10-2-2)=6
    const window = computeAssetRowWindow(999999, 264, 132, 10, 2);
    expect(window.start).toBe(6);
    expect(window.end).toBe(10);
  });

  it('行高为 0 时回退 1，不产生除零', () => {
    expect(() => computeAssetRowWindow(0, 400, 0, 5)).not.toThrow();
  });
});

describe('filterAssets · 文本过滤', () => {
  const items = [
    item('1', 'Rock', { description: 'Granite texture', badges: ['png'] }),
    item('2', 'Tree', { description: 'Pine model', badges: ['glb'] }),
    item('3', 'Sky'),
  ];

  it('空白关键词返回全部（并保持顺序）', () => {
    expect(filterAssets(items, '   ').map((i) => i.id)).toEqual(['1', '2', '3']);
  });

  it('匹配标题（不区分大小写）', () => {
    expect(filterAssets(items, 'roc').map((i) => i.id)).toEqual(['1']);
  });

  it('匹配描述', () => {
    expect(filterAssets(items, 'pine').map((i) => i.id)).toEqual(['2']);
  });

  it('匹配徽标', () => {
    expect(filterAssets(items, 'glb').map((i) => i.id)).toEqual(['2']);
  });

  it('无命中返回空数组', () => {
    expect(filterAssets(items, 'zzz')).toEqual([]);
  });

  it('不修改入参', () => {
    const before = items.length;
    filterAssets(items, 'rock');
    expect(items).toHaveLength(before);
  });
});

describe('nextSelection · 选中集语义', () => {
  it('普通点击只选中该项', () => {
    expect(nextSelection(['a', 'b'], 'c', false)).toEqual(['c']);
  });

  it('修饰键点击追加', () => {
    expect(nextSelection(['a'], 'b', true)).toEqual(['a', 'b']);
  });

  it('修饰键点击已选中项则移除', () => {
    expect(nextSelection(['a', 'b'], 'b', true)).toEqual(['a']);
  });

  it('不修改入参', () => {
    const current = ['a'];
    nextSelection(current, 'b', true);
    expect(current).toEqual(['a']);
  });
});

describe('pruneSelection · 选中集裁剪', () => {
  const items = [item('a', 'A'), item('b', 'B')];

  it('剔除已不存在的 id', () => {
    expect(pruneSelection(['a', 'gone'], items)).toEqual(['a']);
  });

  it('全部存在时原样返回', () => {
    expect(pruneSelection(['a', 'b'], items)).toEqual(['a', 'b']);
  });

  it('空数据源清空选中', () => {
    expect(pruneSelection(['a'], [])).toEqual([]);
  });
});

describe('normalizeLayout · 布局校验', () => {
  it('list 保留，未知值回退 grid', () => {
    expect(normalizeLayout('list')).toBe('list');
    expect(normalizeLayout('grid')).toBe('grid');
    expect(normalizeLayout('masonry')).toBe('grid');
    expect(normalizeLayout(null)).toBe('grid');
    expect(normalizeLayout(undefined)).toBe('grid');
  });
});
