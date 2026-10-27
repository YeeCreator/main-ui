import { describe, expect, test } from 'vitest';
import type { EntitySnapshot, GridSpec } from '@main-ui/core/primitives';
import { ORTHO_PRESET, COPLANAR_EPSILON, LAYER_Z, colorToCss, colorToRgb } from '../src/units';
import { buildScenePlan, findInstancingViolations } from '../src/primitive-plan';
import {
  planCamera,
  planCamera2D,
  screenToWorldOrtho,
  worldToScreenOrtho,
} from '../src/camera-plan';
import { camera2DToOrbit } from '@main-ui/core/rendering';

/**
 * WP3 纯函数层用例：绘制计划（实例化判据）与相机规划（二维档预设）。
 *
 * 这些断言全部不依赖 GPU —— 三维后端的"能不能跑"要靠浏览器实测，
 * 但"是否合规"（实例化、正交、DPR、层偏移）可以在这里钉死。
 */

const piecesSnapshot: EntitySnapshot = {
  bounds: { x: 0, y: 0, width: 400, height: 400 },
  batches: {
    pieces: {
      kind: 'pieces',
      count: 3,
      geometry: 'point',
      columns: {
        x: [10, 20, 30],
        y: [10, 20, 30],
        width: [8, 8, 8],
        height: [8, 8, 8],
        color: [0x111111, 0x111111, 0x111111],
      },
    },
  },
};

const grid: GridSpec = { x: 0, y: 0, cols: 8, rows: 8, cellWidth: 50, cellHeight: 50 };

describe('render-3d 常量与颜色换算', () => {
  test('二维档预设：正交 + 无光照 + 线条不走贴图', () => {
    expect(ORTHO_PRESET.lighting).toBe(false);
    expect(ORTHO_PRESET.texturedLines).toBe(false);
    // 极角接近水平俯视（π/2 = 水平，正上方 = 0）
    expect(ORTHO_PRESET.polar).toBeLessThan(Math.PI / 2);
  });

  test('层偏移逐层递增（避开共面闪面）', () => {
    expect(LAYER_Z.polygon).toBe(0);
    expect(LAYER_Z.polyline).toBeGreaterThan(LAYER_Z.polygon);
    expect(LAYER_Z.sprite).toBeGreaterThan(LAYER_Z.polyline);
    expect(LAYER_Z.text).toBeGreaterThan(LAYER_Z.sprite);
    expect(COPLANAR_EPSILON).toBeGreaterThan(0);
  });

  test('颜色换算', () => {
    expect(colorToCss(0x112233)).toBe('#112233');
    expect(colorToCss(undefined, 0xff0000)).toBe('#ff0000');
    expect(colorToRgb(0x804020)).toEqual({ r: 128 / 255, g: 64 / 255, b: 32 / 255 });
  });
});

describe('render-3d 绘制计划：实例化硬规矩', () => {
  test('同类实体归并到一个原型（不 materialize 逐实体几何）', () => {
    const plan = buildScenePlan({ snapshot: piecesSnapshot });
    expect(plan.prototypeCount).toBe(1);
    expect(plan.instanceCount).toBe(3);
    expect(plan.instanced.size).toBe(1);
    const [group] = Array.from(plan.instanced.values());
    expect(group.instances).toHaveLength(3);
    expect(findInstancingViolations(plan)).toEqual([]);
  });

  test('不同颜色拆不同原型（材质不同的实体不能共享实例网格）', () => {
    const snapshot: EntitySnapshot = {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      batches: {
        pieces: {
          kind: 'pieces',
          count: 2,
          geometry: 'point',
          columns: { x: [0, 10], y: [0, 10], color: [0x111111, 0x222222] },
        },
      },
    };
    const plan = buildScenePlan({ snapshot });
    expect(plan.prototypeCount).toBe(2);
    expect(plan.instanceCount).toBe(2);
  });

  test('违规检测：每个实体一个原型时判违规', () => {
    const plan = buildScenePlan({ snapshot: piecesSnapshot });
    // 伪造一个"每实体独立原型"的计划
    const violating = {
      ...plan,
      instanced: new Map(
        Array.from({ length: 3 }, (_, index) => [
          `unique:${index}`,
          {
            prototypeKey: `unique:${index}`,
            shape: 'circle' as const,
            instances: [{ x: index, y: 0, z: 0, width: 1, height: 1, extrude: 0, color: 0x111111 }],
          },
        ]),
      ),
    };
    expect(findInstancingViolations(violating).length).toBeGreaterThan(0);
  });

  test('z 与 extrude 进计划；层偏移叠加', () => {
    const snapshot: EntitySnapshot = {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      dimensions: 3,
      batches: {
        pieces: {
          kind: 'pieces',
          count: 1,
          geometry: 'point',
          columns: { x: [0], y: [0], z: [5], extrude: [2], width: [4], height: [4] },
        },
      },
    };
    const plan = buildScenePlan({ snapshot });
    const [group] = Array.from(plan.instanced.values());
    expect(group.instances[0].z).toBeCloseTo(5 + LAYER_Z.sprite, 6);
    expect(group.instances[0].extrude).toBe(2);
  });

  test('文字进文字计划（MSDF 路线），带层偏移', () => {
    const snapshot: EntitySnapshot = {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      batches: {
        labels: {
          kind: 'labels', count: 1, geometry: 'text',
          columns: { x: [5], y: [6], text: ['黑棋'], fontSize: [14], color: [0x000000] },
        },
      },
    };
    const plan = buildScenePlan({ snapshot });
    expect(plan.texts).toHaveLength(1);
    expect(plan.texts[0].text).toBe('黑棋');
    expect(plan.texts[0].z).toBeCloseTo(LAYER_Z.text, 6);
  });

  test('网格进网格计划，颜色转 CSS', () => {
    const plan = buildScenePlan({ grid: { ...grid, lineColor: 0x223344, cellFill: [0xffffff, 0xeeeeee] } });
    expect(plan.grid?.lineColor).toBe('#223344');
    expect(plan.grid?.cellFill).toEqual(['#ffffff', '#eeeeee']);
    expect(plan.grid?.cols).toBe(8);
  });

  test('多边形与折线进独立几何（无法共享原型）', () => {
    const snapshot: EntitySnapshot = {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      batches: {
        tiles: {
          kind: 'tiles', count: 1, geometry: 'polygon',
          columns: { points: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]], extrude: [1.5] },
        },
        paths: {
          kind: 'paths', count: 1, geometry: 'polyline',
          columns: { points: [[{ x: 0, y: 0 }, { x: 5, y: 5 }]], strokeWidth: [3] },
        },
      },
    };
    const plan = buildScenePlan({ snapshot });
    expect(plan.unique).toHaveLength(2);
    expect(plan.unique.find((u) => u.kind === 'polygon')?.extrude).toBe(1.5);
    expect(plan.unique.find((u) => u.kind === 'polyline')?.z).toBeCloseTo(LAYER_Z.polyline, 6);
  });

  test('空快照产出空计划（不抛错）', () => {
    const plan = buildScenePlan({});
    expect(plan.prototypeCount).toBe(0);
    expect(plan.instanceCount).toBe(0);
    expect(plan.grid).toBeNull();
  });
});

