import { describe, expect, it } from 'vitest';
import { DEFAULT_CONSOLE_ROW_HEIGHT, DEFAULT_CONSOLE_WRAP_ROW_HEIGHT } from '../src/types';
import { computeConsoleRowWindow } from '../src/console';

/**
 * 覆盖 D-4 / 换行开关带来的行为差异。
 *
 * 换行模式**不改虚拟滚动算法**，只把单行高度换成预定义的多行高度 ——
 * 这些用例把这个决定钉死：若将来有人把它改成「真实变高」，
 * 就会在这里失败，从而必须显式讨论（变高会让滚动退化为先测量再定位）。
 */
describe('行高常量', () => {
  it('换行行高显著大于单行行高', () => {
    expect(DEFAULT_CONSOLE_WRAP_ROW_HEIGHT).toBeGreaterThan(DEFAULT_CONSOLE_ROW_HEIGHT);
    expect(DEFAULT_CONSOLE_WRAP_ROW_HEIGHT).toBe(DEFAULT_CONSOLE_ROW_HEIGHT * 3);
  });
});

describe('换行模式对可见行数的影响', () => {
  const totalRows = 100;
  const scrollTop = 0;
  const viewportHeight = 400;

  it('单行模式可见行数更多', () => {
    const normal = computeConsoleRowWindow(scrollTop, viewportHeight, DEFAULT_CONSOLE_ROW_HEIGHT, totalRows);
    const wrapped = computeConsoleRowWindow(scrollTop, viewportHeight, DEFAULT_CONSOLE_WRAP_ROW_HEIGHT, totalRows);
    const normalCount = normal.end - normal.start;
    const wrappedCount = wrapped.end - wrapped.start;
    expect(normalCount).toBeGreaterThan(wrappedCount);
  });

  it('换行模式下总高度按行高放大', () => {
    const normal = computeConsoleRowWindow(scrollTop, viewportHeight, DEFAULT_CONSOLE_ROW_HEIGHT, totalRows);
    const wrapped = computeConsoleRowWindow(scrollTop, viewportHeight, DEFAULT_CONSOLE_WRAP_ROW_HEIGHT, totalRows);
    expect(wrapped.totalHeight).toBe(normal.totalHeight * 3);
  });

  it('空列表两种模式都不越界', () => {
    for (const height of [DEFAULT_CONSOLE_ROW_HEIGHT, DEFAULT_CONSOLE_WRAP_ROW_HEIGHT]) {
      const window = computeConsoleRowWindow(0, viewportHeight, height, 0);
      expect(window.start).toBe(0);
      expect(window.end).toBe(0);
    }
  });
});
