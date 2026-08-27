import { describe, expect, it } from 'vitest';
import { isValidCameraState, parseCssColorToNumber, sanitizeCameraState } from '../src/view2d';

describe('isValidCameraState', () => {
  it('接受合法相机', () => {
    expect(isValidCameraState({ scale: 1.5, pan: { x: 10, y: -3 } })).toBe(true);
  });

  it('拒绝非法形态', () => {
    expect(isValidCameraState(null)).toBe(false);
    expect(isValidCameraState('camera')).toBe(false);
    expect(isValidCameraState({ scale: 0, pan: { x: 0, y: 0 } })).toBe(false);
    expect(isValidCameraState({ scale: NaN, pan: { x: 0, y: 0 } })).toBe(false);
    expect(isValidCameraState({ scale: 1, pan: { x: Infinity, y: 0 } })).toBe(false);
    expect(isValidCameraState({ scale: 1 })).toBe(false);
  });
});

describe('sanitizeCameraState', () => {
  it('合法时原样规范化（拷贝）', () => {
    const input = { scale: 2, pan: { x: 5, y: 6 } };
    const result = sanitizeCameraState(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it('非法时回退', () => {
    const fallback = { scale: 1, pan: { x: 0, y: 0 } };
    expect(sanitizeCameraState({ scale: -1 }, fallback)).toBe(fallback);
    expect(sanitizeCameraState(undefined)).toBeNull();
  });
});

describe('parseCssColorToNumber', () => {
  it('解析 #rrggbb 与 #rgb', () => {
    expect(parseCssColorToNumber('#f8fafc')).toBe(0xf8fafc);
    expect(parseCssColorToNumber('#fff')).toBe(0xffffff);
    expect(parseCssColorToNumber('#0a0')).toBe(0x00aa00);
  });

  it('解析 rgb() 形式', () => {
    expect(parseCssColorToNumber('rgb(255, 0, 0)')).toBe(0xff0000);
    expect(parseCssColorToNumber('rgba(10, 20, 30, 0.5)')).toBe(0x0a141e);
  });

  it('非法返回 null', () => {
    expect(parseCssColorToNumber('')).toBeNull();
    expect(parseCssColorToNumber('#12345')).toBeNull();
    expect(parseCssColorToNumber('var(--x)')).toBeNull();
    expect(parseCssColorToNumber('hsl(0, 0%, 0%)')).toBeNull();
  });
});
