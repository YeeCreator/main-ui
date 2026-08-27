import type { ConsoleEntry, ConsoleLevel } from './types';
import { CONSOLE_LEVELS } from './types';

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

/** 虚拟滚动窗口计算（纯函数，可单测）：只渲染可见切片 + 少量缓冲行。 */
export const computeConsoleRowWindow = (
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  totalCount: number,
  overscan = 6,
): { start: number; end: number; totalHeight: number } => {
  if (totalCount === 0 || rowHeight <= 0) {
    return { start: 0, end: 0, totalHeight: 0 };
  }
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visible = Math.ceil(Math.max(0, viewportHeight) / rowHeight);
  const end = Math.min(totalCount, start + visible + overscan * 2);
  return { start, end, totalHeight: totalCount * rowHeight };
};

/** 是否已贴近底部（纯函数，可单测）：用于判断用户上滑锁滚。 */
export const isAtBottom = (scrollTop: number, scrollHeight: number, clientHeight: number, threshold = 4): boolean =>
  scrollHeight - scrollTop - clientHeight <= threshold;

/** 时间列格式化（纯函数，可单测）：`HH:MM:SS.mmm`，非法值返回空串。 */
export const formatTimestamp = (timestamp: number | undefined): string => {
  if (timestamp === undefined || !Number.isFinite(timestamp)) return '';
  const date = new Date(timestamp);
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
};
