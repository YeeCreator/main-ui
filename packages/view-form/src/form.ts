import type { FormField, FormSchema, FormValues } from '@main-ui/core';
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
  }
};
