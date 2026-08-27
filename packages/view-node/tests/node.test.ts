import { describe, expect, it } from 'vitest';
import { clampNumber, dedupeById, normalizeViewport, pruneDanglingEdges } from '../src/node';
import { DEFAULT_NODE_VIEWPORT } from '../src/types';

describe('view-node 纯函数', () => {
  it('clampNumber 钳制到区间', () => {
    expect(clampNumber(5, 0, 4)).toBe(4);
    expect(clampNumber(-1, 0, 4)).toBe(0);
    expect(clampNumber(2, 0, 4)).toBe(2);
  });

  it('normalizeViewport 回退默认值并钳制 zoom', () => {
    expect(normalizeViewport(null)).toEqual(DEFAULT_NODE_VIEWPORT);
    expect(normalizeViewport(undefined)).toEqual(DEFAULT_NODE_VIEWPORT);
    expect(normalizeViewport({})).toEqual(DEFAULT_NODE_VIEWPORT);
    expect(normalizeViewport({ x: Number.NaN, y: Number.POSITIVE_INFINITY })).toEqual(DEFAULT_NODE_VIEWPORT);
    expect(normalizeViewport({ x: 12, y: -8, zoom: 99 })).toEqual({ x: 12, y: -8, zoom: 4 });
    expect(normalizeViewport({ zoom: 0.001 })).toEqual({ x: 0, y: 0, zoom: 0.1 });
    expect(normalizeViewport({ x: 3, y: 4, zoom: 1.5 })).toEqual({ x: 3, y: 4, zoom: 1.5 });
  });

  it('dedupeById 保留先到者', () => {
    const items = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'a', v: 3 }] as Array<{ id: string; v: number }>;
    expect(dedupeById(items)).toEqual([
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
    ]);
    expect(dedupeById([])).toEqual([]);
  });

  it('pruneDanglingEdges 剔除端点缺失的边', () => {
    const nodeIds = new Set(['n1', 'n2']);
    const edges = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n1', target: 'nx' },
      { id: 'e3', source: 'ny', target: 'n2' },
    ];
    expect(pruneDanglingEdges(edges, nodeIds)).toEqual([{ id: 'e1', source: 'n1', target: 'n2' }]);
    expect(pruneDanglingEdges(edges, new Set())).toEqual([]);
  });
});
