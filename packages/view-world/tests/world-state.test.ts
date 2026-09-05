import { describe, expect, test } from 'vitest';
import {
  buildWorldViewState,
  parseCssColorToNumber,
  sanitizeCameraState,
  toCamera2D,
} from '../src/world-state';

describe('view-world world-state', () => {
  test('buildWorldViewState returns a fresh plain object (no Proxy)', () => {
    const state = buildWorldViewState({ scale: 2, pan: { x: 3, y: 4 } });
    expect(state).toEqual({ camera: { scale: 2, pan: { x: 3, y: 4 } } });
    // 可安全 structuredClone（F-3 缺陷回归防护）
    expect(() => structuredClone(state)).not.toThrow();
    expect(structuredClone(state)).toEqual(state);
  });

  test('buildWorldViewState falls back on invalid camera', () => {
    expect(buildWorldViewState(null).camera).toEqual({ scale: 1, pan: { x: 0, y: 0 } });
    expect(buildWorldViewState({ scale: NaN, pan: { x: 0, y: 0 } }).camera).toEqual({ scale: 1, pan: { x: 0, y: 0 } });
  });

  test('sanitizeCameraState validates input', () => {
    expect(sanitizeCameraState({ scale: 1.5, pan: { x: 1, y: 2 } })).toEqual({ scale: 1.5, pan: { x: 1, y: 2 } });
    expect(sanitizeCameraState(null)).toBeNull();
    expect(sanitizeCameraState({ scale: 0, pan: { x: 1, y: 2 } })).toBeNull();
    expect(sanitizeCameraState({ scale: 1, pan: { x: 'a', y: 2 } })).toBeNull();
  });

  test('toCamera2D maps state to camera', () => {
    expect(toCamera2D({ scale: 3, pan: { x: 1, y: 2 } })).toEqual({ scale: 3, pan: { x: 1, y: 2 } });
  });

  test('parseCssColorToNumber handles hex and rgb()', () => {
    expect(parseCssColorToNumber('#ffffff')).toBe(0xffffff);
    expect(parseCssColorToNumber('#fff')).toBe(0xffffff);
    expect(parseCssColorToNumber('#f5f2e9')).toBe(0xf5f2e9);
    expect(parseCssColorToNumber('rgb(245, 242, 233)')).toBe(0xf5f2e9);
    expect(parseCssColorToNumber('rgba(0, 0, 0, 0.5)')).toBe(0x000000);
    expect(parseCssColorToNumber('')).toBeNull();
    expect(parseCssColorToNumber('not-a-color')).toBeNull();
  });
});
