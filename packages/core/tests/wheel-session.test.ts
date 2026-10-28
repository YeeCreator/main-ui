/**
 * core/input/wheel-session —— 滚轮判型的**唯一真相源**。
 *
 * 本文件的守护目标：**设备与意图是两个正交维度**，不得压成一维枚举。
 * 历史上 `Ctrl/⌘ + 鼠标滚轮` 与「触控板捏合」共用 `PINCH_ZOOM_SPEED`，
 * 导致鼠标每次事件倍率 `exp(100 × 0.01) ≈ 2.718`，连拨两次即撞 `maxScale`。
 */
import { describe, expect, test } from 'vitest';
import {
  PINCH_ZOOM_SPEED,
  WHEEL_ZOOM_SPEED,
  classifyWheel,
  detectWheelDevice,
  readWheel,
  zoomFactorOf,
  type WheelLike,
} from '../src/input/wheel-session';

const base: WheelLike = { ctrlKey: false, metaKey: false, deltaX: 0, deltaY: 0, deltaMode: 0 };
const at = (patch: Partial<WheelLike>): WheelLike => ({ ...base, ...patch });

describe('readWheel · 设备维度', () => {
  test('float delta → trackpad（触控板上报浮点）', () => {
    expect(detectWheelDevice(at({ deltaY: 7.5 }))).toBe('trackpad');
  });

  test('integer large delta → mouse（鼠标上报整数刻度）', () => {
    expect(detectWheelDevice(at({ deltaY: -100 }))).toBe('mouse');
  });

  test('horizontal component → trackpad（鼠标滚轮无横向分量）', () => {
    expect(detectWheelDevice(at({ deltaX: 12, deltaY: -3 }))).toBe('trackpad');
  });

  test('non-pixel deltaMode → mouse（触控板恒为像素模式）', () => {
    expect(detectWheelDevice(at({ deltaY: 3, deltaMode: 1 }))).toBe('mouse');
  });

  test('dense event stream → trackpad（快扫不被误判为鼠标）', () => {
    // 大整数 delta 但间隔仅 8ms：鼠标人手极限约 10 格/秒，不可能这么密
    expect(detectWheelDevice(at({ deltaY: -55, intervalMs: 8 }))).toBe('trackpad');
    // 同样的 delta，间隔 120ms → 真鼠标滚轮
    expect(detectWheelDevice(at({ deltaY: -55, intervalMs: 120 }))).toBe('mouse');
  });

  test('small integer delta → trackpad（小幅滚动按触控板处理）', () => {
    expect(detectWheelDevice(at({ deltaY: 20 }))).toBe('trackpad');
  });
});

describe('readWheel · 意图与修饰键', () => {
  test('Ctrl + 鼠标滚轮 → mouse + zoom（不是 pinch）', () => {
    expect(readWheel(at({ ctrlKey: true, deltaY: -100 }))).toEqual({
      device: 'mouse', intent: 'zoom', modifier: 'ctrl',
    });
  });

  test('Meta + 鼠标滚轮 → mouse + zoom（macOS ⌘）', () => {
    expect(readWheel(at({ metaKey: true, deltaY: -100 }))).toEqual({
      device: 'mouse', intent: 'zoom', modifier: 'meta',
    });
  });

  test('触控板捏合（小 delta + ctrlKey）→ trackpad + zoom', () => {
    expect(readWheel(at({ ctrlKey: true, deltaY: 4 }))).toEqual({
      device: 'trackpad', intent: 'zoom', modifier: 'ctrl',
    });
  });

  test('触控板双指平移 → trackpad + pan', () => {
    expect(readWheel(at({ deltaX: 12, deltaY: -3 }))).toEqual({
      device: 'trackpad', intent: 'pan', modifier: 'none',
    });
  });

  test('鼠标滚轮无修饰键 → mouse + zoom', () => {
    expect(readWheel(at({ deltaY: -100 }))).toEqual({
      device: 'mouse', intent: 'zoom', modifier: 'none',
    });
  });

  test('Shift 只记录进 modifier，不改变 intent', () => {
    expect(readWheel(at({ shiftKey: true, deltaY: -100 }))).toEqual({
      device: 'mouse', intent: 'zoom', modifier: 'shift',
    });
  });

  test('Ctrl 优先于 Shift（同时按下时记录 ctrl）', () => {
    expect(readWheel(at({ ctrlKey: true, shiftKey: true, deltaY: -100 })).modifier).toBe('ctrl');
  });
});

describe('zoomFactorOf · 灵敏度按设备分档', () => {
  test('鼠标档不爆倍率（回归护栏）', () => {
    // Ctrl + 鼠标滚轮：deltaY=-100 → 倍率约为 1.17，绝不是 2.718
    const factor = zoomFactorOf(readWheel(at({ ctrlKey: true, deltaY: -100 })), -100);
    expect(factor).toBeCloseTo(Math.exp(100 * WHEEL_ZOOM_SPEED), 6);
    expect(factor).toBeLessThan(1.3);
  });

  test('触控板档对微小 delta 仍有可感反应', () => {
    const factor = zoomFactorOf(readWheel(at({ ctrlKey: true, deltaY: 4 })), 4);
    expect(factor).toBeCloseTo(Math.exp(-4 * PINCH_ZOOM_SPEED), 6);
    expect(factor).toBeLessThan(1); // 4 指捏合向下 → 缩小
    expect(factor).toBeGreaterThan(0.9); // 但只是轻微缩小，不是跳变
  });

  test('两档系数确实不同（防止被合并成一个）', () => {
    expect(WHEEL_ZOOM_SPEED).not.toBe(PINCH_ZOOM_SPEED);
  });
});

describe('classifyWheel · 一维投影（兼容面）', () => {
  test('Ctrl + 鼠标 → zoom，触控板捏合 → pinch', () => {
    expect(classifyWheel(at({ ctrlKey: true, deltaY: -100 }))).toBe('zoom');
    expect(classifyWheel(at({ ctrlKey: true, deltaY: 4 }))).toBe('pinch');
  });

  test('无修饰键：触控板 → pan，鼠标 → zoom', () => {
    expect(classifyWheel(at({ deltaX: 12, deltaY: -3 }))).toBe('pan');
    expect(classifyWheel(at({ deltaY: -100 }))).toBe('zoom');
  });

  test('行模式滚轮（老式鼠标）→ zoom', () => {
    expect(classifyWheel(at({ deltaY: 3, deltaMode: 1 }))).toBe('zoom');
  });
});
