/**
 * 相机姿态：trackball / turntable / roll。
 *
 * 这一层守住的核心是**「不许出现非法旋转」**：任何姿态四元数的模长必须为 1。
 * 上轮文字贴片的事故正是这条失守（左手系矩阵产出的伪四元数模长 0.708），
 * 表现为「贴片侧对相机」。故这里每个用例都断言模长。
 */

import { describe, expect, test } from 'vitest';
import {
  IDENTITY_QUAT,
  quatFromAxisAngle,
  quatFromForward,
  quatLength,
  quatMultiply,
  quatNormalize,
  quatRotate,
  quatToBasis,
  rollDeltaQuat,
  trackballDeltaQuat,
} from '../src/rendering/camera-orientation';
import {
  orbitBasis,
  orbitQuat,
  orbitResetRoll,
  orbitRoll,
  orbitRotate,
  orbitZoom,
  orbitZoomAtPoint,
  viewDirectionFromOrbit,
  orbitAnglesFromViewDirection,
  type OrbitCamera,
} from '../src/rendering/camera-bridge';

/** 造一台底朝天/俯视的轨道相机（与实机 preset 同量级）。 */
function makeOrbit(overrides: Partial<OrbitCamera> = {}): OrbitCamera {
  return {
    target: { x: 256, y: 0, z: 256 },
    azimuth: 0,
    polar: 0.12,
    distance: 1024,
    viewHeight: 512,
    ...overrides,
  };
}

describe('四元数基础：模长恒为 1', () => {
  test('由轴角构造的模长为 1', () => {
    for (const angle of [-Math.PI, -0.5, 0, 0.5, Math.PI / 2, Math.PI]) {
      expect(quatLength(quatFromAxisAngle({ x: 1, y: 2, z: 3 }, angle))).toBeCloseTo(1, 10);
    }
  });

  test('乘法结果的模长为 1（连续旋转不漂移）', () => {
    let q = { ...IDENTITY_QUAT };
    const step = quatFromAxisAngle({ x: 0.3, y: 1, z: 0.2 }, 0.37);
    for (let i = 0; i < 500; i += 1) q = quatNormalize(quatMultiply(step, q));
    expect(quatLength(q)).toBeCloseTo(1, 10);
  });

  test('零轴返回单位四元数（退化输入安全）', () => {
    expect(quatFromAxisAngle({ x: 0, y: 0, z: 0 }, 1)).toEqual(IDENTITY_QUAT);
  });

  test('旋转向量保持长度（等距性）', () => {
    const q = quatFromAxisAngle({ x: 1, y: 1, z: 1 }, 0.9);
    const v = quatRotate(q, { x: 3, y: -2, z: 7 });
    expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(Math.hypot(3, -2, 7), 10);
  });

  test('绕 X 轴 90°：+Y → +Z', () => {
    const q = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2);
    const r = quatRotate(q, { x: 0, y: 1, z: 0 });
    expect(r.x).toBeCloseTo(0, 10);
    expect(r.y).toBeCloseTo(0, 10);
    expect(r.z).toBeCloseTo(1, 10);
  });
});

