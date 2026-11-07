import { describe, expect, test } from 'vitest';
import {
  altMouseGesture,
  rotateDeltaFromDrag,
  zoomFactorFromDrag,
  pinchRotateDelta,
} from '../src/input/alt-view-gestures';

describe('altMouseGesture（Alt + 三键 → 相机操作）', () => {
  test('Alt + 左键 = 旋转', () => {
    expect(altMouseGesture({ button: 0, altKey: true })).toBe('rotate');
  });

  test('Alt + 中键 = 平移', () => {
    expect(altMouseGesture({ button: 1, altKey: true })).toBe('pan');
  });

  test('Alt + 右键 = 缩放', () => {
    expect(altMouseGesture({ button: 2, altKey: true })).toBe('zoom');
  });

  test('未按 Alt 时一律 none（不劫持三键默认语义）', () => {
    for (const button of [0, 1, 2]) {
      expect(altMouseGesture({ button, altKey: false })).toBe('none');
    }
  });

  test('未知按键返回 none', () => {
    expect(altMouseGesture({ button: 4, altKey: true })).toBe('none');
  });
});

describe('rotateDeltaFromDrag（水平拖拽 → 旋转角）', () => {
  /**
   * ## 为什么是「向右拖返回负值」
   *
   * 这里返回的是**相机**绕行角，不是物体的转动角。使用者 2026-11-08 要求
   * 「光标左移则左转」，描述的是**画面内容**的方向。
   *
   * 转相机与转物体互为反操作：要让物体朝左转，相机就得朝右绕。
   * 故「向右拖」⇒ 相机负向 ⇒ 物体向右转（跟手）。
   *
   * 这与 Blender 的轨道旋转手感一致（往左拖，模型朝左翻过去）。
   */
  test('向右拖 → 相机负向（物体向右转，跟手）', () => {
    expect(rotateDeltaFromDrag(100)).toBeLessThan(0);
  });

  test('向左拖 → 相机正向（物体向左转，跟手）', () => {
    expect(rotateDeltaFromDrag(-100)).toBeGreaterThan(0);
  });

  test('等距左右拖拽角度互为相反数', () => {
    expect(rotateDeltaFromDrag(80)).toBeCloseTo(-rotateDeltaFromDrag(-80), 10);
  });

  test('零位移不转（注意 -0 也算不转）', () => {
    expect(rotateDeltaFromDrag(0)).toBe(0);
  });

  test('非有限数不产生 NaN', () => {
    expect(rotateDeltaFromDrag(Number.NaN)).toBe(0);
    expect(rotateDeltaFromDrag(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('zoomFactorFromDrag（垂直拖拽 → 缩放倍率）', () => {
  test('向上拖（deltaY<0）放大，倍率 > 1', () => {
    expect(zoomFactorFromDrag(-100)).toBeGreaterThan(1);
  });

  test('向下拖（deltaY>0）缩小，倍率 < 1', () => {
    expect(zoomFactorFromDrag(100)).toBeLessThan(1);
  });

  test('零位移倍率为 1', () => {
    expect(zoomFactorFromDrag(0)).toBe(1);
  });

  test('等距上下拖拽倍率互为倒数（指数映射的可逆性）', () => {
    const up = zoomFactorFromDrag(-80);
    const down = zoomFactorFromDrag(80);
    expect(up * down).toBeCloseTo(1, 10);
  });

  test('倍率恒为正（不会因大位移变负）', () => {
    expect(zoomFactorFromDrag(100000)).toBeGreaterThan(0);
  });

  test('非有限数退回 1', () => {
    expect(zoomFactorFromDrag(Number.NaN)).toBe(1);
  });
});

describe('pinchRotateDelta（双指角度 → 旋转增量）', () => {
  test('普通角度差直接返回', () => {
    expect(pinchRotateDelta(0, 0.5)).toBeCloseTo(0.5, 10);
  });

  test('跨界（π → -π）归一为小角度而非 2π 大跳', () => {
    const delta = pinchRotateDelta(Math.PI * 0.49, Math.PI * -0.49);
    expect(Math.abs(delta)).toBeLessThan(Math.PI);
  });

  test('反向跨界同样归一', () => {
    const delta = pinchRotateDelta(Math.PI * -0.49, Math.PI * 0.49);
    expect(Math.abs(delta)).toBeLessThan(Math.PI);
  });

  test('归一后方向仍正确（跨界不是总给正或总给负）', () => {
    const forward = pinchRotateDelta(Math.PI * 0.49, Math.PI * -0.49);
    const backward = pinchRotateDelta(Math.PI * -0.49, Math.PI * 0.49);
    expect(Math.sign(forward)).toBe(-Math.sign(backward));
  });
});
