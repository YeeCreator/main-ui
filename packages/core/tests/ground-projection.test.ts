/**
 * 屏幕 ↔ 地面 的正交反投影：**任意姿态下都必须精确互逆**。
 *
 * ## 守住什么
 *
 * 2026-11-08 使用者报告两处三维交互故障：
 *
 * 1. 「旋转按下左键的时候位移定位会突然偏移」
 * 2. 「旋转一段时间后，无论是否摆正，中键平移操作可能会错乱」
 *
 * 这两个是**同一个根因**：早期 `screenToWorld` 用的是「屏幕旋转 + `cos(polar)`
 * 纵向压缩」的简化模型，它隐含「相机 up 与世界 Y 同向」的假设。
 * 一旦姿态带 roll（轨迹球 / 绕视线自转），假设失效 ——
 * `screenToWorld` 与实际渲染出来的画面不再自洽，
 * 于是「看到的位置」和「算出来的位置」对不上。
 *
 * 修法是用相机的真实基向量做正交反投影（`screenToGroundOrtho` /
 * `groundToScreenOrtho`）。本文件守住它：
 *
 * - **往返一致**：`groundToScreen(screenToGround(p)) === p`
 * - **与相机无关**：任意 roll / polar / 方位角都要过
 * - **退化安全**：视线水平时不产生 NaN
 */

import { describe, expect, test } from 'vitest';
import {
  defaultOrbitCamera,
  groundToScreenOrtho,
  orbitBasis,
  orbitFocus,
  orbitRoll,
  orbitRotatePixels,
  screenToGroundOrtho,
  type OrbitCamera,
} from '../src/rendering/camera-bridge';

const VIEWPORT = { width: 800, height: 600 };

/** 造一台相机。 */
function makeOrbit(overrides: Partial<OrbitCamera> = {}): OrbitCamera {
  return {
    target: { x: 256, y: 0, z: 256 },
    azimuth: 0,
    polar: 0.12,
    distance: 1024,
    viewHeight: 600,
    ...overrides,
  };
}

/** 视锥半宽/半高（与后端 `planCamera` 同公式：halfWidth = halfHeight · aspect）。 */
function frustum(viewHeight = 600) {
  const aspect = VIEWPORT.width / VIEWPORT.height;
  const halfHeight = viewHeight / 2;
  return { halfWidth: halfHeight * aspect, halfHeight };
}

/** 用给定相机把屏幕点换算到地面。 */
function toGround(orbit: OrbitCamera, screen: { x: number; y: number }) {
  const { halfWidth, halfHeight } = frustum(orbit.viewHeight);
  return screenToGroundOrtho({
    screen,
    basis: orbitBasis(orbit),
    target: orbit.target,
    halfWidth,
    halfHeight,
    viewportPx: VIEWPORT,
  });
}

/** 用给定相机把地面点换算回屏幕。 */
function toScreen(orbit: OrbitCamera, world: { x: number; y: number }) {
  const { halfWidth, halfHeight } = frustum(orbit.viewHeight);
  return groundToScreenOrtho({
    world,
    basis: orbitBasis(orbit),
    target: orbit.target,
    halfWidth,
    halfHeight,
    viewportPx: VIEWPORT,
  });
}

/** 一组覆盖各种姿态的相机（含带 roll 的）。 */
const POSES: Array<{ name: string; orbit: OrbitCamera }> = [
  { name: '正俯视（polar≈0.12）', orbit: makeOrbit() },
  { name: '倾斜 45 度', orbit: makeOrbit({ polar: Math.PI / 4 }) },
  { name: '大幅倾斜（polar=1.2）', orbit: makeOrbit({ polar: 1.2 }) },
  { name: '转盘旋转方位角', orbit: makeOrbit({ azimuth: 1.1, polar: 0.8 }) },
  { name: '轨迹球 roll 30 度', orbit: orbitRoll(makeOrbit({ polar: 0.7 }), 0.52) },
  { name: '轨迹球 roll -80 度 + 方位角', orbit: orbitRoll(makeOrbit({ azimuth: 2.1, polar: 0.9 }), -1.4) },
  { name: '轨迹球 roll 180 度（倒过来）', orbit: orbitRoll(makeOrbit({ polar: 0.5 }), Math.PI) },
  { name: '平移过的 target', orbit: makeOrbit({ target: { x: -120, y: 0, z: 830 }, polar: 0.6 }) },
  { name: '缩放过的视锥', orbit: makeOrbit({ viewHeight: 120, polar: 0.9 }) },
];

