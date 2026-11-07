import { describe, expect, test } from 'vitest';
import { OrbitCamera } from '@main-ui/core/rendering';
import {
  fitViewHeightForWorld,
  planCamera,
  screenToWorldOrtho,
  worldToScreenOrtho,
} from '../src/camera-plan';

/**
 * 三维档「画面装得下世界」的不变量。
 *
 * 这组用例的由来（2026-11-07 实机事故）：三维档切过去后主画面只剩一大片空白，
 * 盘面缩成一小块。事后确认不是渲染坏了，是**视锥尺寸算错** —— 世界只占了
 * 屏幕的一小角。而这类错误在单测里本可以钉死，故补上。
 *
 * 判据不依赖具体实现：**把世界四角投到屏幕，必须都落在可视区内**。
 */

function makeOrbit(viewHeight: number, polar = 0.12): OrbitCamera {
  return {
    target: { x: 256, y: 0, z: 256 },
    azimuth: 0,
    polar,
    distance: viewHeight * 2,
    viewHeight,
  };
}

/** 按 3D 后端 `fitToBounds` 的算法求视锥高度 —— **直接调用后端同一份实现**。 */
function fitViewHeight(
  container: { width: number; height: number },
  world: { width: number; height: number },
  paddingPx = 0,
): number {
  return fitViewHeightForWorld({ containerPx: container, world, paddingPx });
}

describe('三维档视锥：世界必须完整落在画面内', () => {
  const WORLD = { width: 512, height: 512 };

  for (const container of [
    { width: 960, height: 445, label: '横长（实机事故尺寸）' },
    { width: 426, height: 845, label: '竖长' },
    { width: 800, height: 800, label: '正方' },
    { width: 1200, height: 300, label: '极扁' },
  ]) {
    test(`容器 ${container.width}x${container.height}（${container.label}）四角都在屏内`, () => {
      const viewHeight = fitViewHeight(container, WORLD);
      const orbit = makeOrbit(viewHeight, 0.12);
      const plan = planCamera({ orbit, viewportPx: container });
      if (plan.kind !== 'orthographic') throw new Error('应为正交档');

      // 世界四角（取地面平面坐标）
      const corners = [
        { x: 0, y: 0 },
        { x: WORLD.width, y: 0 },
        { x: 0, y: WORLD.height },
        { x: WORLD.width, y: WORLD.height },
      ];

      for (const c of corners) {
        const s = worldToScreenOrtho({
          world: c,
          plan,
          viewportPx: container,
          screenRotation: -orbit.azimuth,
          polar: orbit.polar,
        });
        // 允许 1px 的浮点误差
        expect(s.x).toBeGreaterThanOrEqual(-1);
        expect(s.x).toBeLessThanOrEqual(container.width + 1);
        expect(s.y).toBeGreaterThanOrEqual(-1);
        expect(s.y).toBeLessThanOrEqual(container.height + 1);
      }
    });
  }

  test('世界至少占满其中一个方向（不是缩在一角）', () => {
    const container = { width: 960, height: 445 };
    const viewHeight = fitViewHeight(container, WORLD);
    const orbit = makeOrbit(viewHeight, 0.12);
    const plan = planCamera({ orbit, viewportPx: container });
    if (plan.kind !== 'orthographic') throw new Error('应为正交档');

    const left = worldToScreenOrtho({ world: { x: 0, y: 256 }, plan, viewportPx: container, polar: orbit.polar });
    const right = worldToScreenOrtho({ world: { x: 512, y: 256 }, plan, viewportPx: container, polar: orbit.polar });
    const top = worldToScreenOrtho({ world: { x: 256, y: 0 }, plan, viewportPx: container, polar: orbit.polar });
    const bottom = worldToScreenOrtho({ world: { x: 256, y: 512 }, plan, viewportPx: container, polar: orbit.polar });

    const spanX = Math.abs(right.x - left.x);
    const spanY = Math.abs(bottom.y - top.y);

    /**
     * 判据是「至少一个方向贴边」，不是「两个方向都满」。
     *
     * 横长容器（960×445）配正方形世界（512×512）时，纵向必然贴边、横向必然留白 ——
     * 这是保持等比（圆不变椭圆）的必然代价。要求两向都满就只能是拉伸。
     */
    const fillX = spanX / container.width;
    const fillY = spanY / container.height;
    expect(Math.max(fillX, fillY)).toBeGreaterThan(0.9);
  });
});

describe('屏幕↔世界换算在倾斜视角下自洽', () => {
  const container = { width: 960, height: 445 };

  for (const polar of [0, 0.12, 0.4, 0.8]) {
    test(`polar=${polar} 往返一致`, () => {
      const orbit = makeOrbit(fitViewHeight(container, { width: 512, height: 512 }), polar);
      const plan = planCamera({ orbit, viewportPx: container });
      if (plan.kind !== 'orthographic') throw new Error('应为正交档');

      // 取几个屏幕点，转世界再转回屏幕，必须回到原点
      const screens = [
        { x: 100, y: 100 },
        { x: 480, y: 222 },
        { x: 860, y: 380 },
      ];
      for (const s of screens) {
        const w = screenToWorldOrtho({ screen: s, plan, viewportPx: container, screenRotation: -orbit.azimuth, polar });
        const back = worldToScreenOrtho({ world: w, plan, viewportPx: container, screenRotation: -orbit.azimuth, polar });
        expect(back.x).toBeCloseTo(s.x, 6);
        expect(back.y).toBeCloseTo(s.y, 6);
      }
    });
  }

  test('倾斜后屏幕中心仍对应 target（视角中心不漂移）', () => {
    const container2 = { width: 960, height: 445 };
    const orbit = makeOrbit(fitViewHeight(container2, { width: 512, height: 512 }), 0.5);
    const plan = planCamera({ orbit, viewportPx: container2 });
    if (plan.kind !== 'orthographic') throw new Error('应为正交档');

    const center = screenToWorldOrtho({
      screen: { x: container2.width / 2, y: container2.height / 2 },
      plan,
      viewportPx: container2,
      screenRotation: -orbit.azimuth,
      polar: orbit.polar,
    });
    expect(center.x).toBeCloseTo(orbit.target.x, 6);
    expect(center.y).toBeCloseTo(orbit.target.z, 6);
  });
});
