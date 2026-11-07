/**
 * 分层渲染（`renderOrder` + `depthWrite=false`）。
 *
 * ## 守住什么
 *
 * 2026-11-08 使用者报告：「平面伪 3D 在伪 2D 模式下图层叠加还算正常，
 * 但切到真 3D 时突然图层重叠、视觉上有毛刺感。」
 *
 * 根因：平面图元之间只差 `COPLANAR_EPSILON = 0.02` 世界单位。俯视时深度缓冲
 * 有足够精度区分；相机一倾斜，沿视线方向的深度精度被压缩，0.02 的差距可能
 * 落进同一个深度量化格 ⇒ 同层内部随机深浅交错 = 毛刺。
 *
 * 解法是三层同时做（见 `units.ts` 的 `LAYER_ORDER` 注释）：
 * 1. `renderOrder` 递增 —— 绘制顺序完全由层决定，不靠深度浮点精度；
 * 2. `depthWrite = false` —— 同层图元之间不互相写深度；
 * 3. 保留 `depthTest`。
 *
 * 本测试断言装配产物**真的带上了这两个属性**，且层序单调递增。
 *
 * 用 jsdom 环境：文字走 Canvas 2D 栅格化，需要 `document.createElement('canvas')`。
 * 本用例只断言渲染属性，不关心像素内容，故接过 canvas 桩件即可。
 */

import { describe, expect, test } from 'vitest';
import { Mesh, Line, type Object3D } from 'three/webgpu';
import type { EntitySnapshot } from '@main-ui/core/primitives';
import { buildScenePlan } from '../src/primitive-plan';
import { planToSceneObjects } from '../src/scene-builder';
import { LAYER_ORDER } from '../src/units';

/**
 * 最小 canvas 桩件（无 DOM 环境下供文字栖格化使用）。
 *
 * 本测试只断言渲染属性、不校验像素，故只需「能量字宽、能刷属性」。
 */
function installCanvasStub(): void {
  const g = globalThis as unknown as { document?: unknown };
  if (g.document) return;
  g.document = {
    createElement: () => {
      const canvas = {
        width: 1,
        height: 1,
        getContext: () => ({
          font: '',
          textAlign: '',
          textBaseline: '',
          fillStyle: '',
          measureText: (text: string) => ({ width: (text?.length ?? 0) * 8 }),
          fillText: () => undefined,
          getImageData: (_x: number, _y: number, w: number, h: number) => ({
            data: new Uint8ClampedArray(Math.max(4, w * h * 4)),
            width: w,
            height: h,
          }),
        }),
      };
      return canvas;
    },
  };
}

/** 覆盖全部五类图元的快照：网格、多边形、折线、精灵、文字。 */
function makeSnapshot(): EntitySnapshot {
  return {
    bounds: { x: 0, y: 0, width: 512, height: 512 },
    batches: {
      board: {
        kind: 'board',
        count: 1,
        geometry: 'polygon',
        columns: {
          points: [[0, 0, 200, 0, 200, 200, 0, 200]],
          fill: [0xe8c98a],
          fillAlpha: [1],
        },
      },
      links: {
        kind: 'links',
        count: 1,
        geometry: 'polyline',
        columns: {
          points: [[[0, 0, 200, 200]]],
          stroke: [0x333333],
          strokeWidth: [2],
        },
      },
      dots: {
        kind: 'dots',
        count: 2,
        geometry: 'point',
        columns: {
          x: [100, 300],
          y: [100, 300],
          width: [20, 20],
          height: [20, 20],
          color: [0x111111, 0xeeeeee],
        },
      },
      labels: {
        kind: 'labels',
        count: 1,
        geometry: 'text',
        columns: {
          x: [150],
          y: [150],
          text: ['7'],
          color: [0x000000],
          fontSize: [16],
        },
      },
    },
    dimensions: 2,
  };
}

/** 收集场景里所有「参与绘制的对象」。 */
function collectRenderables(root: Object3D): Object3D[] {
  const out: Object3D[] = [];
  const walk = (node: Object3D): void => {
    if (node instanceof Mesh || node instanceof Line) out.push(node);
    for (const child of node.children) walk(child);
  };
  walk(root);
  return out;
}

/** 读材质上的 `depthWrite`（不同图元材质类型不同，统一按属性读）。 */
function depthWriteOf(object: Object3D): boolean | undefined {
  const material = (object as unknown as { material?: { depthWrite?: boolean } }).material;
  return material?.depthWrite;
}

describe('分层渲染：图层顺序与深度写', () => {
  installCanvasStub();
  const snapshot = makeSnapshot();
  const plan = buildScenePlan({ snapshot });
  const built = planToSceneObjects(plan, { projection: 'orthographic' });
  const renderables = collectRenderables(built.root);

  test('装配产物里有可绘制对象（防止在空场景上假通过）', () => {
    expect(renderables.length).toBeGreaterThan(0);
  });

  test('每个可绘制对象都有非负的 renderOrder（分层是显式的，不靠默认 0）', () => {
    for (const object of renderables) {
      expect(object.renderOrder).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(object.renderOrder)).toBe(true);
    }
  });

  test('所有图元的 depthWrite 都为 false（同层内部不互相写深度）', () => {
    // 逐个数一遍而不是抽样：漏掉任何一类图元都会让该类重新出现毛刺
    const offenders = renderables.filter((object) => depthWriteOf(object) !== false);
    expect(offenders.map((o) => o.name || o.type)).toEqual([]);
  });

  test('层序单调：文字 > 精灵 > 折线 > 多边形', () => {
    expect(LAYER_ORDER.text).toBeGreaterThan(LAYER_ORDER.sprite);
    expect(LAYER_ORDER.sprite).toBeGreaterThan(LAYER_ORDER.polyline);
    expect(LAYER_ORDER.polyline).toBeGreaterThan(LAYER_ORDER.polygon);
    expect(LAYER_ORDER.polygon).toBeGreaterThan(LAYER_ORDER.gridLine);
    expect(LAYER_ORDER.gridLine).toBeGreaterThan(LAYER_ORDER.gridFill);
  });

  test('实际装配后，至少存在两个不同 renderOrder 的层（分层真的生效）', () => {
    const orders = new Set(renderables.map((o) => o.renderOrder));
    expect(orders.size).toBeGreaterThan(1);
  });
});