describe('屏幕 ↔ 地面：往返一致', () => {
  const SCREEN_POINTS = [
    { x: 400, y: 300 }, // 中心
    { x: 0, y: 0 }, // 左上角
    { x: 800, y: 600 }, // 右下角
    { x: 137, y: 521 }, // 任意点
    { x: 650, y: 90 },
  ];

  for (const { name, orbit } of POSES) {
    test(`${name}：往返回到原点`, () => {
      for (const screen of SCREEN_POINTS) {
        const world = toGround(orbit, screen);
        const back = toScreen(orbit, world);
        expect(back.x).toBeCloseTo(screen.x, 6);
        expect(back.y).toBeCloseTo(screen.y, 6);
      }
    });
  }

  for (const { name, orbit } of POSES) {
    test(`${name}：地面点往返回到原点`, () => {
      for (const world of [
        { x: 256, y: 256 },
        { x: 100, y: 400 },
        { x: -300, y: 900 },
      ]) {
        const screen = toScreen(orbit, world);
        const back = toGround(orbit, screen);
        expect(back.x).toBeCloseTo(world.x, 6);
        expect(back.y).toBeCloseTo(world.y, 6);
      }
    });
  }
});

describe('屏幕 ↔ 地面：语义正确', () => {
  test('屏幕中心对应 target 的地面投影（任意姿态）', () => {
    for (const { name, orbit } of POSES) {
      const center = toGround(orbit, { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 });
      expect(center.x, name).toBeCloseTo(orbit.target.x, 6);
      expect(center.y, name).toBeCloseTo(orbit.target.z, 6);
    }
  });

  test('正俯视无 roll：屏幕向右 = 世界 +X，屏幕向下 = 世界 +Z', () => {
    const orbit = makeOrbit();
    const center = toGround(orbit, { x: 400, y: 300 });
    const right = toGround(orbit, { x: 450, y: 300 });
    const down = toGround(orbit, { x: 400, y: 350 });
    expect(right.x).toBeGreaterThan(center.x);
    expect(Math.abs(right.y - center.y)).toBeLessThan(1e-6);
    expect(down.y).toBeGreaterThan(center.y);
    expect(Math.abs(down.x - center.x)).toBeLessThan(1e-6);
  });

  test('带 roll 时屏幕位移方向与无 roll 不同（这正是旧实现的破绽）', () => {
    const plain = makeOrbit({ polar: 0.7 });
    const rolled = orbitRoll(plain, Math.PI / 3);
    const plainRight = toGround(plain, { x: 500, y: 300 });
    const rolledRight = toGround(rolled, { x: 500, y: 300 });
    // 同一次「屏幕向右」在两个姿态下落到不同的世界点
    expect(Math.abs(plainRight.y - rolledRight.y)).toBeGreaterThan(1);
  });

  test('roll 360 度后与 roll 0 等价', () => {
    const base = makeOrbit({ polar: 0.7 });
    const full = orbitRoll(base, Math.PI * 2);
    const a = toGround(base, { x: 520, y: 380 });
    const b = toGround(full, { x: 520, y: 380 });
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.y).toBeCloseTo(a.y, 6);
  });
});

describe('屏幕 ↔ 地面：退化输入安全', () => {
  test('视线水平（polar = π/2）时不产生 NaN/Infinity', () => {
    const orbit = makeOrbit({ polar: Math.PI / 2 });
    for (const screen of [
      { x: 400, y: 300 },
      { x: 10, y: 590 },
    ]) {
      const w = toGround(orbit, screen);
      expect(Number.isFinite(w.x)).toBe(true);
      expect(Number.isFinite(w.y)).toBe(true);
    }
  });

  test('零尺寸视口不产生 NaN', () => {
    const orbit = makeOrbit();
    const r = screenToGroundOrtho({
      screen: { x: 0, y: 0 },
      basis: orbitBasis(orbit),
      target: orbit.target,
      halfWidth: 300,
      halfHeight: 200,
      viewportPx: { width: 0, height: 0 },
    });
    expect(Number.isFinite(r.x)).toBe(true);
    expect(Number.isFinite(r.y)).toBe(true);
  });
});

