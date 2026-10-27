/**
 * input/when —— 上下文表达式求值的**唯一真相源**。
 *
 * 命令启用条件、绑定的 `when`、菜单/贡献可见性共用同一套语义：
 *
 * - `undefined` / 空串 → 恒真；
 * - 函数形式 → 直接调用并取布尔；
 * - 字符串形式 → `&&` / `and` 分隔的子句全部成立。
 *
 * 子句语法：`key`、`!key`、`key == value`、`key = value`、`!key == value`。
 *
 * 之所以独立成模块：贡献系统（`core/contribution/registry`）只需要求值能力，
 * 不应为了它而把整个输入引擎拖进依赖图。
 */

/** 参与求值的上下文值。 */
export type WhenContextValue = string | number | boolean | null | undefined;

/**
 * 求值上下文：最少需要一组键值。
 *
 * 刻意用**宽入参**（`unknown` 记录）而非窄接口：命令上下文
 * （`CommandRunContext`）带有 `workspaceId` 等必填字段，若这里要求
 * 更严的形状，调用方就得做无意义的适配。求值只读 `keys`，宽入参即安全。
 */
export type WhenContext = {
  /** 宿主提供或运行时内置的上下文键。 */
  keys?: Readonly<Record<string, WhenContextValue>>;
};

/** `when` 声明形式。函数形式接受任意带 `keys` 的上下文。 */
export type WhenClause<C = WhenContext> = ((context: C) => boolean) | string;

/**
 * 求值 `when` 条件。
 *
 * @param when 声明；缺省视为恒真。
 * @param context 上下文。
 * @returns 是否成立。
 * @example
 * evaluateWhen('inCanvas && !modalOpen', { keys: { inCanvas: true, modalOpen: false } }) // true
 */
export function evaluateWhen<C extends WhenContext>(when: WhenClause<C> | undefined, context: C): boolean {
  if (!when) return true;
  if (typeof when === 'function') return Boolean(when(context));
  return when.split(/\s*(?:&&|and)\s*/i).every((clause) => evaluateClause(clause.trim(), context));
}

/** 单个子句求值。 */
function evaluateClause(clause: string, context: WhenContext): boolean {
  if (!clause) return true;
  const negated = clause.startsWith('!');
  const body = negated ? clause.slice(1).trim() : clause;
  const match = body.match(/^([\w$.-]+)(?:\s*(?:==|=)\s*["']?([^"']*)["']?)?$/);
  if (!match) return true; // 无法识别的子句不阻断，避免配置笔误导致整条命令失效
  const [, key, expected] = match;
  const value = context.keys?.[key];
  const actual = expected === undefined ? Boolean(value) : String(value) === expected;
  return negated ? !actual : actual;
}

/**
 * 规范化 `when` 声明：把函数与字符串之外的一切视为「无条件」。
 *
 * 用于持久化前的清洗与面板展示。
 *
 * @param when 原始声明。
 * @returns 规范化结果；恒真场景返回 `undefined`。
 */
export function normalizeWhen<C extends WhenContext>(
  when: WhenClause<C> | undefined | null,
): WhenClause<C> | undefined {
  if (when === undefined || when === null) return undefined;
  if (typeof when === 'function') return when;
  const trimmed = when.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
