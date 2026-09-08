import { describe, expect, it } from 'vitest';
import {
  clampRate,
  computeRunControlAvailability,
  normalizeRunControlStatus,
  parseRate,
} from '../src/state';

describe('view-run-control 纯函数', () => {
  it('normalizeRunControlStatus 未知状态归一 idle', () => {
    expect(normalizeRunControlStatus('running')).toBe('running');
    expect(normalizeRunControlStatus('paused')).toBe('paused');
    expect(normalizeRunControlStatus('idle')).toBe('idle');
    expect(normalizeRunControlStatus('unknown')).toBe('idle');
    expect(normalizeRunControlStatus('')).toBe('idle');
  });

  it('clampRate 钳制到边界，非有限值回退 min', () => {
    expect(clampRate(5, 0.1, 1000)).toBe(5);
    expect(clampRate(-3, 0.1, 1000)).toBe(0.1);
    expect(clampRate(9999, 0.1, 1000)).toBe(1000);
    expect(clampRate(Number.NaN, 0.1, 1000)).toBe(0.1);
    expect(clampRate(Number.POSITIVE_INFINITY, 0.1, 1000)).toBe(0.1);
  });

  it('parseRate 非法输入回退 fallback 再钳制', () => {
    expect(parseRate('20', 1, 0.1, 1000)).toBe(20);
    expect(parseRate('abc', 7, 0.1, 1000)).toBe(7);
    expect(parseRate('', 7, 0.1, 1000)).toBe(7);
    expect(parseRate('5000', 1, 0.1, 1000)).toBe(1000);
    expect(parseRate('-1', 1, 0.1, 1000)).toBe(0.1);
  });

  it('computeRunControlAvailability 按连接态与能力计算默认可用性', () => {
    expect(computeRunControlAvailability()).toEqual({
      play: true, pause: true, step: true, reset: true, rateEditable: true,
    });
    expect(computeRunControlAvailability({ connected: false })).toEqual({
      play: false, pause: false, step: false, reset: false, rateEditable: false,
    });
    expect(computeRunControlAvailability({ connected: true, canReset: false })).toEqual({
      play: true, pause: true, step: true, reset: false, rateEditable: true,
    });
    expect(computeRunControlAvailability({ rateEditable: false }).rateEditable).toBe(false);
  });
});
