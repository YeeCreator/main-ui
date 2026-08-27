import type { ConsoleEntry, ConsoleLevel } from './types';
import { CONSOLE_LEVELS } from './types';
import { computeVirtualWindow, isNearBottom } from '@main-ui/core';

/** 等级归一（纯函数，可单测）：未知等级一律按 info 呈现。 */
export const normalizeLevel = (level: string): ConsoleLevel =>
  (CONSOLE_LEVELS as readonly string[]).includes(level) ? (level as ConsoleLevel) : 'info';

/**
 * 过滤条目（纯函数，可单测）：等级白名单（空 = 全部）+ 文本匹配（不区分大小写）。
 */
export const filterEntries = (
  entries: readonly ConsoleEntry[],
  levels: readonly ConsoleLevel[],
  query: string,
): ConsoleEntry[] => {
  const normalizedQuery = query.trim().toLowerCase();
  const levelSet = levels.length > 0 ? new Set<string>(levels) : null;
  return entries.filter((entry) => {
    if (levelSet && !levelSet.has(normalizeLevel(entry.level))) return false;
    if (normalizedQuery && !entry.message.toLowerCase().includes(normalizedQuery)) return false;
    return true;
  });
};

/** 虚拟滚动窗口计算（纯函数，可单测）：委托 @main-ui/core 公共基座（console 默认 overscan=6）。 */
export const computeConsoleRowWindow = (
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  totalCount: number,
  overscan = 6,
): { start: number; end: number; totalHeight: number } => {
  const result = computeVirtualWindow(scrollTop, viewportHeight, rowHeight, totalCount, overscan);
  return { start: result.start, end: result.end, totalHeight: result.totalHeight };
};

/** 是否已贴近底部（纯函数，可单测）：委托 @main-ui/core isNearBottom。 */
export const isAtBottom = (
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  threshold = 4,
): boolean => isNearBottom(scrollTop, scrollHeight, clientHeight, threshold);

/** 时间列格式化（纯函数，可单测）：`HH:MM:SS.mmm`，非法值返回空串。 */
export const formatTimestamp = (timestamp: number | undefined): string => {
  if (timestamp === undefined || !Number.isFinite(timestamp)) return '';
  const date = new Date(timestamp);
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
};
