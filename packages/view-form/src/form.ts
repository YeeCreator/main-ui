import type { FormArrayField, FormField, FormSchema, FormValues } from '@main-ui/core';
import { flattenFormSchema } from '@main-ui/core';

/** 数值钳制（纯函数，可单测）：越界值收敛到边界。 */
export const clampNumber = (value: number, min?: number, max?: number): number => {
  let result = value;
  if (typeof min === 'number' && result < min) result = min;
  if (typeof max === 'number' && result > max) result = max;
  return result;
};

/** 字段类型缺省值（按 kind 推导）。 */
export const fieldFallback = (field: FormField): unknown => {
  switch (field.kind) {
    case 'string':
    case 'textarea':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'select':
      return field.options[0]?.value ?? '';
    case 'array':
      return [];
  }
};

/** 解析字段当前值：values 优先，其次 defaultValue，最后按 kind 推导。 */
export const resolveFieldValue = (field: FormField, values: FormValues): unknown => {
  const injected = values[field.key];
  if (injected !== undefined) return injected;
  return field.defaultValue ?? fieldFallback(field);
};

/** schema 全量缺省值表（供宿主初始化/重置；含分组展开）。 */
export const buildFormDefaults = (schema: FormSchema): FormValues => {
  const values: FormValues = {};
  for (const field of flattenFormSchema(schema)) {
    values[field.key] = field.defaultValue ?? fieldFallback(field);
  }
  return values;
};

/**
 * 把控件原始输入按字段类型规范化（纯函数，可单测）：
 * - string / textarea：String 化；
 * - number：Number 化，非法回退当前值，合法值钳制 min/max；
 * - boolean：Boolean 化；
 * - select：只接受 options 内的值，否则回退当前值。
 */
export const coerceFieldValue = (
  field: FormField,
  raw: unknown,
  previous: unknown,
): unknown => {
  switch (field.kind) {
    case 'string':
    case 'textarea':
      return typeof raw === 'string' ? raw : String(raw ?? '');
    case 'number': {
      const parsed = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isNaN(parsed)) return previous;
      return clampNumber(parsed, field.min, field.max);
    }
    case 'boolean':
      return Boolean(raw);
    case 'select': {
      const value = typeof raw === 'string' ? raw : String(raw ?? '');
      return field.options.some((option) => option.value === value) ? value : previous;
    }
    case 'array':
      // 数组字段的增删改一律走 applyArrayIntent（下方），此处不做类型推断
      return previous;
  }
};

/** 数组字段的意图类型（增 / 删 / 改单项）。 */
export type ArrayIntent =
  | { type: 'append' }
  | { type: 'remove'; index: number }
  | { type: 'patch'; index: number; item: FormValues };

/**
 * 根据 itemFields 合成一个空数组项（每个子字段取其 defaultValue 或类型缺省）。
 *
 * @param field 数组字段定义。
 * @returns 新数组项。
 */
export const createArrayItem = (field: FormArrayField): FormValues => {
  const item: FormValues = {};
  for (const sub of field.itemFields) {
    item[sub.key] = sub.defaultValue ?? fieldFallback(sub);
  }
  return item;
};

/**
 * 执行数组意图并返回新数组（纯函数，不修改入参）。
 *
 * 约束：超出 `minItems` / `maxItems` 的增删被静默拒绝（返回原数组引用），
 * 使视图层无需重复边界判断；实际意图是否成立由返回值是否变化反映。
 *
 * @param field 数组字段定义（提供 itemFields 与项数约束）。
 * @param current 当前数组值（非数组时视为空数组）。
 * @param intent 意图。
 * @returns 新数组；越界或无效索引时返回入参本身。
 * @example
 * ```ts
 * applyArrayIntent(field, [], { type: 'append' }); // [ { ...默认项 } ]
 * ```
 */
export const applyArrayIntent = (
  field: FormArrayField,
  current: unknown,
  intent: ArrayIntent,
): FormValues[] => {
  const arr = Array.isArray(current) ? (current as FormValues[]) : [];
  switch (intent.type) {
    case 'append': {
      if (field.maxItems !== undefined && arr.length >= field.maxItems) return arr;
      return [...arr, createArrayItem(field)];
    }
    case 'remove': {
      if (field.minItems !== undefined && arr.length <= field.minItems) return arr;
      if (intent.index < 0 || intent.index >= arr.length) return arr;
      return arr.filter((_, i) => i !== intent.index);
    }
    case 'patch': {
      if (intent.index < 0 || intent.index >= arr.length) return arr;
      return arr.map((item, i) => (i === intent.index ? { ...intent.item } : item));
    }
  }
};