describe('render-3d 相机规划：二维档预设', () => {
  const viewportPx = { width: 800, height: 600 };

  test('缺省产出正交相机（不是透视）', () => {
    const orbit = camera2DToOrbit({ scale: 1, pan: { x: 0, y: 0 } }, viewportPx);
    const plan = planCamera({ orbit, viewportPx });
    expect(plan.kind).toBe('orthographic');
    expect(plan.lighting).toBe(false);
  });

  test('正交视锥宽高比与视口一致（不拉伸）', () => {
    const orbit = camera2DToOrbit({ scale: 1, pan: { x: 0, y: 0 } }, viewportPx);
    const plan = planCamera({ orbit, viewportPx });
    if (plan.kind !== 'orthographic') throw new Error('期望正交');
    const width = plan.right - plan.left;
    const height = plan.top - plan.bottom;
    expect(width / height).toBeCloseTo(viewportPx.width / viewportPx.height, 6);
    expect(height).toBeCloseTo(orbit.viewHeight, 6);
  });

  test('正交档 viewHeight 与二维 scale 互为倒数', () => {
    const plan = planCamera2D({ camera: { scale: 2, pan: { x: 0, y: 0 } }, viewportPx });
    expect(plan.top - plan.bottom).toBeCloseTo(viewportPx.height / 2, 6);
  });

  test('透视档在显式指定时启用，且仍为无光照', () => {
    const orbit = camera2DToOrbit({ scale: 1, pan: { x: 0, y: 0 } }, viewportPx);
    const plan = planCamera({ orbit, viewportPx, projection: 'perspective' });
    expect(plan.kind).toBe('perspective');
    expect(plan.lighting).toBe(false);
  });

  test('screenToWorld / worldToScreen 在正交档下互逆', () => {
    const plan = planCamera2D({ camera: { scale: 1, pan: { x: 0, y: 0 } }, viewportPx });
    for (const screen of [{ x: 0, y: 0 }, { x: 400, y: 300 }, { x: 799, y: 599 }]) {
      const world = screenToWorldOrtho({ screen, plan, viewportPx });
      const back = worldToScreenOrtho({ world, plan, viewportPx });
      expect(back.x).toBeCloseTo(screen.x, 6);
      expect(back.y).toBeCloseTo(screen.y, 6);
    }
  });

  test('坐标约定翻转：世界 y 映射到 three z（地面平面）', () => {
    const plan = planCamera2D({ camera: { scale: 1, pan: { x: 0, y: 0 } }, viewportPx });
    // 目标点在底面中心；屏幕上移 = 世界 y 变小 = three z 变小
    const up = screenToWorldOrtho({ screen: { x: 400, y: 200 }, plan, viewportPx });
    const down = screenToWorldOrtho({ screen: { x: 400, y: 400 }, plan, viewportPx });
    expect(up.y).toBeLessThan(down.y);
  });
});
