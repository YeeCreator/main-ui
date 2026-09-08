import type { TimelineFrame } from './types';

/** 索引钳制（纯函数，可单测）：空序列返回 0，其余钳制到 [0, count-1]，非有限值回退 0。 */
export const clampIndex = (index: number, count: number): number => {
  if (count <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(index)));
};

/** 定位索引归一（纯函数，可单测）：null（实时）透传，其余钳制到有效区间。 */
export const normalizeCurrentIndex = (index: number | null, count: number): number | null =>
  index === null ? null : clampIndex(index, count);

/** 时间轴覆盖的总 tick 数（纯函数，可单测）：取末帧 tick，空序列为 0。 */
export const computeTimelineTotalTicks = (frames: readonly TimelineFrame[]): number =>
  frames.length > 0 ? frames[frames.length - 1].tick : 0;

/** 回放进度（纯函数，可单测）：0..1；实时（null）视为进度 1（末端）。 */
export const computeTimelineProgress = (currentIndex: number | null, count: number): number => {
  if (count <= 0) return 0;
  if (currentIndex === null) return 1;
  if (count === 1) return 1;
  return clampIndex(currentIndex, count) / (count - 1);
};

/** 解析当前帧（纯函数，可单测）：实时（null）取末帧，否则取钳制后的索引帧。 */
export const resolveTimelineFrame = (
  frames: readonly TimelineFrame[],
  currentIndex: number | null,
): TimelineFrame | null => {
  if (frames.length === 0) return null;
  if (currentIndex === null) return frames[frames.length - 1] ?? null;
  return frames[clampIndex(currentIndex, frames.length)] ?? null;
};

/** 帧时间格式化（纯函数，可单测）：`<time>s`（保留两位小数），非法值返回空串。 */
export const formatTimelineTime = (time: number | undefined): string => {
  if (time === undefined || !Number.isFinite(time)) return '';
  return `${time.toFixed(2)}s`;
};
