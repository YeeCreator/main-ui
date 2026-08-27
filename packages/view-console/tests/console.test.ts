import { describe, expect, it } from 'vitest';
import { computeConsoleRowWindow, filterEntries, formatTimestamp, isAtBottom, normalizeLevel } from '../src/console';
import type { ConsoleEntry } from '../src/types';

const entry = (id: string, level: string, message: string): ConsoleEntry => ({ id, level, message });

describe('view-console 纯函数', () => {
  it('normalizeLevel 未知等级归一 info', () => {
    expect(normalizeLevel('error')).toBe('error');
    expect(normalizeLevel('success')).toBe('success');
    expect(normalizeLevel('trace')).toBe('info');
    expect(normalizeLevel('')).toBe('info');
  });

  it('filterEntries 等级白名单 + 文本匹配组合', () => {
    const entries = [
      entry('1', 'error', 'Failed to load'),
      entry('2', 'info', 'Loaded asset'),
      entry('3', 'warn', 'Slow load detected'),
      entry('4', 'unknown', 'Load complete'),
    ];
    expect(filterEntries(entries, [], '').map((item) => item.id)).toEqual(['1', '2', '3', '4']);
    expect(filterEntries(entries, ['error'], '').map((item) => item.id)).toEqual(['1']);
    expect(filterEntries(entries, ['warn', 'error'], '').map((item) => item.id)).toEqual(['1', '3']);
    // unknown 归一到 info 后参与 info 白名单
    expect(filterEntries(entries, ['info'], '').map((item) => item.id)).toEqual(['2', '4']);
    expect(filterEntries(entries, [], 'load').map((item) => item.id)).toEqual(['1', '2', '3', '4']);
    expect(filterEntries(entries, [], 'SLOW').map((item) => item.id)).toEqual(['3']);
    expect(filterEntries(entries, ['error'], 'asset').map((item) => item.id)).toEqual([]);
  });

  it('computeConsoleRowWindow 只渲染可见切片', () => {
    expect(computeConsoleRowWindow(0, 0, 20, 0)).toEqual({ start: 0, end: 0, totalHeight: 0 });
    const window = computeConsoleRowWindow(0, 100, 20, 1000);
    expect(window.start).toBe(0);
    expect(window.end).toBeLessThanOrEqual(5 + 12);
    expect(window.totalHeight).toBe(20000);
    const scrolled = computeConsoleRowWindow(500, 100, 20, 1000);
    expect(scrolled.start).toBe(Math.floor(500 / 20) - 6);
    expect(scrolled.end).toBeGreaterThan(scrolled.start);
  });

  it('isAtBottom 贴底判定（含阈值）', () => {
    expect(isAtBottom(900, 1000, 100)).toBe(true);
    expect(isAtBottom(897, 1000, 100)).toBe(true); // 3px 差值在阈值内
    expect(isAtBottom(500, 1000, 100)).toBe(false);
    expect(isAtBottom(0, 0, 0)).toBe(true);
  });

  it('formatTimestamp 输出固定格式并拒绝非法值', () => {
    expect(formatTimestamp(undefined)).toBe('');
    expect(formatTimestamp(Number.NaN)).toBe('');
    const result = formatTimestamp(new Date(2026, 0, 2, 8, 5, 9, 7).getTime());
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });
});
