/**
 * 表单校验纯函数（框架无关）：输入 schema + values，输出字段级错误表。
 * 视图层据此呈现错误提示；是否阻断提交由宿主裁决（意图照抛）。
 */
import { flattenFormSchema, type FormField, type FormSchema, type FormValues } from './types';

export type FormValidationError = {
  /** 语义化错误码（非文案），宿主可据此本地化 */
  code: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'min' | 'max' | 'notANumber';
  key: string;
  message: string;
};

export type FormValidationResult = {
  valid: boolean;
  /** 按字段 key 归集的首个错误 */
  errors: Record<string, FormValidationError>;
};

const isEmpty = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

/** 校验单字段；无错误返回 null。 */
export const validateFormField = (field: FormField, value: unknown): FormValidationError | null => {
  if (field.kind === 'boolean') {
    return null;
  }
  if (field.kind === 'number') {
    if (isEmpty(value)) {
      return field.required ? { code: 'required', key: field.key, message: `${field.label} is required` } : null;
    }
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(numeric)) {
      return { code: 'notANumber', key: field.key, message: `${field.label} must be a number` };
    }
    if (field.min !== undefined && numeric < field.min) {
      return { code: 'min', key: field.key, message: `${field.label} must be at least ${field.min}` };
    }
    if (field.max !== undefined && numeric > field.max) {
      return { code: 'max', key: field.key, message: `${field.label} must be at most ${field.max}` };
    }
    return null;
  }

  // string / select / textarea
  if (isEmpty(value)) {
    return field.required ? { code: 'required', key: field.key, message: `${field.label} is required` } : null;
  }
  const text = String(value);
  if (field.kind === 'string') {
    if (field.minLength !== undefined && text.length < field.minLength) {
      return { code: 'minLength', key: field.key, message: `${field.label} needs at least ${field.minLength} characters` };
    }
    if (field.maxLength !== undefined && text.length > field.maxLength) {
      return { code: 'maxLength', key: field.key, message: `${field.label} allows at most ${field.maxLength} characters` };
    }
    if (field.pattern) {
      try {
        if (!new RegExp(field.pattern).test(text)) {
          return { code: 'pattern', key: field.key, message: field.patternMessage ?? `${field.label} format is invalid` };
        }
      } catch {
        // 非法正则视为宿主 schema 错误：不阻断用户输入
      }
    }
  }
  if (field.kind === 'textarea' && field.maxLength !== undefined && text.length > field.maxLength) {
    return { code: 'maxLength', key: field.key, message: `${field.label} allows at most ${field.maxLength} characters` };
  }
  if (field.kind === 'select' && !field.options.some((option) => option.value === text)) {
    return { code: 'pattern', key: field.key, message: `${field.label} has no matching option` };
  }
  return null;
};

/** 校验整表：逐字段执行，返回全部错误。 */
export const validateFormValues = (schema: FormSchema, values: FormValues): FormValidationResult => {
  const errors: Record<string, FormValidationError> = {};
  for (const field of flattenFormSchema(schema)) {
    const error = validateFormField(field, values[field.key]);
    if (error) errors[field.key] = error;
  }
  return { valid: Object.keys(errors).length === 0, errors };
};
