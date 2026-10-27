import { describe, expect, test } from 'vitest';
import {
  batchToPolygonItems,
  batchToPolylineItems,
  batchToSpriteItems,
  batchToTextItems,
  snapshotToItems,
} from '../src/primitives/snapshot';
import type { EntityBatch, EntitySnapshot } from '../src/primitives/types';

/**
 * WP1 数据契约升维的回归用例。
 *
 * 判据：带 `z` / `extrude` 的快照在**二维图元解析层**产出的项，
 * 除新增的可选字段外与不带时逐字段一致 —— 二维图元渲染器只读已知字段，
 * 因此渲染结果逐像素一致。
 */

const baseSpriteBatch: EntityBatch = {
  kind: 'pieces',
  count: 2,
  geometry: 'point',
  columns: {
    x: [10, 20],
    y: [30, 40],
    width: [8, 8],
    height: [8, 8],
    color: [0x112233, 0x445566],
  },
};

const basePolygonBatch: EntityBatch = {
  kind: 'tiles',
  count: 1,
  geometry: 'polygon',
  columns: {
    points: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]],
    fill: [0x00ff00],
    strokeWidth: [2],
  },
};

describe('core/primitives 升维字段：z', () => {
  test('不带 z 列时不产生 z 字段', () => {
    const [first] = batchToSpriteItems(baseSpriteBatch);
    expect(first).not.toHaveProperty('z');
  });

  test('带 z 列时逐项搬运（值为 0 也保留）', () => {
    const batch: EntityBatch = {
      ...baseSpriteBatch,
      columns: { ...baseSpriteBatch.columns, z: [0, 5] },
    };
    const items = batchToSpriteItems(batch);
    expect(items[0].z).toBe(0);
    expect(items[1].z).toBe(5);
  });

  test('除 z 外其余字段与不带 z 时完全一致', () => {
    const withZ: EntityBatch = {
      ...baseSpriteBatch,
      columns: { ...baseSpriteBatch.columns, z: [0, 0] },
    };
    const without = batchToSpriteItems(baseSpriteBatch);
    const withZItems = batchToSpriteItems(withZ).map(({ z: _z, ...rest }) => rest);
    expect(withZItems).toEqual(without);
  });

  test('文字 / 多边形 / 折线同样只在有 z 列时才带字段', () => {
    const textBatch: EntityBatch = {
      kind: 'labels', count: 1, geometry: 'text',
      columns: { x: [0], y: [0], text: ['A'] },
    };
    expect(batchToTextItems(textBatch)[0]).not.toHaveProperty('z');

    const textWithZ: EntityBatch = {
      ...textBatch, columns: { ...textBatch.columns, z: [3] },
    };
    expect(batchToTextItems(textWithZ)[0].z).toBe(3);

    expect(batchToPolygonItems(basePolygonBatch)[0]).not.toHaveProperty('z');
    expect(batchToPolylineItems({
      kind: 'path', count: 1, geometry: 'polyline',
      columns: { points: [[{ x: 0, y: 0 }, { x: 1, y: 1 }]], z: [2] },
    })[0].z).toBe(2);
  });
});

describe('core/primitives 升维字段：extrude', () => {
  test('不带 extrude 列时不产生字段', () => {
    expect(batchToSpriteItems(baseSpriteBatch)[0]).not.toHaveProperty('extrude');
    expect(batchToPolygonItems(basePolygonBatch)[0]).not.toHaveProperty('extrude');
  });

  test('带 extrude 列时搬运到精灵与多边形项', () => {
    const sprite = batchToSpriteItems({
      ...baseSpriteBatch,
      columns: { ...baseSpriteBatch.columns, extrude: [4, 2] },
    });
    expect(sprite.map((s) => s.extrude)).toEqual([4, 2]);

    const polygon = batchToPolygonItems({
      ...basePolygonBatch,
      columns: { ...basePolygonBatch.columns, extrude: [6] },
    });
    expect(polygon[0].extrude).toBe(6);
  });
});

describe('core/primitives 升维字段：snapshot.dimensions', () => {
  test('dimensions 为可选，缺省不写入任何字段', () => {
    const snapshot: EntitySnapshot = {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      batches: { pieces: baseSpriteBatch },
    };
    expect(snapshot.dimensions).toBeUndefined();
  });

  test('dimensions=3 的快照在二维图元解析中与 dimensions=2 产出同构', () => {
    const base: EntitySnapshot = {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      batches: { pieces: baseSpriteBatch, tiles: basePolygonBatch },
    };
    const flat = snapshotToItems({ ...base, dimensions: 2 });
    const spatial = snapshotToItems({ ...base, dimensions: 3 });
    expect(spatial).toEqual(flat);
  });
});
