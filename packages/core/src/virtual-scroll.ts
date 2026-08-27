/**
 * @main-ui/core —— 虚拟滚动窗口计算公共纯函数。
 *
 * 统一 view-tree / view-table / view-console / view-asset 等模板的虚拟滚动窗口计算逻辑。
 * 各模板仅需调用 `computeVirtualWindow` 即可获得可见区间的起止索引、偏移量与总高度，
 * 保留各自特有逻辑（树的扁平化、表格的排序、控制台的锁滚判定）。
 *
 * 约束：纯函数、零 DOM 依赖、零网络语义。
 */

/** 虚拟滚动窗口计算结果。 */
export type VirtualWindow = {
  /** 可见区间起始索引（含 overscan 前缓冲）。 */
  start: number;
  /** 可见区间结束索引（不含，含 overscan 后缓冲）。 */
  end: number;
  /** 起始行相对容器顶部的像素偏移（用于定位渲染区域）。 */
  offsetY: number;
  /** 全部内容总高度（像素）。 */
  totalHeight: number;
};

/**
 * 虚拟滚动窗口计算（纯函数，可单测）。
 *
 * 给定滚动位置、视口高度、行高与总行数，返回可见切片索引范围、
 * 像素偏移量与总高度。可选 `overscan` 控制前后缓冲行数（默认 4）。
 *
 * 各模板消费方式：
 * - view-tree：`computeVirtualWindow(scrollTop, viewportHeight, rowHeight, flatRows.length, 4)`
 * - view-table：`computeVirtualWindow(scrollTop, viewportHeight, rowHeight, sortedRows.length, 4)`
 * - view-console：`computeVirtualWindow(scrollTop, viewportHeight, rowHeight, filtered.length, 6)`
 * - view-asset：`computeVirtualWindow(scrollTop, viewportHeight, rowHeight, rowCount, 4)`
 */
export const computeVirtualWindow = (
  scrollTop: number,
  viewportHeight: number,
  itemHeight: number,
  totalCount: number,
  overscan = 4,
): VirtualWindow => {
  if (totalCount === 0 || itemHeight <= 0) {
    return { start: 0, end: 0, offsetY: 0, totalHeight: 0 };
  }
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visible = Math.ceil(Math.max(0, viewportHeight) / itemHeight);
  const end = Math.min(totalCount, start + visible + overscan * 2);
  return { start, end, offsetY: start * itemHeight, totalHeight: totalCount * itemHeight };
};

/**
 * 是否已贴近底部（纯函数，可单测）。
 *
 * 用于控制台等场景判断用户是否处于底部附近（锁滚/自动跟随）。
 * `threshold` 为容忍像素距离（默认 4px）。
 */
export const isNearBottom = (
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  threshold = 4,
): boolean => scrollHeight - scrollTop - clientHeight <= threshold;
