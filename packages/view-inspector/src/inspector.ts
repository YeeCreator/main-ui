import type { InspectorField, InspectorGroup, InspectorSchema, InspectorValues } from './types';

/** 数值钳制（纯函数，可单测）：越界值收敛到边界。 */
export const clampNumber = (value: number, min?: number, max?: number): number => {
  let result = value;
  if (typeof min === 'number' && result < min) result = min;
  if (typeof max === 'number' && result > max) result = max;
  return result;
};

/** 字段类型缺省值（按 kind 推导）。readonly 字段无缺省值（值由宿主提供）。 */
export const fieldFallback = (field: InspectorField): unknown => {
  switch (field.kind) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'select':
      return field.options[0]?.value ?? '';
    case 'readonly':
      return undefined;
  }
};

/** 解析字段当前值：values 优先，其次 defaultValue，最后按 kind 推导。 */
export const resolveFieldValue = (field: InspectorField, values: InspectorValues): unknown => {
  const injected = values[field.key];
  if (injected !== undefined) return injected;
  // readonly 字段不参与 schema 缺省值（值总由宿主提供）
  if (field.kind === 'readonly') return undefined;
  return field.defaultValue ?? fieldFallback(field);
};

/**
 * 展开 schema 为有序字段列表（分组优先；不分组则直接返回字段数组）。
 *
 * @param schema 数组或分组对象形式。
 * @returns 扁平字段列表。
 */
export const flattenInspectorSchema = (schema: InspectorSchema): InspectorField[] => {
  if (Array.isArray(schema)) return schema;
  if (schema.groups && schema.groups.length > 0) {
    return schema.groups.flatMap((group) => group.fields);
  }
  return schema.fields ?? [];
};

/**
 * 展开 schema 为分组列表（数组形式时包成一个无标题组）。
 *
 * @param schema 数组或分组对象形式。
 * @returns 分组列表；空 schema 返回空数组。
 */
export const groupInspectorSchema = (schema: InspectorSchema): InspectorGroup[] => {
  if (Array.isArray(schema)) {
    return schema.length > 0 ? [{ id: 'default', title: '', fields: schema }] : [];
  }
  if (schema.groups && schema.groups.length > 0) return schema.groups;
  const fields = schema.fields ?? [];
  return fields.length > 0 ? [{ id: 'default', title: '', fields }] : [];
};

/** schema 全量缺省值表（供宿主初始化/重置）。 */
export const buildInspectorDefaults = (schema: InspectorSchema): InspectorValues => {
  const values: InspectorValues = {};
  for (const field of flattenInspectorSchema(schema)) {
    // readonly 字段无 schema 缺省，跳过不写键（与「宿主显式给空值」保持可区分）
    if (field.kind === 'readonly') continue;
    values[field.key] = field.defaultValue ?? fieldFallback(field);
  }
  return values;
};

/**
 * 把控件原始输入按字段类型规范化（纯函数，可单测）：
 * - string：String 化；
 * - number：Number 化，非法回退当前值，合法值钳制 min/max；
 * - boolean：Boolean 化；
 * - select：只接受 options 内的值，否则回退当前值。
 */
export const coerceFieldValue = (
  field: InspectorField,
  raw: unknown,
  previous: unknown,
): unknown => {
  switch (field.kind) {
    case 'string':
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
    case 'readonly':
      // 只读字段不接受任何变更：恒返回旧值，宿主不会收到 change 意图
      return previous;
  }
};
