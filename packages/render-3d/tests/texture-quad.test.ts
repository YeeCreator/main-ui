/**
 * 离屏纹理面片（「电视机」）。
 *
 * ## 守住什么
 *
 * 这是「大量二维栅格内容在三维视口呈现」的唯一正确路径。三条判据：
 *
 * 1. **开销与格数无关** —— 4096 格也只是一个面片，而不是 4096 个物体
 * 2. **不按原型合并** —— 每个面片挂独立画布，合并会错绑纹理
 * 3. **无解析器时不画纯色占位板** —— 那会让宿主误以为「内容已加载但显示不对」
 */

import { describe, expect, test } from 'vitest';
import { Group } from 'three/webgpu';
import type { EntitySnapshot } from '@main-ui/core/primitives';
import { buildScenePlan } from '../src/primitive-plan';
import { planToSceneObjects } from '../src/scene-builder';
import { orientQuadToBillboard } from '../src/texture-quad';
import { quatLength } from '@main-ui/core/rendering';

/** 造一份含 texture-quad 批次的快照。 */
function makeSnapshot(quadCount = 1): EntitySnapshot {
  const xs = Array.from({ length: quadCount }, (_, i) => i * 100);
  return {
    bounds: { x: 0, y: 0, width: 512, height: 512 },
    batches: {
      raster: {
        kind: 'raster',
        count: quadCount,
        geometry: 'texture-quad',
        columns: {
          x: xs,
          y: xs.map(() => 0),
          width: xs.map(() => 512),
          height: xs.map(() => 512),
          texture: xs.map((_, i) => `tex-${i}`),
        },
      },
    },
    dimensions: 3,
  };
}

/** 桩件图像源（只需 width/height）。 */
const stubSource = () => ({ width: 64, height: 64 });

describe('texture-quad：计划层', () => {
  test('批次被解析成面片项', () => {
    const plan = buildScenePlan({ snapshot: makeSnapshot(1) });
    expect(plan.textureQuads).toHaveLength(1);
    expect(plan.textureQuads[0]!.texture).toBe('tex-0');
    expect(plan.textureQuads[0]!.width).toBe(512);
  });

  /**
   * 关键判据：**开销与格数无关**。
   *
   * 若一个 4096 格的元胞自动机被拆成 4096 个面片，这条会失败 ——
   * 那说明宿主没用「一张整图」而是逐格建面片，性能设计已跑偏。
   */
  test('一个批次只产出一个面片（不按实体数膨胀）', () => {
    const plan = buildScenePlan({ snapshot: makeSnapshot(1) });
    expect(plan.textureQuads).toHaveLength(1);
    expect(plan.instanceCount).toBe(1);
  });

  test('多个面片各自独立（不合并原型）', () => {
    const plan = buildScenePlan({ snapshot: makeSnapshot(3) });
    expect(plan.textureQuads).toHaveLength(3);
    // 不进入实例化分组（那会按原型键合并）
    expect(plan.instanced.size).toBe(0);
  });

  test('空纹理键的项被跳过（不画空面片）', () => {
    const snapshot: EntitySnapshot = {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      batches: {
        bad: {
          kind: 'bad',
          count: 1,
          geometry: 'texture-quad',
          columns: { x: [0], y: [0], width: [10], height: [10], texture: [''] },
        },
      },
    };
    const plan = buildScenePlan({ snapshot });
    expect(plan.textureQuads).toHaveLength(0);
  });

  test('billboard 缺省为 true（悬空屏幕的默认语义）', () => {
    const plan = buildScenePlan({ snapshot: makeSnapshot(1) });
    expect(plan.textureQuads[0]!.billboard).toBe(true);
  });

  test('billboard 列可显式关闭（贴地显示）', () => {
    const snapshot: EntitySnapshot = {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      batches: {
        ground: {
          kind: 'ground',
          count: 1,
          geometry: 'texture-quad',
          columns: {
            x: [0], y: [0], width: [100], height: [100],
            texture: ['t'], billboard: [false],
          },
        },
      },
    };
    const plan = buildScenePlan({ snapshot });
    expect(plan.textureQuads[0]!.billboard).toBe(false);
  });
});

