/**
 * 自由相机（Fly / First-Person）数学。
 *
 * 与轨道相机并存的第二套相机模型。这里守住的核心是：
 * 1. **能仰头看天** —— 这是它与轨道相机的本质区别
 * 2. **切换不跳画面** —— 轨道 ↔ 自由互相转换时朝向连续
 * 3. **按时间积分** —— 不同帧率下速度一致
 * 4. **升降走世界 Y** —— 不是相机自身 up（抬头时差别明显）
 */

import { describe, expect, test } from 'vitest';
import {
  DEFAULT_FLY_SPEED,
  MAX_PITCH,
  applyFlyInput,
  clampPitch,
  flyLookDelta,
  freeBasis,
  freeFromOrbitPose,
  freeGroundHit,
  freeQuat,
  freeToOrbitTarget,
  type FreeCamera,
} from '../src/rendering/free-camera';
import { quatLength } from '../src/rendering/camera-orientation';

/** 造一台站在原点、朝 −Z 看的自由相机。 */
function makeFree(overrides: Partial<FreeCamera> = {}): FreeCamera {
  return {
    position: { x: 0, y: 100, z: 0 },
    yaw: 0,
    pitch: 0,
    ...overrides,
  };
}

describe('自由相机：基础姿态', () => {
  test('yaw=0 / pitch=0 时看向 −Z、上为 +Y、右为 +X', () => {
    const b = freeBasis(makeFree());
    expect(b.forward.z).toBeCloseTo(-1, 8);
    expect(b.forward.y).toBeCloseTo(0, 8);
    expect(b.up.y).toBeCloseTo(1, 8);
    expect(b.right.x).toBeCloseTo(1, 8);
  });

  test('pitch 为正时抬头（forward.y > 0）', () => {
    const b = freeBasis(makeFree({ pitch: 0.6 }));
    expect(b.forward.y).toBeGreaterThan(0.5);
  });

  test('yaw 为正时朝左转（forward.x < 0）', () => {
    // three 约定：相机看 −Z，绕 +Y 正转 ⇒ 视线转向 −X
    const b = freeBasis(makeFree({ yaw: Math.PI / 2 }));
    expect(b.forward.x).toBeLessThan(-0.9);
  });

  test('四元数模长恒为 1（含 roll）', () => {
    for (const cam of [
      makeFree(),
      makeFree({ yaw: 1.2, pitch: -0.4 }),
      makeFree({ yaw: -2.5, pitch: 1.0, roll: 0.7 }),
      makeFree({ pitch: MAX_PITCH }),
    ]) {
      expect(quatLength(freeQuat(cam))).toBeCloseTo(1, 8);
    }
  });

  test('roll 不改变视线方向（视线是转轴）', () => {
    const before = freeBasis(makeFree({ pitch: 0.4 })).forward;
    const after = freeBasis(makeFree({ pitch: 0.4, roll: 0.9 })).forward;
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
    expect(after.z).toBeCloseTo(before.z, 8);
  });

  test('roll 确实改变上方向', () => {
    const before = freeBasis(makeFree({ pitch: 0.4 })).up;
    const after = freeBasis(makeFree({ pitch: 0.4, roll: 0.9 })).up;
    const dot = before.x * after.x + before.y * after.y + before.z * after.z;
    expect(dot).toBeLessThan(0.999);
  });
});

describe('自由相机：能仰头看天（轨道相机做不到）', () => {
  test('pitch 接近 π/2 时视线朝上', () => {
    const b = freeBasis(makeFree({ pitch: MAX_PITCH }));
    expect(b.forward.y).toBeGreaterThan(0.99);
  });

  test('pitch 被夹住，不会越过极点', () => {
    expect(clampPitch(10)).toBeCloseTo(MAX_PITCH, 8);
    expect(clampPitch(-10)).toBeCloseTo(-MAX_PITCH, 8);
    expect(Number.isFinite(clampPitch(Number.NaN))).toBe(true);
  });

  test('输入超量 pitch 也只在合法区间内', () => {
    let cam = makeFree();
    for (let i = 0; i < 100; i += 1) {
      cam = applyFlyInput(cam, { pitchDelta: 0.5 }, 0.016);
    }
    expect(cam.pitch).toBeLessThanOrEqual(MAX_PITCH + 1e-9);
    expect(freeBasis(cam).forward.y).toBeGreaterThan(0.99);
  });
});