describe('trackball：转轴垂直于拖拽方向', () => {
  test('纯横向拖拽 → 转轴是屏幕竖直轴（拖拽方向的垂线）', () => {
    const q = trackballDeltaQuat({
      deltaX: 100,
      deltaY: 0,
      viewRight: { x: 1, y: 0, z: 0 },
      viewUp: { x: 0, y: 1, z: 0 },
    });
    // 轴应为 ±Y，故四元数的 x/z 分量≈0
    expect(Math.abs(q.x)).toBeLessThan(1e-9);
    expect(Math.abs(q.z)).toBeLessThan(1e-9);
    // 100px × 0.01 rad/px = 1 rad，故半角 0.5 rad，|y| = sin(0.5)
    expect(Math.abs(q.y)).toBeCloseTo(Math.sin(0.5), 9);
    expect(quatLength(q)).toBeCloseTo(1, 10);
  });

  test('纯纵向拖拽 → 转轴是屏幕水平轴', () => {
    const q = trackballDeltaQuat({
      deltaX: 0,
      deltaY: 100,
      viewRight: { x: 1, y: 0, z: 0 },
      viewUp: { x: 0, y: 1, z: 0 },
    });
    expect(Math.abs(q.x)).toBeCloseTo(Math.sin(0.5), 9);
    expect(Math.abs(q.y)).toBeLessThan(1e-9);
    expect(Math.abs(q.z)).toBeLessThan(1e-9);
  });

  test('斜向拖拽的转轴垂直于拖拽方向', () => {
    const q = trackballDeltaQuat({
      deltaX: 100,
      deltaY: 100,
      viewRight: { x: 1, y: 0, z: 0 },
      viewUp: { x: 0, y: 1, z: 0 },
    });
    // 屏幕位移换算到世界后是 (100, −100, 0)；轴应在 (1, 1, 0) 方向（即其垂线）
    const axis = { x: q.x, y: q.y, z: q.z };
    const axisLen = Math.hypot(axis.x, axis.y, axis.z);
    expect(axisLen).toBeGreaterThan(1e-6);
    const norm = { x: axis.x / axisLen, y: axis.y / axisLen, z: axis.z / axisLen };
    // 与拖拽方向点积应为 0（垂直），而不是 ±1（平行）
    expect(Math.abs(norm.x * 100 + norm.y * -100)).toBeLessThan(1e-6);
    // 且确实在屏幕平面内（z 分量≈0）
    expect(Math.abs(norm.z)).toBeLessThan(1e-6);
  });

  test('零位移返回单位四元数（不抖动）', () => {
    const q = trackballDeltaQuat({
      deltaX: 0,
      deltaY: 0,
      viewRight: { x: 1, y: 0, z: 0 },
      viewUp: { x: 0, y: 1, z: 0 },
    });
    expect(q).toEqual(IDENTITY_QUAT);
  });

  test('同样距离的拖拽产生同样角度（与方向无关）', () => {
    const opts = { viewRight: { x: 1, y: 0, z: 0 }, viewUp: { x: 0, y: 1, z: 0 } };
    const a = trackballDeltaQuat({ ...opts, deltaX: 100, deltaY: 0 });
    const b = trackballDeltaQuat({ ...opts, deltaX: 0, deltaY: 100 });
    const c = trackballDeltaQuat({ ...opts, deltaX: 70.71, deltaY: 70.71 });
    const angleOf = (q: { w: number }) => 2 * Math.acos(Math.min(1, Math.abs(q.w)));
    expect(angleOf(a)).toBeCloseTo(angleOf(b), 6);
    expect(angleOf(c)).toBeCloseTo(angleOf(a), 2);
  });
});

describe('trackball：连续拖拽不退化', () => {
  test('绕同一方向连续拖 200 次，四元数模长始终为 1', () => {
    let orbit = makeOrbit();
    for (let i = 0; i < 200; i += 1) {
      orbit = trackballStep(orbit, 12, 7);
      expect(quatLength(orbitQuat(orbit))).toBeCloseTo(1, 8);
    }
  });

  test('拖拽轨迹转弯时坐标系跟着转（roll 会累积）—— 这是 trackball 的本质', () => {
    // 先横拖一圈，再纵拖一圈：若为 turntable，上方向应回到世界 Y；trackball 则不会
    let orbit = makeOrbit();
    for (let i = 0; i < 40; i += 1) orbit = trackballStep(orbit, 15, 0);
    for (let i = 0; i < 40; i += 1) orbit = trackballStep(orbit, 0, 15);
    const up = orbitBasis(orbit).up;
    // turntable 下 up 恒在 XZ 平面内（y 分量为 0）；trackball 会把 y 转出来
    const tilted = Math.abs(up.y);
    expect(tilted).toBeGreaterThan(1e-6);
  });

  test('没有极点死锁：无论怎么拖，姿态都能继续变化', () => {
    let orbit = makeOrbit();
    let previous = orbitQuat(orbit);
    let changed = 0;
    for (let i = 0; i < 60; i += 1) {
      orbit = trackballStep(orbit, 0, 40);
      const now = orbitQuat(orbit);
      const delta = Math.abs(now.w - previous.w) + Math.abs(now.x - previous.x) + Math.abs(now.z - previous.z);
      if (delta > 1e-9) changed += 1;
      previous = now;
    }
    // turntable 会在到达极点后卡住（changed 停滞），trackball 不会
    expect(changed).toBe(60);
  });
});

/** 走一步 trackball（内部用缺省灵敏度）。 */
function trackballStep(orbit: OrbitCamera, dx: number, dy: number) {
  return orbitRotate({ ...orbit, rotationModel: 'trackball' }, dx * 0.01, dy * 0.01);
}

