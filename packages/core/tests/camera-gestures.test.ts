/**
 * core/input/camera-gestures —— 通用相机手势的判定纯函数。
 *
 * 守护目标：三条手势（中键 / 空格+左键 / Shift+滚轮）的**判定**归 core，
 * **绑定**归视图模板。此处只测判定，不涉及任何 DOM 事件时序。
 */
import { describe, expect, test } from 'vitest';
import {
  SHIFT_WHEEL_PAN_SPEED,
  createSpaceKeyState,
  isMiddleButton,
  isShiftWheel,
  isSpacePanGesture,
  isTypingTarget,
  shiftWheelPanDelta,
} from '../src/input/camera-gestures';

describe('isMiddleButton', () => {
  test('只有 button === 1 算中键', () => {
    expect(isMiddleButton({ button: 1 })).toBe(true);
    expect(isMiddleButton({ button: 0 })).toBe(false);
    expect(isMiddleButton({ button: 2 })).toBe(false);
  });
});

describe('isSpacePanGesture', () => {
  test('空格按住 + 左键 → 平移', () => {
    expect(isSpacePanGesture(true, { button: 0 })).toBe(true);
  });

  test('空格未按住时左键不构成该手势（归业务）', () => {
    expect(isSpacePanGesture(false, { button: 0 })).toBe(false);
  });

  test('空格按住时非左键不构成该手势', () => {
    expect(isSpacePanGesture(true, { button: 1 })).toBe(false);
    expect(isSpacePanGesture(true, { button: 2 })).toBe(false);
  });
});

describe('isShiftWheel', () => {
  test('Shift 按下才算横移', () => {
    expect(isShiftWheel({ shiftKey: true })).toBe(true);
    expect(isShiftWheel({ shiftKey: false })).toBe(false);
  });
});

describe('shiftWheelPanDelta', () => {
  test('只产出 x 分量', () => {
    expect(shiftWheelPanDelta(12)).toEqual({ x: 12, y: 0 });
  });

  test('speed 可调，且为纯乘法', () => {
    expect(shiftWheelPanDelta(12, 2)).toEqual({ x: 24, y: 0 });
    expect(shiftWheelPanDelta(-5)).toEqual({ x: -5 * SHIFT_WHEEL_PAN_SPEED, y: 0 });
  });

  test('不除以 scale（pan 是屏幕像素，除以 scale 会放大 1/scale 倍）', () => {
    // 此处没有 scale 入参，本身即证明口径：位移量原样传递。
    expect(shiftWheelPanDelta(100).x).toBe(100);
  });
});

describe('isTypingTarget', () => {
  test('输入类控件返回 true（空格应视为打字）', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'textarea' })).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
  });

  test('contenteditable 返回 true', () => {
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  test('普通元素与空值返回 false', () => {
    expect(isTypingTarget({ tagName: 'DIV' })).toBe(false);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: false })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(undefined)).toBe(false);
    expect(isTypingTarget('INPUT')).toBe(false); // 字符串不是元素
  });
});

describe('createSpaceKeyState', () => {
  test('hold / release / reset 切换 held', () => {
    const state = createSpaceKeyState();
    expect(state.held).toBe(false);
    state.hold();
    expect(state.held).toBe(true);
    state.release();
    expect(state.held).toBe(false);
    state.hold();
    state.reset();
    expect(state.held).toBe(false);
  });

  test('幂等：重复 hold / release 不改变结果', () => {
    const state = createSpaceKeyState();
    state.hold();
    state.hold();
    expect(state.held).toBe(true);
    state.release();
    state.release();
    expect(state.held).toBe(false);
  });
});