describe('自由相机：移动', () => {
  test('W 沿视线前进（朝 −Z 时 position.z 减小）', () => {
    const start = makeFree();
    const next = applyFlyInput(start, { forward: 1 }, 1);
    expect(next.position.z).toBeLessThan(start.position.z);
    expect(next.position.z).toBeCloseTo(-DEFAULT_FLY_SPEED, 6);
  });

  test('S 沿视线后退', () => {
    const start = makeFree();
    const next = applyFlyInput(start, { forward: -1 }, 1);
    expect(next.position.z).toBeGreaterThan(start.position.z);
  });

  test('D 向右横移（朝 −Z 看时 position.x 增大）', () => {
    const start = makeFree();
    const next = applyFlyInput(start, { strafe: 1 }, 1);
    expect(next.position.x).toBeGreaterThan(start.position.x);
  });

  test('Q/E 走世界竖直，抬头后仍是纯竖直（不是沿相机自身 up）', () => {
    const tiltedUp = makeFree({ pitch: 1.2 });
    const next = applyFlyInput(tiltedUp, { elevate: 1 }, 1);
    // 只有 y 变，x/z 不动
    expect(next.position.y).toBeGreaterThan(tiltedUp.position.y);
    expect(next.position.x).toBeCloseTo(tiltedUp.position.x, 8);
    expect(next.position.z).toBeCloseTo(tiltedUp.position.z, 8);
  });

  test('按时间积分：两倍 dt 走两倍距离（帧率无关）', () => {
    const start = makeFree();
    const one = applyFlyInput(start, { forward: 1 }, 0.016);
    const two = applyFlyInput(start, { forward: 1 }, 0.032);
    const d1 = Math.abs(one.position.z - start.position.z);
    const d2 = Math.abs(two.position.z - start.position.z);
    expect(d2).toBeCloseTo(d1 * 2, 6);
  });

  test('dt 非法时位置不变（不产生 NaN）', () => {
    const start = makeFree();
    for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const next = applyFlyInput(start, { forward: 1 }, dt);
      expect(Number.isFinite(next.position.z)).toBe(true);
    }
  });

  test('自定义 speed 生效', () => {
    const start = makeFree({ speed: 100 });
    const next = applyFlyInput(start, { forward: 1 }, 1);
    expect(next.position.z).toBeCloseTo(-100, 6);
  });

  test('零输入时相机完全不变（位置与角度）', () => {
    const start = makeFree({ yaw: 0.7, pitch: 0.3, roll: 0.1 });
    const next = applyFlyInput(start, {}, 0.016);
    expect(next.position).toEqual(start.position);
    expect(next.yaw).toBeCloseTo(start.yaw, 10);
    expect(next.pitch).toBeCloseTo(start.pitch, 10);
  });
});

describe('自由相机：转向', () => {
  test('向右拖 → 视线向右转（朝 −Z 看时 forward.x 增大）', () => {
    const start = makeFree();
    const { yawDelta } = flyLookDelta(100, 0);
    const next = applyFlyInput(start, { yawDelta }, 0);
    expect(freeBasis(next).forward.x).toBeGreaterThan(0);
  });

  test('向下拖 → 低头（forward.y 减小）', () => {
    const start = makeFree();
    const { pitchDelta } = flyLookDelta(0, 100);
    const next = applyFlyInput(start, { pitchDelta }, 0);
    expect(freeBasis(next).forward.y).toBeLessThan(0);
  });

  test('转向不依赖 dt（鼠标位移本身即增量）', () => {
    const start = makeFree();
    const a = applyFlyInput(start, { yawDelta: 0.2 }, 0.001);
    const b = applyFlyInput(start, { yawDelta: 0.2 }, 1.0);
    expect(a.yaw).toBeCloseTo(b.yaw, 10);
  });

  test('flyLookDelta 对非有限输入安全', () => {
    const d = flyLookDelta(Number.NaN, Number.POSITIVE_INFINITY);
    expect(Number.isFinite(d.yawDelta)).toBe(true);
    expect(Number.isFinite(d.pitchDelta)).toBe(true);
  });
});