describe('绕枢轴旋转：枢轴屏幕位置不动，画面不跳', () => {
  const PIVOT = { x: 180, y: 330 };

  for (const { name, orbit } of POSES) {
    test(`${name}：绕枢轴旋转后，枢轴点的屏幕位置不变`, () => {
      const before = toScreen(orbit, PIVOT);
      const next = orbitRotatePixels(orbit, 37, -21, PIVOT);
      const after = toScreen(next, PIVOT);
      expect(after.x).toBeCloseTo(before.x, 4);
      expect(after.y).toBeCloseTo(before.y, 4);
    });
  }

  test('不给像素位移时相机不变（同一对象）', () => {
    const orbit = makeOrbit();
    expect(orbitRotatePixels(orbit, 0, 0)).toBe(orbit);
  });

  test('带 roll 的相机上，绕枢轴旋转仍保持枢轴不动（旧实现做不到）', () => {
    const rolled = orbitRoll(makeOrbit({ polar: 0.75 }), 0.9);
    const before = toScreen(rolled, PIVOT);
    const next = orbitRotatePixels(rolled, -55, 28, PIVOT);
    const after = toScreen(next, PIVOT);
    expect(after.x).toBeCloseTo(before.x, 4);
    expect(after.y).toBeCloseTo(before.y, 4);
  });

  test('枢轴之外的其它点确实动了（不是整机不动）', () => {
    const orbit = makeOrbit({ polar: 0.6 });
    const other = { x: 400, y: 100 };
    const before = toScreen(orbit, other);
    const next = orbitRotatePixels(orbit, 60, 0, PIVOT);
    const after = toScreen(next, other);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(1);
  });
});

describe('轨迹球方向：拖向哪，球就朝哪滚', () => {
  /**
   * 判据怎么选。
   *
   * 「跟手」的直接含义是：**球面上的接触点跟着手指走**。
   * 但这不能简单用「某个世界点朝屏幕同侧移动」来测 ——
   * 横向拖拽的转轴落在屏幕平面内（`up` 方向），绕它转会让探测点
   * 沿**屏幕外**做圆周运动，其屏幕 x 投影不一定单调。
   *
   * 可靠的等价判据是看**视线方向**的变化：
   * - 向右拖 ⇒ 视线朝右偏（`forward.x` 增大）
   * - 向下拖 ⇒ 视线朝下偏（`forward.y` 减小）
   *
   * 这正是 Blender 里「往右拖，模型跟着往右翻过去」的数学表达。
   */
  const makeTrackball = (): OrbitCamera => ({
    ...makeOrbit({ polar: 0.6 }),
    rotationModel: 'trackball',
  });

  test('向右拖 ⇒ 视线朝右偏', () => {
    const orbit = makeTrackball();
    const before = orbitBasis(orbit).forward.x;
    const next = orbitRotatePixels(orbit, 80, 0, { x: orbit.target.x, y: orbit.target.z });
    expect(orbitBasis(next).forward.x).toBeGreaterThan(before);
  });

  test('向左拖 ⇒ 视线朝左偏', () => {
    const orbit = makeTrackball();
    const before = orbitBasis(orbit).forward.x;
    const next = orbitRotatePixels(orbit, -80, 0, { x: orbit.target.x, y: orbit.target.z });
    expect(orbitBasis(next).forward.x).toBeLessThan(before);
  });

  test('向下拖 ⇒ 视线朝下偏（俯角变小 / 更平视）', () => {
    const orbit = makeTrackball();
    const before = orbitBasis(orbit).forward.y;
    const next = orbitRotatePixels(orbit, 0, 80, { x: orbit.target.x, y: orbit.target.z });
    expect(orbitBasis(next).forward.y).toBeLessThan(before);
  });

  test('向上拖 ⇒ 视线朝上偏', () => {
    const orbit = makeTrackball();
    const before = orbitBasis(orbit).forward.y;
    const next = orbitRotatePixels(orbit, 0, -80, { x: orbit.target.x, y: orbit.target.z });
    expect(orbitBasis(next).forward.y).toBeGreaterThan(before);
  });

  test('转盘模型：向右拖 ⇒ 视线朝右偏（同样跟手）', () => {
    const orbit: OrbitCamera = { ...makeOrbit({ polar: 0.6 }), rotationModel: 'turntable' };
    const before = orbitBasis(orbit).forward.x;
    const next = orbitRotatePixels(orbit, 80, 0, { x: orbit.target.x, y: orbit.target.z });
    expect(orbitBasis(next).forward.x).toBeGreaterThan(before);
  });

  test('转盘模型：向下拖 ⇒ 视线朝下偏', () => {
    const orbit: OrbitCamera = { ...makeOrbit({ polar: 0.6 }), rotationModel: 'turntable' };
    const before = orbitBasis(orbit).forward.y;
    const next = orbitRotatePixels(orbit, 0, 80, { x: orbit.target.x, y: orbit.target.z });
    expect(orbitBasis(next).forward.y).toBeLessThan(before);
  });

  test('两种模型对同一次拖拽的视线变化方向相同（不会「换个模式就反了」）', () => {
    const tb = orbitRotatePixels(
      { ...makeOrbit({ polar: 0.6 }), rotationModel: 'trackball' },
      60,
      40,
      { x: 256, y: 256 },
    );
    const tt = orbitRotatePixels(
      { ...makeOrbit({ polar: 0.6 }), rotationModel: 'turntable' },
      60,
      40,
      { x: 256, y: 256 },
    );
    const fb = orbitBasis(tb).forward;
    const ft = orbitBasis(tt).forward;
    // x 分量同号（都朝右偏）
    expect(Math.sign(fb.x)).toBe(Math.sign(ft.x));
  });
});

