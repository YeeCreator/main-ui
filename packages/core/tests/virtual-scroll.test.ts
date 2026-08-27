import { describe, expect, test } from 'vitest';
import { computeVirtualWindow, isNearBottom, type VirtualWindow } from '../src/virtual-scroll';

describe('computeVirtualWindow', () => {
  test('empty list returns all zeros', () => {
    const result = computeVirtualWindow(0, 600, 32, 0);
    expect(result).toEqual({ start: 0, end: 0, offsetY: 0, totalHeight: 0 });
  });

  test('zero or negative itemHeight returns all zeros', () => {
    expect(computeVirtualWindow(0, 600, 0, 100)).toEqual({ start: 0, end: 0, offsetY: 0, totalHeight: 0 });
    expect(computeVirtualWindow(0, 600, -10, 100)).toEqual({ start: 0, end: 0, offsetY: 0, totalHeight: 0 });
  });

  test('basic window with default overscan (4)', () => {
    const result = computeVirtualWindow(0, 320, 32, 1000);
    // start = max(0, floor(0/32) - 4) = 0
    expect(result.start).toBe(0);
    // visible = ceil(320/32) = 10; end = min(1000, 0 + 10 + 8) = 18
    expect(result.end).toBe(18);
    expect(result.offsetY).toBe(0);
    expect(result.totalHeight).toBe(32000);
  });

  test('scrolled position with overscan', () => {
    const result = computeVirtualWindow(1600, 320, 32, 1000);
    // start = max(0, floor(1600/32) - 4) = max(0, 50 - 4) = 46
    expect(result.start).toBe(46);
    // visible = ceil(320/32) = 10; end = min(1000, 46 + 10 + 8) = 64
    expect(result.end).toBe(64);
    expect(result.offsetY).toBe(46 * 32);
  });

  test('near end clamps to totalCount', () => {
    const result = computeVirtualWindow(31900, 600, 32, 1000);
    // start = max(0, floor(31900/32) - 4) = max(0, 996 - 4) = 992
    expect(result.start).toBe(992);
    // visible = ceil(600/32) = 19; end = min(1000, 992 + 19 + 8) = 1000
    expect(result.end).toBe(1000);
    expect(result.offsetY).toBe(992 * 32);
    expect(result.totalHeight).toBe(32000);
  });

  test('custom overscan', () => {
    const result = computeVirtualWindow(320, 320, 32, 1000, 6);
    // start = max(0, floor(320/32) - 6) = max(0, 10 - 6) = 4
    expect(result.start).toBe(4);
    // visible = ceil(320/32) = 10; end = min(1000, 4 + 10 + 12) = 26
    expect(result.end).toBe(26);
  });

  test('negative scrollTop treated as 0 via floor', () => {
    const result = computeVirtualWindow(-100, 320, 32, 1000);
    // start = max(0, floor(-100/32) - 4) = max(0, -4 - 4) = 0
    expect(result.start).toBe(0);
  });

  test('small totalCount returns full range', () => {
    const result = computeVirtualWindow(0, 600, 32, 5);
    expect(result.start).toBe(0);
    expect(result.end).toBe(5);
    expect(result.totalHeight).toBe(160);
  });
});

describe('isNearBottom', () => {
  test('at exact bottom', () => {
    expect(isNearBottom(900, 1000, 100)).toBe(true);
  });

  test('within threshold', () => {
    expect(isNearBottom(898, 1000, 100, 4)).toBe(true);
  });

  test('beyond threshold', () => {
    expect(isNearBottom(500, 1000, 100, 4)).toBe(false);
  });

  test('custom threshold', () => {
    expect(isNearBottom(880, 1000, 100, 20)).toBe(true);
    expect(isNearBottom(870, 1000, 100, 20)).toBe(false);
  });
});
