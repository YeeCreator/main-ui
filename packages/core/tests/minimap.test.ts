import { describe, expect, test } from 'vitest';
import {
  MINIMAP_VIEWPORT_MIN_SIZE,
  contentWorldBounds,
  minimapTransform,
  minimapViewportRect,
  panToMinimapPoint,
  visibleWorldRectOfCamera,
} from '../src/rendering/minimap';

const WORLD = { x: 0, y: 0, width: 1000, height: 500 };
const SIZE = { width: 200, height: 100 };

describe('contentWorldBounds · 内容包围盒', () => {
  test('多项合并为外接矩形', () => {
    const bounds = contentWorldBounds([
      { x: 10, y: 20, width: 30, height: 40 },
      { x: 100, y: 5, width: 10, height: 10 },
    ]);
    expect(bounds).toEqual({ x: 10, y: 5, width: 100, height: 55 });
  });

  test('空输入返回 null（不是零矩形）', () => {
    expect(contentWorldBounds([])).toBeNull();
  });

  test('退化为点时给最小尺寸，避免除零', () => {
    const bounds = contentWorldBounds([{ x: 5, y: 5, width: 0, height: 0 }]);
    expect(bounds).toEqual({ x: 5, y: 5, width: 1, height: 1 });
  });
});

describe('minimapTransform · 世界 ↔ 缩略图', () => {
  test('等比适配：取两方向较小比例，不拉伸', () => {
    const t = minimapTransform(WORLD, SIZE, 0);
    // 200/1000 = 0.2；100/500 = 0.2 —— 两个方向恰好相等
    expect(t.scale).toBeCloseTo(0.2);
    expect(t.worldToMinimap({ x: 500, y: 250 })).toEqual({ x: 100, y: 50 });
  });

  test('宽高比不一致时按较小比例缩放（宁可留白，不拉伸）', () => {
    // 世界很宽很矮，缩略图很方：应以宽度为准
    const t = minimapTransform({ x: 0, y: 0, width: 1000, height: 100 }, { width: 200, height: 200 }, 0);
    expect(t.scale).toBeCloseTo(0.2);
    // 内容只占 20px 高，上下居中
    expect(t.worldToMinimap({ x: 0, y: 0 }).y).toBeCloseTo(90);
  });

  test('padding 四周留白', () => {
    const t = minimapTransform(WORLD, SIZE, 10);
    // 可用区 180×80，比例 min(0.18, 0.16) = 0.16
    expect(t.scale).toBeCloseTo(0.16);
    const topLeft = t.worldToMinimap({ x: 0, y: 0 });
    expect(topLeft.x).toBeGreaterThanOrEqual(10);
    expect(topLeft.y).toBeGreaterThanOrEqual(10);
  });

  test('反向换算可还原（往返一致）', () => {
    const t = minimapTransform(WORLD, SIZE, 6);
    const original = { x: 321, y: 123 };
    const roundTrip = t.minimapToWorld(t.worldToMinimap(original));
    expect(roundTrip.x).toBeCloseTo(original.x);
    expect(roundTrip.y).toBeCloseTo(original.y);
  });

  test('矩形换算两个方向都可还原', () => {
    const t = minimapTransform(WORLD, SIZE, 6);
    const rect = { x: 100, y: 50, width: 200, height: 100 };
    const back = t.minimapRectToWorld(t.worldRectToMinimap(rect));
    expect(back.x).toBeCloseTo(rect.x);
    expect(back.width).toBeCloseTo(rect.width);
  });

  test('世界原点不在 (0,0) 时也正确对齐', () => {
    const t = minimapTransform({ x: 500, y: 500, width: 100, height: 100 }, SIZE, 0);
    // 世界左上角应落在缩略图内容区左上（此例等比后居中）
    const topLeft = t.worldToMinimap({ x: 500, y: 500 });
    expect(topLeft.x).toBeCloseTo(50);
    expect(topLeft.y).toBeCloseTo(0);
  });
});

describe('visibleWorldRectOfCamera · 相机反算可见范围', () => {
  test('缩小时可见世界范围变大', () => {
    const rect = visibleWorldRectOfCamera({ scale: 0.5, pan: { x: 0, y: 0 } }, { width: 800, height: 600 });
    expect(rect.width).toBe(1600);
    expect(rect.height).toBe(1200);
  });

  test('pan 为正时世界原点在屏幕右下，可见范围随之左移', () => {
    // screen = pan + world * scale；pan=100 且 scale=1 时，
    // 屏幕 x=0 对应世界 x=-100，故可见范围从 -100 开始。
    const rect = visibleWorldRectOfCamera({ scale: 1, pan: { x: 100, y: 50 } }, { width: 800, height: 600 });
    expect(rect.x).toBe(-100);
    expect(rect.y).toBe(-50);
  });

  test('scale 为 0 时按 1 处理，不产生 Infinity', () => {
    const rect = visibleWorldRectOfCamera({ scale: 0, pan: { x: 0, y: 0 } }, { width: 800, height: 600 });
    expect(Number.isFinite(rect.width)).toBe(true);
    expect(rect.width).toBe(800);
  });
});

describe('minimapViewportRect · 视口框最小可见尺寸', () => {
  const transform = minimapTransform(WORLD, SIZE, 0);

  test('正常尺寸时与真实映射一致', () => {
    const viewport = { x: 100, y: 100, width: 400, height: 200 };
    const drawn = minimapViewportRect(transform, viewport);
    const expected = transform.worldRectToMinimap(viewport);
    expect(drawn.width).toBeCloseTo(expected.width);
    expect(drawn.height).toBeCloseTo(expected.height);
  });

  test('放大到极小视口时撑到下限，且中心不变', () => {
    const tiny = { x: 500, y: 250, width: 1, height: 1 };
    const drawn = minimapViewportRect(transform, tiny);
    expect(drawn.width).toBe(MINIMAP_VIEWPORT_MIN_SIZE);
    expect(drawn.height).toBe(MINIMAP_VIEWPORT_MIN_SIZE);
    // 中心应与真实矩形的中心重合
    const real = transform.worldRectToMinimap(tiny);
    expect(drawn.x + drawn.width / 2).toBeCloseTo(real.x + real.width / 2);
  });
});

describe('panToMinimapPoint · 点击跳转', () => {
  const transform = minimapTransform(WORLD, SIZE, 0);
  const viewportSize = { width: 800, height: 600 };

  test('点击后该世界点落在视口中心', () => {
    const click = { x: 100, y: 50 }; // 缩略图中心 → 世界 (500, 250)
    const scale = 2;
    const pan = panToMinimapPoint(transform, click, viewportSize, scale);

    // 用 worldToScreen 复核：screen = pan + world * scale
    const world = transform.minimapToWorld(click);
    const screenX = pan.x + world.x * scale;
    const screenY = pan.y + world.y * scale;
    expect(screenX).toBeCloseTo(viewportSize.width / 2);
    expect(screenY).toBeCloseTo(viewportSize.height / 2);
  });

  test('点击左侧的点得到更大的 pan.x（相机右移，内容左移）', () => {
    const left = panToMinimapPoint(transform, { x: 10, y: 50 }, viewportSize, 1);
    const right = panToMinimapPoint(transform, { x: 190, y: 50 }, viewportSize, 1);
    // 点越靠左，世界坐标越小，pan 越大（要把左边的内容推到屏幕中心）
    expect(left.x).toBeGreaterThan(right.x);
  });
});