describe('复位与聚焦', () => {
  const WORLD = { x: 0, y: 0, width: 512, height: 512 };

  test('defaultOrbitCamera 回到俯视、居中、视锥按世界高度', () => {
    const cam = defaultOrbitCamera({ world: WORLD });
    expect(cam.target.x).toBeCloseTo(256, 6);
    expect(cam.target.z).toBeCloseTo(256, 6);
    expect(cam.azimuth).toBe(0);
    expect(cam.polar).toBeLessThan(0.3);
    expect(cam.viewHeight).toBeCloseTo(512, 6);
    expect(cam.orientation).toBeUndefined();
  });

  test('orbitFocus 只改平移与缩放，保留朝向', () => {
    const orbit = orbitRoll(makeOrbit({ azimuth: 1.2, polar: 0.8 }), 0.4);
    const focused = orbitFocus(orbit, { x: 100, y: 100, width: 200, height: 100 }, { aspect: 1.5 });
    // 朝向未变
    const b0 = orbitBasis(orbit);
    const b1 = orbitBasis(focused);
    expect(b1.forward.x).toBeCloseTo(b0.forward.x, 8);
    expect(b1.forward.y).toBeCloseTo(b0.forward.y, 8);
    expect(b1.up.x).toBeCloseTo(b0.up.x, 8);
    // 目标挪到范围中心
    expect(focused.target.x).toBeCloseTo(200, 6);
    expect(focused.target.z).toBeCloseTo(150, 6);
  });

  test('orbitFocus 在倾斜视角下按 cos(polar) 补偿，避免纵向溢出', () => {
    const flat = makeOrbit({ polar: 0.05 });
    const tilted = makeOrbit({ polar: 1.2 });
    const target = { x: 0, y: 0, width: 200, height: 200 };
    const f1 = orbitFocus(flat, target, { aspect: 1 });
    const f2 = orbitFocus(tilted, target, { aspect: 1 });
    // 越倾斜，需要的视锥高度越大（纵向被压缩）
    expect(f2.viewHeight).toBeGreaterThan(f1.viewHeight);
  });

  test('orbitFocus 不会把 distance 缩到场景内', () => {
    const orbit = makeOrbit();
    const focused = orbitFocus(orbit, { x: 0, y: 0, width: 10, height: 10 });
    expect(focused.distance).toBeGreaterThanOrEqual(focused.viewHeight);
  });
});
