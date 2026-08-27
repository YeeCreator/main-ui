/**
 * @main-ui/view-form 数据契约：复用模板库公共基座 @main-ui/core 的表单类型
 * （与 view-inspector 共享 schema 基座），此处仅补充本模板专属的视图状态契约。
 */
import type { FormValues } from '@main-ui/core';

/** 视图状态契约（MainUiViewLifecycle.getViewState 的产出形态）。 */
export type FormViewState = {
  values: FormValues;
  scrollTop: number;
};
