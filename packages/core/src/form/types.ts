/**
 * @main-ui/core —— 模板库公共基座：框架无关的表单 schema 类型。
 *
 * 供 `@main-ui/view-form`（分组表单）与 `@main-ui/view-inspector`（属性面板）共享。
 * 约束：不含任何网络语义字段（无 url / token），事件命名语义化；
 * 视图模板只呈现与抛出意图，数据获取与落库一律在宿主适配层完成。
 */

/** 文本输入字段。 */
export type FormStringField = {
  kind: 'string';
  key: string;
  label: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  disabled?: boolean;
  /** 必填：空字符串视为缺失 */
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  /** 正则校验（数据字段，非网络语义） */
  pattern?: string;
  patternMessage?: string;
};

/** 数值输入字段（支持 min / max / step 约束）。 */
export type FormNumberField = {
  kind: 'number';
  key: string;
  label: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  disabled?: boolean;
  required?: boolean;
};

/** 布尔开关字段。 */
export type FormBooleanField = {
  kind: 'boolean';
  key: string;
  label: string;
  description?: string;
  defaultValue?: boolean;
  disabled?: boolean;
};

/** 下拉选择字段。 */
export type FormSelectField = {
  kind: 'select';
  key: string;
  label: string;
  description?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
};

/** 多行文本字段。 */
export type FormTextareaField = {
  kind: 'textarea';
  key: string;
  label: string;
  description?: string;
  placeholder?: string;
  rows?: number;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
};

/** 数组字段（动态增删行，每项为内嵌字段）。 */
export type FormArrayField = {
  kind: 'array';
  key: string;
  label: string;
  description?: string;
  /** 数组项字段定义（每项复用同一结构） */
  itemFields: FormField[];
  defaultValue?: FormValues[];
  disabled?: boolean;
  minItems?: number;
  maxItems?: number;
};

/** 条件显隐规则：当指定字段值匹配时，字段可见。 */
export type VisibleWhen = {
  /** 依赖字段 key */
  field: string;
  /** 匹配值（支持单值或数组；数组时任一匹配即可见） */
  equals: unknown;
  /** 取反：匹配时隐藏而非显示 */
  negate?: boolean;
};

export type FormField =
  | FormStringField
  | FormNumberField
  | FormBooleanField
  | FormSelectField
  | FormTextareaField
  | FormArrayField;

/** 所有字段可选的条件显隐属性（opt-in，不影响既有宿主行为）。 */
export type FormFieldWithVisibility = FormField & { visibleWhen?: VisibleWhen };

/** 字段分组（呈现顺序即数组顺序；省略分组即平铺字段列表）。 */
export type FormGroup = {
  id: string;
  title: string;
  /** 分组级描述 */
  description?: string;
  fields: FormField[];
};

/** 表单 schema：平铺字段或分组字段二选一（两者并存时分组优先）。 */
export type FormSchema = {
  fields?: FormField[];
  groups?: FormGroup[];
};

/** 字段值表（宿主侧的单一事实源经 Props 注入）。 */
export type FormValues = Record<string, unknown>;

/** 字段变更意图载荷：key + 新值 + 旧值，由宿主裁决是否落库。 */
export type FormChangePayload = {
  key: string;
  value: unknown;
  previous: unknown;
};

/** 提交意图载荷：当前全部值与校验结果（是否阻断由宿主裁决）。 */
export type FormSubmitPayload = {
  values: FormValues;
  valid: boolean;
};

/** 预设模板保存意图载荷（view-form 场景：宿主负责持久化，视图不接触存储）。 */
export type FormSavePresetIntentPayload = {
  name: string;
  values: FormValues;
};

/** 预设模板应用意图载荷。 */
export type FormApplyPresetIntentPayload = {
  name: string;
};

/** 展开为有序字段列表（分组优先；组内字段顺序保持）。 */
export const flattenFormSchema = (schema: FormSchema): FormField[] => {
  if (schema.groups && schema.groups.length > 0) {
    return schema.groups.flatMap((group) => group.fields);
  }
  return schema.fields ?? [];
};

/** 由 schema 默认值合成初始值表（不覆盖宿主已注入的值）。 */
export const createDefaultFormValues = (schema: FormSchema): FormValues => {
  const values: FormValues = {};
  for (const field of flattenFormSchema(schema)) {
    if (field.defaultValue !== undefined) {
      values[field.key] = field.defaultValue;
    }
  }
  return values;
};

/**
 * 评估字段是否可见（纯函数，可单测）。
 * 无 visibleWhen 条件时默认可见；条件不满足时隐藏。
 */
export const evaluateVisibility = (
  field: FormFieldWithVisibility,
  values: FormValues,
): boolean => {
  if (!field.visibleWhen) return true;
  const { field: depKey, equals, negate } = field.visibleWhen;
  const depValue = values[depKey];
  const matches = Array.isArray(equals)
    ? equals.some((v) => v === depValue)
    : equals === depValue;
  return negate ? !matches : matches;
};
