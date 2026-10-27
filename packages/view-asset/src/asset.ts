import {
  ASSET_GRID_BREAKPOINTS,
  type AssetItem,
  type AssetLayout,
} from './types';

/**
 * 纯函数逻辑层（零 DOM、零 Vue，可 Node 单测）。
 *
 * 这里只放「网格怎么排、过滤怎么命中、选中怎么变」这类可以完全脱离渲染验证的规则。
 * 任何需要 DOM 测量的东西都不进来 —— 一旦进来就无法单测，而这一层存在的意义正是可测。
 */

/**
 * 按容器宽度解析网格列数。
 *
 * 为什么不交给 CSS `grid-template-columns: repeat(auto-fill, ...)`：
 * 虚拟滚动必须**知道**每行几个，否则无法把「第 N 项在第几行」算成像素偏移。
 * 自动填充是浏览器内部决定，JS 拿不到。故断点表写在契约里，与 CSS 手动对齐。
 *
 * @param containerWidth 容器宽度（CSS 像素）。
 * @returns 列数（至少 1）。
 * @example
 * ```ts
 * resolveGridColumns(1000); // 5
 * resolveGridColumns(100);  // 2
 * ```
 */
export const resolveGridColumns = (containerWidth: number): number => {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 1;
  for (const breakpoint of ASSET_GRID_BREAKPOINTS) {
    if (containerWidth >= breakpoint.minWidth) return breakpoint.columns;
  }
  return ASSET_GRID_BREAKPOINTS[ASSET_GRID_BREAKPOINTS.length - 1]?.columns ?? 1;
};

/**
 * 计算虚拟窗口（纯函数）。
 *
 * 与 tree / table / console 的窗口计算同一口径，但这里按「行」而非「项」：
 * 网格一行放 N 项，故总行数 = ceil(count / columns)。
 *
 * @param scrollTop 滚动偏移（px）。
 * @param viewportHeight 视口高度（px）。
 * @param rowHeight 行高（px）。
 * @param totalRows 总行数。
 * @param overscan 上下各多渲染的行数（默认 2）。
 * @returns 行窗口与总高度。
 */
export const computeAssetRowWindow = (
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  totalRows: number,
  overscan = 2,
): { start: number; end: number; totalHeight: number } => {
  const safeRowHeight = rowHeight > 0 ? rowHeight : 1;
  if (totalRows <= 0) return { start: 0, end: 0, totalHeight: 0 };
  const firstVisible = Math.floor(Math.max(0, scrollTop) / safeRowHeight);
  const visibleCount = Math.ceil(Math.max(0, viewportHeight) / safeRowHeight);
  // 先用 overscan 向上扩，再把 start 钳制到「末屏首行」——否则滚到底后
  // start 会越过 totalRows（渲染时生成已不存在的索引，表现为白白多算一轮）。
  const rawStart = Math.max(0, firstVisible - overscan);
  const maxStart = Math.max(0, totalRows - visibleCount - overscan);
  const start = Math.min(rawStart, maxStart);
  const end = Math.min(totalRows, Math.max(start, firstVisible + visibleCount + overscan));
  return { start, end, totalHeight: totalRows * safeRowHeight };
};

/**
 * 文本过滤（标题 + 描述 + 徽标，不区分大小写）。
 *
 * @param items 全部条目。
 * @param query 关键词（空白视为不过滤）。
 * @returns 命中条目（保持原顺序）。
 */
export const filterAssets = (items: readonly AssetItem[], query: string): AssetItem[] => {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return [...items];
  return items.filter((item) => {
    if (item.title.toLowerCase().includes(keyword)) return true;
    if (item.description?.toLowerCase().includes(keyword)) return true;
    return (item.badges ?? []).some((badge) => badge.toLowerCase().includes(keyword));
  });
};

/**
 * 计算点击后的选中集（纯函数）。
 *
 * 语义刻意保持最小：
 * - 普通点击 → 只选中该项；
 * - 修饰键点击 → 切换该项在集内的存在，**不清空其它项**；
 * - 再次普通点击已唯一选中项 → 保持选中（不做「取消选中」）。
 *
 * 为什么不做 Shift 连选：连选范围依赖「当前过滤后的可见顺序」，而那是渲染层的派生
 * 结果。把它硬编进纯函数会让「宿主想按自己的排序连选」无法实现。需要连选的宿主
 * 基于 `select` 事件自行维护。
 *
 * @param current 当前选中集。
 * @param id 被点击的条目 id。
 * @param additive 是否按住修饰键。
 * @returns 新选中集（不改入参）。
 * @example
 * ```ts
 * nextSelection(['a'], 'b', false); // ['b']
 * nextSelection(['a'], 'b', true);  // ['a', 'b']
 * nextSelection(['a', 'b'], 'b', true); // ['a']
 * ```
 */
export const nextSelection = (
  current: readonly string[],
  id: string,
  additive: boolean,
): string[] => {
  if (!additive) return [id];
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
};

/**
 * 布局切换后的选中集裁剪：把已不存在的 id 剔除。
 *
 * 为什么需要：宿主可能在同一实例里换数据源（换了项目、换了筛选），
 * 旧选中项必然失效。留着会让「批量删除」按钮指向不存在的资产。
 *
 * @param selectedIds 当前选中集。
 * @param items 新数据源。
 * @returns 仍存在的选中 id。
 */
export const pruneSelection = (selectedIds: readonly string[], items: readonly AssetItem[]): string[] => {
  const alive = new Set(items.map((item) => item.id));
  return selectedIds.filter((id) => alive.has(id));
};

/** 布局模式校验（未知值回退 grid，避免宿主传入脏数据导致空白）。 */
export const normalizeLayout = (layout: string | null | undefined): AssetLayout =>
  layout === 'list' ? 'list' : 'grid';
