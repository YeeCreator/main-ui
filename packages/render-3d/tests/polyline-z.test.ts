import { describe, expect, test } from 'vitest';
import { polylinePositions } from '../src/geometry-factory';
import { buildScenePlan } from '../src/primitive-plan';
import type { EntitySnapshot } from '@main-ui/core/primitives';

/**
 * 折线的**逐点 `z`**：三维弧必须画成三维弧，不能被压平。
 *
 * 背景：早先 `polylinePositions` 是 `out.push(pt.x, z, pt.y)` —— 整条线一个统一
 * 高度。那只够画平躺在某一高度的线。一维复形（弯到空间里的弧）每个采样点高度
 * 各不相同，统一 `z` 会把三维弧画成一条平面直线：**呈现的三维与记下的三维不一致，
 * 且不报错**。
 *
 * 判据不靠"看数组里有几个 z"这种弱断言，而是**量弧长**：3-4-5 直角三角形的弧
 * 在三维里长 5、在平面投影里长 4；压平必然塌成 4。
 */

/** 从扁平位置数组 `[x0, z0, y0, x1, z1, y1, ...]` 还原点列。 */
const decode = (flat: number[]): Array<{ x: number; y: number; z: number }> => {
  const out: Array<{ x: number; y: number; z: number }> = [];
  for (let i = 0; k3(i, flat.length); i += 3) {
    out.push({ x: flat[i], y: flat[i + 2], z: flat[i + 1] });
  }
  return out;
};
const k3 = (i: number, len: number): boolean => i + 2 < len;

/** 三维弧长（three 侧 x/y/z 与平面 x/y 的映射已在 decode 里还原）。 */
const arc3 = (pts: Array<{ x: number; y: number; z: number }>): number =>
  pts.reduce((sum, p, i) => {
    if (i === 0) return sum;
    const q = pts[i - 1];
    return sum + Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
  }, 0);

/** 同一弧在 XY 平面上的投影长度。 */
const arc2 = (pts: Array<{ x: number; y: number }>): number =>
  pts.reduce((sum, p, i) => {
    if (i === 0) return sum;
    const q = pts[i - 1];
    return sum + Math.hypot(p.x - q.x, p.y - q.y);
  }, 0);

describe('polylinePositions · 逐点 z', () => {
  test('二维点列 + 整条 fallbackZ：与旧行为逐值一致', () => {
    // 旧实现 out.push(pt.x, z, pt.y) 的产物，锁死以证 2D 无回归
    expect(polylinePositions([{ x: 0, y: 0 }, { x: 1, y: 2 }], 7, false)).toEqual([
      0, 7, 0, 1, 7, 2,
    ]);
  });

  test('逐点 z 优先于 fallbackZ', () => {
    const flat = polylinePositions(
      [
        { x: 0, y: 0, z: 1 },
        { x: 1, y: 0, z: 2 },
        { x: 2, y: 0 },
      ],
      9,
      false,
    );
    expect(flat).toEqual([0, 1, 0, 1, 2, 0, 2, 9, 0]);
  });

  test('三维弧长不被压平（3-4-5 判据）', () => {
    const flat = polylinePositions(
      [
        { x: 0, y: 0, z: 0 },
        { x: 3, y: 0, z: 4 },
      ],
      0,
      false,
    );
    const pts = decode(flat);
    expect(arc3(pts)).toBeCloseTo(5, 9);
    expect(arc2(pts)).toBeCloseTo(3, 9);
    // 若被压平，arc3 会等于 arc2 —— 明确断言二者不同，防"恰好相等"的假通过
    expect(arc3(pts) - arc2(pts)).toBeCloseTo(2, 9);
  });

  test('闭合折线的收尾点沿用首点的 z（不是 fallbackZ）', () => {
    const flat = polylinePositions(
      [
        { x: 0, y: 0, z: 5 },
        { x: 1, y: 0, z: 6 },
      ],
      0,
      true,
    );
    const pts = decode(flat);
    expect(pts).toHaveLength(3);
    expect(pts[2]).toEqual({ x: 0, y: 0, z: 5 });
  });

  test('非有限 z 回落到 fallbackZ（NaN 不进几何）', () => {
    const flat = polylinePositions([{ x: 0, y: 0, z: Number.NaN }], 3, false);
    expect(flat).toEqual([0, 3, 0]);
  });
});

describe('buildScenePlan · 逐点 z 穿过数据契约', () => {
  /** 指向三维弧的快照（对象数组点列，带逐点 z）。 */
  const spatialSnapshot: EntitySnapshot = {
    bounds: { x: 0, y: 0, width: 10, height: 10 },
    dimensions: 3,
    batches: {
      arcs: {
        kind: 'arcs',
        count: 1,
        geometry: 'polyline',
        columns: {
          points: [
            [
              { x: 0, y: 0, z: 0 },
              { x: 3, y: 0, z: 4 },
            ],
          ],
          strokeWidth: [2],
        },
      },
    },
  };

  test('逐点 z 原样保留到绘制计划', () => {
    const plan = buildScenePlan({ snapshot: spatialSnapshot });
    const line = plan.unique.find((u) => u.kind === 'polyline');
    expect(line).toBeDefined();
    expect(line?.points).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 0, z: 4 },
    ]);
  });

  test('二维点列（无逐点 z）行为不变', () => {
    const plan = buildScenePlan({
      snapshot: {
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        batches: {
          paths: {
            kind: 'paths',
            count: 1,
            geometry: 'polyline',
            columns: { points: [[{ x: 0, y: 0 }, { x: 5, y: 5 }]], strokeWidth: [3] },
          },
        },
      },
    });
    const line = plan.unique.find((u) => u.kind === 'polyline');
    // 无逐点 z 时点列不应凭空长出 z 字段
    expect(line?.points).toEqual([{ x: 0, y: 0 }, { x: 5, y: 5 }]);
  });
});
