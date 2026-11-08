/**
 * 飞行模式键位映射。
 *
 * 键位是**约定**，不是实现细节 —— 所以用纯函数承载并单独测试。
 * 这里守住的关键行为：相反方向同时按住时**互相抵消**，而不是后来者胜出。
 */

import { describe, expect, test } from 'vitest';
import {
  flyInputFromKeys,
  isFlyModifierKey,
  isFlyMovementKey,
} from '../src/input/fly-keys';

const keys = (...list: string[]) => new Set(list);

describe('飞行键位：方向映射', () => {
  test('W = 前进，S = 后退', () => {
    expect(flyInputFromKeys(keys('w')).forward).toBe(1);
    expect(flyInputFromKeys(keys('s')).forward).toBe(-1);
  });

  test('D = 右移，A = 左移', () => {
    expect(flyInputFromKeys(keys('d')).strafe).toBe(1);
    expect(flyInputFromKeys(keys('a')).strafe).toBe(-1);
  });

  test('Q = 上升，E = 下降', () => {
    expect(flyInputFromKeys(keys('q')).elevate).toBe(1);
    expect(flyInputFromKeys(keys('e')).elevate).toBe(-1);
  });

  test('大小写不敏感', () => {
    expect(flyInputFromKeys(keys('W')).forward).toBe(1);
    expect(flyInputFromKeys(keys('D')).strafe).toBe(1);
  });

  test('无按键时全为 0', () => {
    const r = flyInputFromKeys(keys());
    expect(r.forward).toBe(0);
    expect(r.strafe).toBe(0);
    expect(r.elevate).toBe(0);
    expect(r.speedScale).toBe(1);
  });
});

describe('飞行键位：相反方向互相抵消', () => {
  /**
   * 为什么不用「后按的胜出」：快速换向（松 W 前先按 S）时，
   * 后者胜出会产生一次意外猛冲。抵消为 0 更稳。
   */
  test('W + S = 0', () => {
    expect(flyInputFromKeys(keys('w', 's')).forward).toBe(0);
  });

  test('A + D = 0', () => {
    expect(flyInputFromKeys(keys('a', 'd')).strafe).toBe(0);
  });

  test('Q + E = 0', () => {
    expect(flyInputFromKeys(keys('q', 'e')).elevate).toBe(0);
  });

  test('对角移动时两个轴同时生效', () => {
    const r = flyInputFromKeys(keys('w', 'd'));
    expect(r.forward).toBe(1);
    expect(r.strafe).toBe(1);
  });
});

describe('飞行键位：速度倍率', () => {
  test('Shift 加速 ×4', () => {
    expect(flyInputFromKeys(keys('w', 'Shift')).speedScale).toBe(4);
  });

  test('Alt 减速 ×0.25', () => {
    expect(flyInputFromKeys(keys('w', 'Alt')).speedScale).toBe(0.25);
  });

  test('Shift 优先于 Alt（同时按住取加速）', () => {
    expect(flyInputFromKeys(keys('w', 'Shift', 'Alt')).speedScale).toBe(4);
  });

  test('无修饰键时倍率为 1', () => {
    expect(flyInputFromKeys(keys('w')).speedScale).toBe(1);
  });
});

describe('飞行键位：按键分类', () => {
  test('方向键识别', () => {
    for (const k of ['w', 'a', 's', 'd', 'q', 'e', 'W', 'Q']) {
      expect(isFlyMovementKey(k)).toBe(true);
    }
    for (const k of ['f', 'Home', 'x', '1']) {
      expect(isFlyMovementKey(k)).toBe(false);
    }
  });

  test('修饰键识别', () => {
    expect(isFlyModifierKey('Shift')).toBe(true);
    expect(isFlyModifierKey('Alt')).toBe(true);
    expect(isFlyModifierKey('w')).toBe(false);
    expect(isFlyModifierKey('Control')).toBe(false);
  });
});
