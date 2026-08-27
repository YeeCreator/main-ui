/**
 * @main-ui/view-form —— schema 驱动分组表单模板。
 * 表单基座（字段类型 / 分组 / 校验）来自模板库公共包 `@main-ui/core`，
 * 本包在此重导出，宿主单点引入即可获得完整契约。
 */
export type {
  FormApplyPresetIntentPayload,
  FormBooleanField,
  FormChangePayload,
  FormField,
  FormGroup,
  FormNumberField,
  FormSavePresetIntentPayload,
  FormSchema,
  FormSelectField,
  FormStringField,
  FormSubmitPayload,
  FormTextareaField,
  FormValidationError,
  FormValidationResult,
  FormValues,
} from '@main-ui/core';
export { createDefaultFormValues, flattenFormSchema, validateFormField, validateFormValues } from '@main-ui/core';

export * from './types';
export * from './form';
export * from './FormView';
export * from './register';