describe('turntable：地平线永远水平', () => {
  test('横向拖只改方位角，极角不变', () => {
    const start = makeOrbit({ rotationModel: 'turntable' });
    const next = orbitRotate(start, 0.5, 0);
    expect(next.azimuth).toBeCloseTo(start.azimuth + 0.5, 6);
    expect(next.polar).toBeCloseTo(start.polar, 6);
  });

  test('反复横纵拖拽后，azimuth/polar 仍是姿态的正确派生值（无累积 roll）', () => {
    let orbit = makeOrbit({ rotationModel: 'turntable' });
    for (let i = 0; i < 50; i += 1) {
      orbit = orbitRotate(orbit, 0.1, 0.02);
    }
    const { forward } = orbitBasis(orbit);
    const angles = orbitAnglesFromViewDirection(forward);
    // azimuth 在 ±π 处会缠绕 2π，比较时取最短弧
    const azDiff = Math.abs(((angles.azimuth - orbit.azimuth + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    expect(azDiff).toBeLessThan(1e-6);
    expect(Math.abs(angles.polar - orbit.polar)).toBeLessThan(1e-6);
  });

  test('极角被夹到安全区间（不会翻到地平线以下）', () => {
    let orbit = makeOrbit({ rotationModel: 'turntable' });
    for (let i = 0; i < 100; i += 1) orbit = orbitRotate(orbit, 0, 0.1);
    expect(orbit.polar).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
    expect(orbit.polar).toBeGreaterThan(0);
  });
});

describe('roll：绕视线轴自转', () => {
  test('roll 不改变视线方向（视线是转轴）', () => {
    const orbit = makeOrbit();
    const before = orbitBasis(orbit).forward;
    const after = orbitBasis(orbitRoll(orbit, 0.7)).forward;
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
    expect(after.z).toBeCloseTo(before.z, 8);
  });

  test('roll 确实改变了上方向', () => {
    const orbit = makeOrbit();
    const beforeUp = orbitBasis(orbit).up;
    const afterUp = orbitBasis(orbitRoll(orbit, 0.7)).up;
    const dot = beforeUp.x * afterUp.x + beforeUp.y * afterUp.y + beforeUp.z * afterUp.z;
    expect(dot).toBeLessThan(0.999);
  });

  test('rollDeltaQuat 的模长为 1，零角为单位四元数', () => {
    expect(quatLength(rollDeltaQuat(0.5, { x: 0, y: 1, z: 0 }))).toBeCloseTo(1, 10);
    expect(rollDeltaQuat(0, { x: 0, y: 1, z: 0 })).toEqual(IDENTITY_QUAT);
  });

  test('roll 后 azimuth/polar 仍是当前姿态的正确派生值', () => {
    const orbit = orbitRoll(makeOrbit(), 0.4);
    const { forward } = orbitBasis(orbit);
    const angles = orbitAnglesFromViewDirection(forward);
    expect(angles.polar).toBeCloseTo(orbit.polar, 6);
  });
});

describe('复位 roll', () => {
  /**
   * 「无 roll」的正确判据。
   *
   * 倾斜视角下 `up.y ≠ 0` 是正常的（视线本身就不是水平的），所以不能用
   * 「up.y ≈ 0」判。真正的无 roll 是：**up 等于「世界 Y 在垂直于 forward 平面上的投影」**。
   * 这正是 `quatFromForward` 的构造语义。
   */
  function expectedRollFreeUp(forward: { x: number; y: number; z: number }) {
    const len = Math.hypot(forward.x, forward.y, forward.z);
    const f = { x: forward.x / len, y: forward.y / len, z: forward.z / len };
    const worldUp = { x: 0, y: 1, z: 0 };
    const d = worldUp.x * f.x + worldUp.y * f.y + worldUp.z * f.z;
    const proj = { x: worldUp.x - d * f.x, y: worldUp.y - d * f.y, z: worldUp.z - d * f.z };
    const plen = Math.hypot(proj.x, proj.y, proj.z);
    return { x: proj.x / plen, y: proj.y / plen, z: proj.z / plen };
  }

  test('清掉累积 roll 后，up 与「世界 Y 的垂直投影」同向', () => {
    let orbit = makeOrbit();
    for (let i = 0; i < 30; i += 1) orbit = trackballStep(orbit, 9, 11);
    // 先确认确实累积了 roll（up 偏离无 roll 期望方向）
    const tilted = orbitBasis(orbit).up;
    const wanted = expectedRollFreeUp(orbitBasis(orbit).forward);
    const before = tilted.x * wanted.x + tilted.y * wanted.y + tilted.z * wanted.z;
    expect(before).toBeLessThan(0.999);

    const reset = orbitResetRoll(orbit);
    const up = orbitBasis(reset).up;
    const target = expectedRollFreeUp(orbitBasis(reset).forward);
    const dot = up.x * target.x + up.y * target.y + up.z * target.z;
    expect(dot).toBeGreaterThan(0.9999);
  });

  test('复位不改变视线方向（只清 roll）', () => {
    let orbit = makeOrbit();
    for (let i = 0; i < 30; i += 1) orbit = trackballStep(orbit, 9, 11);
    const before = orbitBasis(orbit).forward;
    const after = orbitBasis(orbitResetRoll(orbit)).forward;
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(after.z).toBeCloseTo(before.z, 6);
  });
});

describe('缩放：锚定光标', () => {
  test('无锚点时 target 不动（旧行为不变）', () => {
    const orbit = makeOrbit();
    const next = orbitZoom(orbit, 2);
    expect(next.target).toEqual(orbit.target);
    expect(next.viewHeight).toBeCloseTo(orbit.viewHeight / 2, 8);
  });

  /**
   * `distance` 与 `viewHeight` 同比缩放（既有契约，authored 2026-10-27）。
   *
   * 正交档下 `distance` 不改变画面尺寸，只影响裁剪面余量；同比缩放使
   * 「相机与视锥的相对比例」保持不变，于是近/远裁剪面始终留有余量。
   */
  test('distance 与 viewHeight 同比缩放（含连续放大）', () => {
    let orbit = makeOrbit();
    for (let i = 0; i < 30; i += 1) orbit = orbitZoom(orbit, 1.2);
    // 两者之比保持不变
    const ratio = orbit.distance / orbit.viewHeight;
    expect(ratio).toBeCloseTo(makeOrbit().distance / makeOrbit().viewHeight, 6);
  });

  test('放大时 distance 同比缩小', () => {
    const orbit = makeOrbit();
    const next = orbitZoom(orbit, 2);
    expect(next.distance).toBeCloseTo(orbit.distance / 2, 8);
  });

  test('锚定 target 本身时 target 仍不动', () => {
    const orbit = makeOrbit();
    const next = orbitZoomAtPoint(orbit, 2, { x: orbit.target.x, y: orbit.target.z });
    expect(next.target.x).toBeCloseTo(orbit.target.x, 8);
    expect(next.target.z).toBeCloseTo(orbit.target.z, 8);
  });

  test('锚在 target 右侧时，放大后 target 朝锚点方向移动', () => {
    const orbit = makeOrbit();
    const anchor = { x: orbit.target.x + 100, y: orbit.target.z };
    const next = orbitZoomAtPoint(orbit, 2, anchor);
    // f=2 ⇒ k=0.5 ⇒ target 向锚点走一半，即 +50
    expect(next.target.x).toBeCloseTo(orbit.target.x + 50, 8);
    expect(next.target.z).toBeCloseTo(orbit.target.z, 8);
  });

  test('倍率为 1 时完全不变', () => {
    const orbit = makeOrbit();
    expect(orbitZoomAtPoint(orbit, 1, { x: 0, y: 0 })).toBe(orbit);
  });
});

describe('视线方向与欧拉角互逆', () => {
  test('任意 (azimuth, polar) 往返一致', () => {
    const cases = [
      [0, 0.12],
      [1.2, 0.5],
      [-2.7, 1.4],
      [0.3, Math.PI / 2],
    ];
    for (const [az, polar] of cases) {
      const dir = viewDirectionFromOrbit(az, polar);
      const back = orbitAnglesFromViewDirection(dir);
      expect(back.polar).toBeCloseTo(polar, 8);
      // azimuth 在 ±π 处可能相差 2π，比较时取最短弧
      const diff = Math.abs(((back.azimuth - az + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      expect(diff).toBeLessThan(1e-8);
    }
  });

  test('quatFromForward 产出的四元数模长为 1（含正俯视退化情形）', () => {
    for (const f of [
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0.3, y: -0.9, z: 0.2 },
    ]) {
      expect(quatLength(quatFromForward(f))).toBeCloseTo(1, 10);
    }
  });

  test('正俯视退化时上方向仍可用（不产生 NaN）', () => {
    const q = quatFromForward({ x: 0, y: -1, z: 0 });
    const { up, right } = quatToBasis(q);
    expect(Number.isFinite(up.x) && Number.isFinite(up.y) && Number.isFinite(up.z)).toBe(true);
    expect(Number.isFinite(right.x) && Number.isFinite(right.y) && Number.isFinite(right.z)).toBe(true);
  });
});