describe('轨道 ↔ 自由：切换不跳画面', () => {
  const POSES: Array<{ name: string; position: { x: number; y: number; z: number }; forward: { x: number; y: number; z: number }; up: { x: number; y: number; z: number } }> = [
    {
      name: '俯视',
      position: { x: 0, y: 800, z: 0 },
      // 与实机 `DEFAULT_TOP_POLAR = 0.12` 同量级：几乎垂直向下，略微前倾
      forward: { x: 0, y: -0.99281, z: -0.11971 },
      up: { x: 0, y: 0.11971, z: -0.99281 },
    },
    {
      name: '斜看',
      position: { x: 300, y: 500, z: 600 },
      forward: { x: -0.4, y: -0.7, z: -0.58 },
      up: { x: -0.2, y: 0.7, z: -0.68 },
    },
  ];

  for (const pose of POSES) {
    test(`${pose.name}：由位置 + 基向量反解后能还原朝向`, () => {
      const norm = (v: { x: number; y: number; z: number }) => {
        const l = Math.hypot(v.x, v.y, v.z);
        return { x: v.x / l, y: v.y / l, z: v.z / l };
      };
      const forward = norm(pose.forward);
      const up = norm(pose.up);
      // right = forward × up（右手系，与 three 一致）
      const right = norm({
        x: forward.y * up.z - forward.z * up.y,
        y: forward.z * up.x - forward.x * up.z,
        z: forward.x * up.y - forward.y * up.x,
      });
      const free = freeFromOrbitPose({
        position: pose.position,
        basis: { forward, up, right },
      });
      const back = freeBasis(free);
      /**
       * 容差取 1e-3：`pitch` 被 `clampPitch` 夹在 `±MAX_PITCH` 内，
       * 而 `MAX_PITCH = π/2 − 0.01`，故接近垂直的朝向会有
       * 约 `sin(0.01) ≈ 0.01` 的 z 分量偏差 —— 那是**夹取的代价**，
       * 不是换算错误（垂直俯视本就无法用 yaw/pitch 唯一表示）。
       */
      expect(back.forward.x).toBeCloseTo(forward.x, 3);
      expect(back.forward.y).toBeCloseTo(forward.y, 3);
      expect(back.forward.z).toBeCloseTo(forward.z, 3);
      expect(free.position).toEqual(pose.position);
    });
  }

  test('freeToOrbitTarget 落在相机前方（沿视线方向）', () => {
    const free = makeFree({ yaw: 0.5, pitch: 0.3 });
    const target = freeToOrbitTarget(free, 500);
    const b = freeBasis(free);
    // 从相机指向 target 的方向应与视线同向
    const dx = target.x - free.position.x;
    const dy = target.y - free.position.y;
    const dz = target.z - free.position.z;
    const len = Math.hypot(dx, dy, dz);
    expect(dx / len).toBeCloseTo(b.forward.x, 6);
    expect(dy / len).toBeCloseTo(b.forward.y, 6);
    expect(dz / len).toBeCloseTo(b.forward.z, 6);
    expect(len).toBeCloseTo(500, 6);
  });
});

describe('自由相机：地面交点（供小地图 / 命中使用）', () => {
  test('朝下看时能求出地面交点', () => {
    const cam = makeFree({ position: { x: 0, y: 100, z: 0 }, pitch: -0.5 });
    const hit = freeGroundHit(cam);
    expect(hit.distance).not.toBeNull();
    expect(hit.distance!).toBeGreaterThan(0);
    // 朝 −Z 且低头 ⇒ 交点在 −Z 方向
    expect(hit.point.y).toBeLessThan(0);
  });

  test('视线水平时无交点，回退到脚下', () => {
    const cam = makeFree({ pitch: 0 });
    const hit = freeGroundHit(cam);
    expect(hit.distance).toBeNull();
    expect(Number.isFinite(hit.point.x)).toBe(true);
  });

  test('仰头看天时无交点', () => {
    const cam = makeFree({ pitch: MAX_PITCH });
    const hit = freeGroundHit(cam);
    expect(hit.distance).toBeNull();
  });
});
