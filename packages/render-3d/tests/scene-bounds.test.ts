/**
 * 场景装配的**空间正确性**测试：几何必须落在它声称的世界范围内。
 *
 * ## 为什么需要这一层
 *
 * 纯函数测试（`plan.test.ts` / `viewport-cover.test.ts`）只覆盖「规划算得对」，
 * 它们**看不到装配环节的坐标翻转错误**。2026-11-07 的实机事故正是如此：
 *
 * - `buildScenePlan` 输出正确（96 点圆盘，z = 0）
 * - `buildScenePlan` 单测全绿
 * - 画面却一片空白
 *
 * 根因是多边形装配时用了 `rotation.x = -Math.PI / 2`，把平面内 `y` 映射成 `-z`，
 * 96 段圆盘整体落到 `z ∈ [-456, -56]`，而相机视锥只覆盖 `z ∈ [0, 512]` ——
 * 整个盘面被视锥剔除，只剩坐标正确的精灵点在飘。
 *
 * 本测试直接量**装配产物**的世界包围盒，把「顶点跑到世界之外」变成可断言的
 * 硬事实，不依赖 GPU、不依赖截图。
 */

import { describe, expect, it } from 'vitest';
import { Box3, Group, Mesh, Vector3 } from 'three/webgpu';
import type { EntitySnapshot } from '@main-ui/core/primitives';
import { buildScenePlan } from '../src/primitive-plan';
import { planToSceneObjects } from '../src/scene-builder';

/** 一张 512×512 的正方形世界：96 段圆盘 + 三个精灵点。 */
function makeSnapshot(): EntitySnapshot {
  const SEGMENTS = 96;
  const R = 200;
  const cx = 256;
  const cy = 256;
  const disc: number[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    disc.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
  }
  return {
    bounds: { x: 0, y: 0, width: 512, height: 512 },
    batches: {
      board: {
        kind: 'board',
        count: 1,
        geometry: 'polygon',
        columns: { points: [disc], fill: [0xe8c98a], fillAlpha: [1], strokeWidth: [0] },
      },
      dots: {
        kind: 'dots',
        count: 3,
        geometry: 'point',
        columns: {
          x: [200, 300, 256],
          y: [200, 200, 320],
          width: [24, 24, 24],
          height: [24, 24, 24],
          color: [0x1c1c1e, 0x1c1c1e, 0xd9534f],
        },
      },
    },
    dimensions: 2,
  };
}

/** 收集装配产物中所有网格的世界包围盒（不含相机与灯）。 */
function collectWorldBoxes(root: Group): Box3[] {
  const boxes: Box3[] = [];
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const box = new Box3().setFromObject(child);
    if (box.isEmpty()) return;
    boxes.push(box);
  });
  return boxes;
}

describe('render-3d 场景装配：几何落在世界范围内', () => {
  const snapshot = makeSnapshot();
  const plan = buildScenePlan({ snapshot });
  const built = planToSceneObjects(plan, { projection: 'orthographic' });
  const boxes = collectWorldBoxes(built.root);

  it('装配产物里有网格（防止测试在空场景上假通过）', () => {
    expect(boxes.length).toBeGreaterThan(0);
  });

  it('所有几何的 z 落在世界高度范围内（不出现负 z 翻转）', () => {
    // 2D 的 y 正号映射到 3D 的 z；世界 y ∈ [0, 512]，故 z 也必须 ∈ [0, 512]。
    // 允许 ±1 的容差吸收浮点误差与层偏移（COPLANAR_EPSILON 量级）。
    for (const box of boxes) {
      expect(box.min.z).toBeGreaterThanOrEqual(-1);
      expect(box.max.z).toBeLessThanOrEqual(512 + 1);
    }
  });

  it('所有几何的 x 落在世界宽度范围内', () => {
    for (const box of boxes) {
      expect(box.min.x).toBeGreaterThanOrEqual(-1);
      expect(box.max.x).toBeLessThanOrEqual(512 + 1);
    }
  });

  it('所有几何都在地面附近（y 只在层偏移量级内抬升，不出现大幅垂直偏移）', () => {
    // 图元只靠 LAYER_Z 抬升（polygon 0 → text 0.06），不应出现「跑到天上/地下」。
    for (const box of boxes) {
      expect(box.min.y).toBeGreaterThanOrEqual(-1);
      expect(box.max.y).toBeLessThanOrEqual(1);
    }
  });

  it('圆盘实际覆盖世界中心：包围盒横跨整个直径', () => {
    // 圆盘半径 200、圆心 (256, 256) ⇒ x/y 范围均为 [56, 456]。
    const discBox = boxes
      .map((box) => box.clone())
      .sort((a, b) => a.max.x - a.min.x - (b.max.x - b.min.x))
      .at(-1);
    expect(discBox).toBeDefined();
    expect(discBox!.max.x - discBox!.min.x).toBeGreaterThan(380);
    expect(discBox!.max.z - discBox!.min.z).toBeGreaterThan(380);
    // 中心必须落在包围盒内（这是「画面里看得见」的必要条件）。
    // y 取包围盒自身的中点：平面几何的 y 厚度为 0，用世界 y=0 会踩浮点边界。
    const center = new Vector3(256, (discBox!.min.y + discBox!.max.y) / 2, 256);
    expect(discBox!.containsPoint(center)).toBe(true);
  });
});
