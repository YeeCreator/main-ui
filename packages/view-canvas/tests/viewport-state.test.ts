import { describe, expect, test } from 'vitest';
import { classifyWheel, wheelPanDelta } from '@main-ui/core/input';
import {
  cameraTransformOf,
  constrainScale,
  fitCamera,
  panCamera,
  pinchZoomFactor,
  wheelZoomFactor,
  zoomByFactor,
} from '../src/viewport-state';

describe('view-canvas viewport-state', () => {
  test('constrainScale clamps scale but keeps pan (and omits zero rotation)', () => {
    expect(constrainScale({ scale: 100, pan: { x: 5, y: 6 } }, 0.2, 4)).toEqual({ scale: 4, pan: { x: 5, y: 6 } });
    expect(constrainScale({ scale: 0.01, pan: { x: 5, y: 6 } }, 0.2, 4)).toEqual({ scale: 0.2, pan: { x: 5, y: 6 } });
    const withRot = constrainScale({ scale: 2, pan: { x: 1, y: 1 }, rotation: 0.5 }, 0.2, 4);
    expect(withRot.rotation).toBeCloseTo(0.5, 6);
  });

  test('fitCamera returns null for degenerate size and centers otherwise', () => {
    expect(fitCamera({ width: 0, height: 0 }, { x: 0, y: 0, width: 100, height: 50 }, 0, 0.2, 8)).toBeNull();
    const camera = fitCamera({ width: 200, height: 100 }, { x: 0, y: 0, width: 100, height: 50 }, 0, 0.2, 8);
    expect(camera?.scale).toBe(2);
  });

  test('zoomByFactor anchors at container center by default', () => {
    const camera = { scale: 1, pan: { x: 0, y: 0 } };
    const next = zoomByFactor(camera, { width: 100, height: 100 }, 2, null, 0.2, 8);
    expect(next.scale).toBe(2);
    // anchor (50,50); world before = (50,50); pan' = 50 - 50*2 = -50
    expect(next.pan).toEqual({ x: -50, y: -50 });
  });

  test('zoomByFactor respects scale bounds', () => {
    const camera = { scale: 3.9, pan: { x: 0, y: 0 } };
    const next = zoomByFactor(camera, { width: 100, height: 100 }, 2, null, 0.2, 4);
    expect(next.scale).toBe(4);
  });

  test('wheelZoomFactor is exponential in deltaY', () => {
    expect(wheelZoomFactor(0)).toBe(1);
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100)).toBeLessThan(1);
  });

  test('panCamera translates in screen pixels', () => {
    expect(panCamera({ scale: 1, pan: { x: 0, y: 0 } }, { x: 7, y: -3 }).pan).toEqual({ x: 7, y: -3 });
  });

  test('cameraTransformOf renders translate+scale', () => {
    expect(cameraTransformOf({ scale: 2, pan: { x: 5, y: 6 } })).toBe('translate(5 6) scale(2)');
  });
});

describe('滚轮手势分类（触控板 vs 鼠标）', () => {
  const base = { ctrlKey: false, metaKey: false, deltaX: 0, deltaY: 0, deltaMode: 0 };
  const at = (patch: Partial<typeof base>) => ({ ...base, ...patch });

  test('触控板双指捏合（浏览器置 ctrlKey）→ pinch', () => {
    expect(classifyWheel(at({ ctrlKey: true, deltaY: 4 }))).toBe('pinch');
    expect(classifyWheel(at({ metaKey: true, deltaY: -6 }))).toBe('pinch');
  });

  test('Ctrl/Cmd + 鼠标滚轮（大整数 delta）→ zoom，不走捏合档', () => {
    // 回归护栏：Ctrl/⌘ 只表示「要缩放」，不表示「来自触控板」。
    // 旧实现把两者压成一个 'pinch'，于是鼠标 deltaY=±100 套用 PINCH_ZOOM_SPEED
    // → exp(100 × 0.01) ≈ 2.718，连拨两次即撞 maxScale。
    expect(classifyWheel(at({ ctrlKey: true, deltaY: 120 }))).toBe('zoom');
    expect(classifyWheel(at({ metaKey: true, deltaY: -100 }))).toBe('zoom');
  });

  test('触控板横向平移（deltaX≠0）→ pan', () => {
    expect(classifyWheel(at({ deltaX: 12, deltaY: -3 }))).toBe('pan');
  });

  test('纵向浮点小量（触控板特征）→ pan', () => {
    expect(classifyWheel(at({ deltaY: 7.5 }))).toBe('pan');
  });

  test('鼠标滚轮（整数大刻度）→ zoom', () => {
    expect(classifyWheel(at({ deltaY: -100 }))).toBe('zoom');
    expect(classifyWheel(at({ deltaY: 120 }))).toBe('zoom');
  });

  test('行/页模式（老式鼠标）→ zoom', () => {
    expect(classifyWheel(at({ deltaY: 3, deltaMode: 1 }))).toBe('zoom');
  });

  test('小幅整数滚动（< 阈值）按触控板平移处理', () => {
    expect(classifyWheel(at({ deltaY: 12 }))).toBe('pan');
    expect(classifyWheel(at({ deltaY: 40 }))).toBe('zoom');
  });

  test('捏合灵敏度高于鼠标滚轮（否则捏合几乎没反应）', () => {
    const deltaY = 4;
    expect(pinchZoomFactor(deltaY)).toBeLessThan(wheelZoomFactor(deltaY));
    // 捏合单次至少 3% 变化，滚轮系数下不足 1%
    expect(1 - pinchZoomFactor(deltaY)).toBeGreaterThan(0.03);
    expect(1 - wheelZoomFactor(deltaY)).toBeLessThan(0.01);
  });

  test('平移位移取负（双指推内容的方向）', () => {
    expect(wheelPanDelta({ deltaX: 10, deltaY: -20 })).toEqual({ x: -10, y: 20 });
  });
});
