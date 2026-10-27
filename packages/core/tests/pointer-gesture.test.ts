/**
 * pointer-gesture 的行为契约测试。
 *
 * 三条硬纪律：
 * 1. 「不参与判别」（`null`）必须可表达 —— 「轻点选中」不能被手指微抖吞掉；
 * 2. 越过容差即为拖拽，且容差**逐次传入**（宿主 prop 可响应式变化）；
 * 3. 判别与「是否捕获 / 是否平移」解耦 —— 本模块不碰 DOM。
 */
import { describe, expect, test } from 'vitest';
import {
  DEFAULT_TAP_TOLERANCE_PX,
  classifyPointerGesture,
  createPointerGestureTracker,
  normalizeTolerance,
  resolveTapTolerance,
} from '../src/rendering/pointer-gesture';

describe('normalizeTolerance', () => {
  test('null / undefined / 非有限值 → 不参与判别', () => {
    expect(normalizeTolerance(null)).toBe(Number.POSITIVE_INFINITY);
    expect(normalizeTolerance(undefined)).toBe(Number.POSITIVE_INFINITY);
    expect(normalizeTolerance(Number.NaN)).toBe(Number.POSITIVE_INFINITY);
    expect(normalizeTolerance(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });

  test('负数归零', () => {
    expect(normalizeTolerance(-5)).toBe(0);
    expect(normalizeTolerance(4)).toBe(4);
  });
});

describe('classifyPointerGesture', () => {
  const start = { x: 100, y: 100 };

  test('容差内为轻点', () => {
    expect(classifyPointerGesture(start, { x: 102, y: 102 }, DEFAULT_TAP_TOLERANCE_PX)).toBe('tap');
  });

  test('越过容差为拖拽', () => {
    expect(classifyPointerGesture(start, { x: 110, y: 100 }, DEFAULT_TAP_TOLERANCE_PX)).toBe('drag');
  });

  test('不参与判别时位移再大也是轻点（轻点选中）', () => {
    expect(classifyPointerGesture(start, { x: 400, y: 400 }, null)).toBe('tap');
  });

  test('容差可放宽到触摸抖动范围', () => {
    expect(classifyPointerGesture(start, { x: 108, y: 106 }, 12)).toBe('tap');
    expect(classifyPointerGesture(start, { x: 108, y: 106 }, 4)).toBe('drag');
  });
});

describe('createPointerGestureTracker', () => {
  test('轻点 → up 返回 tap', () => {
    const tracker = createPointerGestureTracker();
    tracker.down({ x: 10, y: 10 });
    expect(tracker.move({ x: 12, y: 11 })).toBe(false);
    expect(tracker.up({ x: 12, y: 11 })).toBe('tap');
  });

  test('拖拽 → up 返回 drag，delta/distance 可用', () => {
    const tracker = createPointerGestureTracker({ tolerancePx: 4 });
    tracker.down({ x: 10, y: 10 });
    expect(tracker.move({ x: 40, y: 50 })).toBe(true);
    expect(tracker.hasMoved()).toBe(true);
    expect(tracker.delta()).toEqual({ x: 30, y: 40 });
    expect(tracker.distance()).toBeCloseTo(50, 6);
    expect(tracker.up()).toBe('drag');
  });

  test('容差可逐次覆盖构造参数', () => {
    const tracker = createPointerGestureTracker({ tolerancePx: 4 });
    tracker.down({ x: 0, y: 0 });
    expect(tracker.move({ x: 8, y: 0 }, 12)).toBe(false);
    expect(tracker.up({ x: 8, y: 0 }, 12)).toBe('tap');
  });

  test('构造参数为 null 时默认不参与判别', () => {
    const tracker = createPointerGestureTracker({ tolerancePx: null });
    tracker.down({ x: 0, y: 0 });
    tracker.move({ x: 500, y: 500 });
    expect(tracker.up()).toBe('tap');
  });

  test('未按下时 move 返回 false、up 返回 tap', () => {
    const tracker = createPointerGestureTracker();
    expect(tracker.move({ x: 5, y: 5 })).toBe(false);
    expect(tracker.up()).toBe('tap');
    expect(tracker.delta()).toEqual({ x: 0, y: 0 });
  });

  test('reset 后可复用为新手势', () => {
    const tracker = createPointerGestureTracker();
    tracker.down({ x: 0, y: 0 });
    tracker.move({ x: 100, y: 100 });
    tracker.reset();
    tracker.down({ x: 0, y: 0 });
    expect(tracker.up({ x: 1, y: 1 })).toBe('tap');
  });
});

describe('resolveTapTolerance（默认行为等价性的落点）', () => {
  test('缺省 + panOnDrag=true → 4px（拖的是相机）', () => {
    expect(resolveTapTolerance({ panOnDrag: true })).toBe(DEFAULT_TAP_TOLERANCE_PX);
  });

  test('缺省 + panOnDrag=false → null（轻点选中的原行为，零改动保证）', () => {
    expect(resolveTapTolerance({ panOnDrag: false })).toBeNull();
  });

  test('显式数值优先于 panOnDrag', () => {
    expect(resolveTapTolerance({ panOnDrag: false, tapTolerancePx: 4 })).toBe(4);
    expect(resolveTapTolerance({ panOnDrag: true, tapTolerancePx: 12 })).toBe(12);
  });

  test('显式 null / 非有限值回落默认', () => {
    expect(resolveTapTolerance({ panOnDrag: true, tapTolerancePx: null })).toBe(DEFAULT_TAP_TOLERANCE_PX);
    expect(resolveTapTolerance({ panOnDrag: false, tapTolerancePx: Number.NaN })).toBeNull();
  });

  test('显式负数归零', () => {
    expect(resolveTapTolerance({ panOnDrag: false, tapTolerancePx: -3 })).toBe(0);
  });
});