describe('texture-quad：装配层', () => {
  test('无 textureResolver 时不渲染任何面片（不画纯色占位板）', () => {
    const plan = buildScenePlan({ snapshot: makeSnapshot(1) });
    const built = planToSceneObjects(plan, { projection: 'perspective' });
    // 场景里除了根节点不该有可绘制对象
    let meshes = 0;
    built.root.traverse((child) => {
      if ((child as { isMesh?: boolean }).isMesh) meshes += 1;
    });
    expect(meshes).toBe(0);
  });

  test('有 textureResolver 时确实生成一个网格', () => {
    const plan = buildScenePlan({ snapshot: makeSnapshot(1) });
    const built = planToSceneObjects(plan, {
      projection: 'perspective',
      textureResolver: () => stubSource(),
    });
    let meshes = 0;
    built.root.traverse((child) => {
      if ((child as { isMesh?: boolean }).isMesh) meshes += 1;
    });
    expect(meshes).toBe(1);
  });

  test('解析器返回 null 时跳过该面片（不抛错）', () => {
    const plan = buildScenePlan({ snapshot: makeSnapshot(2) });
    const built = planToSceneObjects(plan, {
      projection: 'perspective',
      textureResolver: (key) => (key === 'tex-0' ? stubSource() : null),
    });
    let meshes = 0;
    built.root.traverse((child) => {
      if ((child as { isMesh?: boolean }).isMesh) meshes += 1;
    });
    // 只有 tex-0 被渲染
    expect(meshes).toBe(1);
  });

  test('面片位置按世界 (x, y) → 三维 (x, z) 映射', () => {
    const snapshot: EntitySnapshot = {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      batches: {
        one: {
          kind: 'one',
          count: 1,
          geometry: 'texture-quad',
          columns: { x: [30], y: [70], width: [10], height: [10], texture: ['t'] },
        },
      },
    };
    const plan = buildScenePlan({ snapshot });
    const built = planToSceneObjects(plan, {
      projection: 'perspective',
      textureResolver: () => stubSource(),
    });
    const meshes: Array<{ position: { x: number; y: number; z: number } }> = [];
    built.root.traverse((child) => {
      if ((child as { isMesh?: boolean }).isMesh) meshes.push(child as never);
    });
    expect(meshes[0]!.position.x).toBeCloseTo(30, 6);
    expect(meshes[0]!.position.z).toBeCloseTo(70, 6);
  });

  /**
   * 非公告牌面片必须**躺平**贴地。
   *
   * `PlaneGeometry` 原生在 XY 平面、法线朝 +Z。若不绕 X 轴转 +90°，
   * 面片会立在竖直平面里 —— 俯视相机只能看到它的一条顶边，
   * 表现为「画面里出现一条扁扁的横条」。
   *
   * 这个缺陷**单元测试查不出纹理内容**，但姿态可以精确断言：
   * 绕 X 轴 +90° 后，局部 +Y（图像上方）应指向世界 +Z。
   */
  test('billboard=false 的面片绕 X 轴 +90° 躺平（否则俯视只见一条边）', () => {
    const snapshot: EntitySnapshot = {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      batches: {
        ground: {
          kind: 'ground',
          count: 1,
          geometry: 'texture-quad',
          columns: {
            x: [50], y: [50], width: [80], height: [80],
            texture: ['t'], billboard: [false],
          },
        },
      },
    };
    const plan = buildScenePlan({ snapshot });
    const built = planToSceneObjects(plan, {
      projection: 'perspective',
      textureResolver: () => stubSource(),
    });
    let mesh: { rotation: { x: number }; updateMatrixWorld: (f?: boolean) => void } | null = null;
    built.root.traverse((child) => {
      if ((child as { isMesh?: boolean }).isMesh) mesh = child as never;
    });
    expect(mesh).not.toBeNull();
    expect(mesh!.rotation.x).toBeCloseTo(Math.PI / 2, 6);
  });
});

