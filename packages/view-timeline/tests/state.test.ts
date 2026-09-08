import { describe, expect, it } from 'vitest';
import {
  clampIndex,
  computeTimelineProgress,
  computeTimelineTotalTicks,
  formatTimelineTime,
  normalizeCurrentIndex,
  resolveTimelineFrame,
} from '../src/state';
import type { TimelineFrame } from '../src/types';

const frame = (tick: number, time: number, label?: string): TimelineFrame => ({ tick, time, label });
const frames = [frame(0, 0), frame(1, 0.5), frame(2, 1.0), frame(5, 2.5)];

describe('view-timeline 纯函数', () => {
  it('clampIndex 钳制到有效区间，空序列/非法值回退 0', () => {
    expect(clampIndex(2, 4)).toBe(2);
    expect(clampIndex(-1, 4)).toBe(0);
    expect(clampIndex(99, 4)).toBe(3);
    expect(clampIndex(1.6, 4)).toBe(2);
    expect(clampIndex(1, 0)).toBe(0);
    expect(clampIndex(Number.NaN, 4)).toBe(0);
  });

  it('normalizeCurrentIndex null（实时）透传', () => {
    expect(normalizeCurrentIndex(null, 4)).toBeNull();
    expect(normalizeCurrentIndex(10, 4)).toBe(3);
  });

  it('computeTimelineTotalTicks 取末帧 tick', () => {
    expect(computeTimelineTotalTicks(frames)).toBe(5);
    expect(computeTimelineTotalTicks([])).toBe(0);
  });

  it('computeTimelineProgress 0..1，实时视为末端', () => {
    expect(computeTimelineProgress(null, 4)).toBe(1);
    expect(computeTimelineProgress(0, 4)).toBe(0);
    expect(computeTimelineProgress(3, 4)).toBe(1);
    expect(computeTimelineProgress(1, 4)).toBeCloseTo(1 / 3);
    expect(computeTimelineProgress(0, 0)).toBe(0);
    expect(computeTimelineProgress(null, 1)).toBe(1);
  });

  it('resolveTimelineFrame 实时取末帧，索引取钳制帧', () => {
    expect(resolveTimelineFrame(frames, null)).toEqual(frame(5, 2.5));
    expect(resolveTimelineFrame(frames, 1)).toEqual(frame(1, 0.5));
    expect(resolveTimelineFrame(frames, 99)).toEqual(frame(5, 2.5));
    expect(resolveTimelineFrame([], null)).toBeNull();
  });

  it('formatTimelineTime 保留两位小数，非法值空串', () => {
    expect(formatTimelineTime(2.5)).toBe('2.50s');
    expect(formatTimelineTime(0)).toBe('0.00s');
    expect(formatTimelineTime(undefined)).toBe('');
    expect(formatTimelineTime(Number.NaN)).toBe('');
  });
});
