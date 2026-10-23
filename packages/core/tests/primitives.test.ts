import { describe, expect, it, test } from 'vitest';
import { gridCellCenter, hitTestCircle, hitTestGrid, hitTestPolygon } from '../src/primitives/hitTest';
import {
  batchToPolylineItems,
  batchToTextItems,
  snapshotToItems,
} from '../src/primitives/snapshot';
import type { EntitySnapshot, GridSpec } from '../src/primitives/types';

const grid: GridSpec = { x: 0, y: 0, cols: 8, rows: 8, cellWidth: 60, cellHeight: 60 };

describe('core/primitives hitTest', () => {
  test('hitTestGrid maps world to col/row', () => {
    expect(hitTestGrid(0, 0, grid)).toEqual({ col: 0, row: 0 });
    expect(hitTestGrid(65, 130, grid)).toEqual({ col: 1, row: 2 });
    expect(hitTestGrid(479, 479, grid)).toEqual({ col: 7, row: 7 });
  });

  test('hitTestGrid returns null out of bounds', () => {
    expect(hitTestGrid(-1, 10, grid)).toBeNull();
    expect(hitTestGrid(480, 10, grid)).toBeNull();
  });

  test('gridCellCenter returns the center of a cell', () => {
    expect(gridCellCenter(grid, 0, 0)).toEqual({ x: 30, y: 30 });
    expect(gridCellCenter(grid, 2, 3)).toEqual({ x: 150, y: 210 });
  });

  test('hitTestCircle / hitTestPolygon', () => {
    expect(hitTestCircle(1, 1, 0, 0, 2)).toBe(true);
    expect(hitTestCircle(3, 0, 0, 0, 2)).toBe(false);
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(hitTestPolygon(5, 5, square)).toBe(true);
    expect(hitTestPolygon(15, 5, square)).toBe(false);
  });
});

describe('core/primitives snapshot parsing', () => {
  test('batchToTextItems reads columnar data', () => {
    const items = batchToTextItems({
      kind: 'pieces',
      count: 2,
      geometry: 'text',
      columns: { x: [30, 90], y: [30, 30], text: ['♜', '♞'], color: [0x000000, 0xffffff] },
    });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ x: 30, y: 30, text: '♜', color: 0x000000 });
    expect(items[1]).toMatchObject({ x: 90, text: '♞', color: 0xffffff });
  });

  test('batchToTextItems skips empty text', () => {
    const items = batchToTextItems({
      kind: 'pieces', count: 2, geometry: 'text',
      columns: { x: [30, 90], y: [30, 30], text: ['♜', ''] },
    });
    expect(items).toHaveLength(1);
  });

  test('snapshotToItems groups by geometry', () => {
    const snapshot: EntitySnapshot = {
      bounds: { x: 0, y: 0, width: 480, height: 480 },
      tick: 3,
      batches: {
        labels: { kind: 'labels', count: 1, geometry: 'text', columns: { x: [10], y: [10], text: ['a'] } },
        tokens: { kind: 'tokens', count: 1, geometry: 'point', columns: { x: [20], y: [20], color: [0xff0000] } },
        zones: { kind: 'zones', count: 1, geometry: 'polygon', columns: { points: [[0, 0, 1, 0, 1, 1]] } },
      },
    };
    const items = snapshotToItems(snapshot);
    expect(items.texts).toHaveLength(1);
    expect(items.sprites).toHaveLength(1);
    expect(items.sprites[0].shape).toBe('circle'); // point geometry -> circle
    expect(items.polygons).toHaveLength(1);
    expect(items.polygons[0].points).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
  });
});

describe('polyline 折线图元', () => {
  const batch = (columns: Record<string, unknown[]>, count: number) =>
    ({ kind: 'road', count, geometry: 'polyline' as const, columns });

  it('batchToPolylineItems 解析扁平坐标', () => {
    const items = batchToPolylineItems(
      batch({ points: [[0, 0, 10, 0, 10, 10]] }, 1),
    );
    expect(items).toHaveLength(1);
    expect(items[0].points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
  });

  it('batchToPolylineItems 解析对象坐标', () => {
    const items = batchToPolylineItems(
      batch({ points: [[{ x: 1, y: 2 }, { x: 3, y: 4 }]] }, 1),
    );
    expect(items[0].points).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
  });

  it('少于两个点则跳过（无法构成折线）', () => {
    expect(batchToPolylineItems(batch({ points: [[5, 5]] }, 1))).toHaveLength(0);
  });

  it('缺省为开放折线（closed=false）', () => {
    const items = batchToPolylineItems(batch({ points: [[0, 0, 1, 1]] }, 1));
    expect(items[0].closed).toBe(false);
  });

  it('读取 closed 列', () => {
    const items = batchToPolylineItems(
      batch({ points: [[0, 0, 1, 1]], closed: [true] }, 1),
    );
    expect(items[0].closed).toBe(true);
  });

  it('读取描边与顶点配置', () => {
    const items = batchToPolylineItems(
      batch(
        {
          points: [[0, 0, 1, 1]],
          stroke: [0xff0000],
          strokeWidth: [2],
          vertexRadius: [3],
          vertexColor: [0x00ff00],
        },
        1,
      ),
    );
    expect(items[0].stroke).toBe(0xff0000);
    expect(items[0].strokeWidth).toBe(2);
    expect(items[0].vertexRadius).toBe(3);
    expect(items[0].vertexColor).toBe(0x00ff00);
  });

  it('snapshotToItems 把 polyline 批次归入 polylines', () => {
    const snapshot: EntitySnapshot = {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      batches: {
        road: batch({ points: [[0, 0, 10, 10]] }, 1),
      },
    };
    const items = snapshotToItems(snapshot);
    expect(items.polylines).toHaveLength(1);
    expect(items.polygons).toHaveLength(0);
  });
});
