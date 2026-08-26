/**
 * 选中对象标识。
 */
export type SelectedEntityId = string | null;

/**
 * 规范化选中标识。
 *
 * @param value 原始值。
 * @returns 标准化后的选中标识。
 */
export function normalizeSelectedEntityId(value: string | null | undefined): SelectedEntityId {
  return value ?? null;
}
