import type { ViewContribution } from './types';

/**
 * 解析侧栏应当激活哪个 view。
 *
 * **为什么需要这个纯函数**：`Sidebar` 原实现用 `views.find((v) => v.id === active)!`
 * 取当前 view，一旦激活 id 不在当前 workspace 的 view 列表内（例如切换 workspace、
 * 或某个 view 的 `when` 条件由真变假），`find` 返回 `undefined`，
 * 非空断言让 `ContributionSurface` 直接读到 `undefined.id` 而崩溃。
 *
 * 规则：
 * 1. 当前激活仍在列表中 → 保留（用户的选择不该被无声夺走）；
 * 2. 否则退回第一个 `defaultVisible`；
 * 3. 再否则退回列表首个；
 * 4. 列表为空 → `null`（不渲染侧栏）。
 */
export const resolveActiveViewId = (
  views: readonly ViewContribution[],
  currentActive: string | null,
): string | null => {
  if (views.length === 0) return null;
  if (currentActive !== null && views.some((view) => view.id === currentActive)) return currentActive;
  return views.find((view) => view.defaultVisible)?.id ?? views[0].id;
};

/**
 * 受控模式下的激活 id 解析。
 *
 * 与 `resolveActiveViewId` 的差别：**受控值优先于用户选择**。
 * 宿主（如按视角预设）希望「切到拓扑视角就展示拓扑面板」时，必须能覆盖用户上次点击，
 * 否则预设只在首次生效、之后永远被用户点击粘住。`null` 的受控值表示「不控制」。
 */
export const resolveControlledViewId = (
  views: readonly ViewContribution[],
  controlledId: string | null | undefined,
  fallbackActive: string | null,
): string | null => {
  if (views.length === 0) return null;
  if (controlledId && views.some((view) => view.id === controlledId)) return controlledId;
  return resolveActiveViewId(views, fallbackActive);
};

/** 取当前激活的 view 对象；无则 `undefined`（调用方据此跳过渲染而非崩溃）。 */
export const activeViewOf = (
  views: readonly ViewContribution[],
  currentActive: string | null,
): ViewContribution | undefined => {
  const id = resolveActiveViewId(views, currentActive);
  return id === null ? undefined : views.find((view) => view.id === id);
};

/**
 * 侧栏最终激活项（宿主建议 + 用户选择的分权规则）。
 *
 * 三条规则，顺序不可调换：
 * 1. **用户在当前视角内点过 → 听用户的**。否则受控值会永久压制点击，
 *    表现为「rail 点了没反应」（实测踩过）。
 * 2. 否则用宿主的**建议**（视角默认面板）。
 * 3. 再否则 `defaultVisible` / 首个。
 *
 * 视图切换（`scopeKey` 变化）时调用方应清空 `userActive`，使新视角的建议生效。
 */
export const resolveSidebarActiveViewId = (
  views: readonly ViewContribution[],
  options: { userActive?: string | null; suggestedId?: string | null } = {},
): string | null => {
  if (views.length === 0) return null;
  const { userActive = null, suggestedId = null } = options;
  if (userActive !== null && views.some((view) => view.id === userActive)) return userActive;
  if (suggestedId !== null && views.some((view) => view.id === suggestedId)) return suggestedId;
  return views.find((view) => view.defaultVisible)?.id ?? views[0].id;
};

/**
 * 侧栏宽度的可调范围（px）。
 *
 * 下界由内容决定：窄于此面板内容被压成一条，读不出任何信息。
 * 上界是为了保住主区 —— 侧栏再怎么"专精"，也不该宽到把画布挤没。
 */
export const SIDEBAR_WIDTH_MIN = 240;
export const SIDEBAR_WIDTH_MAX = 560;

/**
 * 把任意来源的宽度收敛进可调范围。
 *
 * **为什么要在代码里收敛，而不只靠 CSS**：CSS 的 `max-width` 会静默截断 ——
 * 宿主传 460、声明写 460、`aria-valuenow` 也报 460，而实际渲染只有 320，
 * 排查时看到的状态全是"对"的，只有量像素才发现被截。故收敛必须发生在
 * **值进入状态的那一刻**，让所有读取方看到同一个数。
 *
 * 只对 `NaN` 单独兜底（它无法比较大小，会一路传染成 `NaN` 样式从而让布局消失）；
 * `±Infinity` 交给夹取规则自然处理 —— 正无穷夹到上界、负无穷夹到下界。
 */
export const clampSidebarWidth = (value: number): number => {
  if (Number.isNaN(value)) return SIDEBAR_WIDTH_MIN;
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(value)));
};