describe('texture-quad：公告牌朝向', () => {
  test('朝向相机时四元数为单位四元数（不产生伪四元数）', () => {
    const object = new Group();
    object.position.set(0, 0, 0);
    orientQuadToBillboard(object, { x: 0, y: 100, z: 200 });
    expect(quatLength(object.quaternion)).toBeCloseTo(1, 6);
  });

  test('正俯视退化情形不产生 NaN', () => {
    const object = new Group();
    orientQuadToBillboard(object, { x: 0, y: 500, z: 0 }, { x: 0, y: 0, z: -1 });
    expect(Number.isFinite(object.quaternion.x)).toBe(true);
    expect(Number.isFinite(object.quaternion.w)).toBe(true);
    expect(quatLength(object.quaternion)).toBeCloseTo(1, 6);
  });

  test('相机与面片重合时保持原朝向（不产生 NaN）', () => {
    const object = new Group();
    object.position.set(5, 5, 5);
    const before = object.quaternion.clone();
    orientQuadToBillboard(object, { x: 5, y: 5, z: 5 });
    expect(object.quaternion.x).toBe(before.x);
  });
});

describe('texture-quad：就地刷新（实时内容的前提）', () => {
  /** 造一份带指定纹理键的快照。 */
  const withKey = (key: string): EntitySnapshot => ({
    bounds: { x: 0, y: 0, width: 100, height: 100 },
    batches: {
      raster: {
        kind: 'raster',
        count: 1,
        geometry: 'texture-quad',
        columns: {
          x: [50], y: [50], width: [100], height: [100], texture: [key],
        },
      },
    },
  });

  test('refreshTexture 命中已绑定的键', () => {
    const built = planToSceneObjects(buildScenePlan({ snapshot: withKey('live') }), {
      projection: 'perspective',
      textureResolver: () => stubSource(),
    });
    expect(built.refreshTexture('live')).toBe(true);
  });

  test('刷新未知键返回 false 而不抛错（键拼错不应崩服）', () => {
    const built = planToSceneObjects(buildScenePlan({ snapshot: withKey('live') }), {
      projection: 'perspective',
      textureResolver: () => stubSource(),
    });
    expect(built.refreshTexture('nope')).toBe(false);
  });

  /**
   * 关键判据：**刷新不重建场景对象**。
   *
   * 实时内容每帧重画画布后都要刷新纹理。若刷新走了场景重建，
   * 帧率必然崩 —— 这条靠对象身份断言，而不是靠「看起来能跑」。
   */
  test('刷新后场景对象身份不变（未重建）', () => {
    const built = planToSceneObjects(buildScenePlan({ snapshot: withKey('live') }), {
      projection: 'perspective',
      textureResolver: () => stubSource(),
    });
    const meshes: unknown[] = [];
    built.root.traverse((child) => {
      if ((child as { isMesh?: boolean }).isMesh) meshes.push(child);
    });
    expect(meshes).toHaveLength(1);

    built.refreshTexture('live');

    const after: unknown[] = [];
    built.root.traverse((child) => {
      if ((child as { isMesh?: boolean }).isMesh) after.push(child);
    });
    expect(after).toHaveLength(1);
    expect(after[0]).toBe(meshes[0]);
  });

  test('同一键被多个面片使用时只登记一次（共享同一张图）', () => {
    const snapshot: EntitySnapshot = {
      bounds: { x: 0, y: 0, width: 200, height: 100 },
      batches: {
        raster: {
          kind: 'raster',
          count: 2,
          geometry: 'texture-quad',
          columns: {
            x: [50, 150], y: [50, 50], width: [80, 80], height: [80, 80],
            texture: ['shared', 'shared'],
          },
        },
      },
    };
    const built = planToSceneObjects(buildScenePlan({ snapshot }), {
      projection: 'perspective',
      textureResolver: () => stubSource(),
    });
    expect(built.refreshTexture('shared')).toBe(true);
  });
});
