/**
 * @main-ui/view-inspector 数据契约：宿主适配层负责取数并转成 schema + values 经 Props 注入，
 * 视图只呈现与抛出变更意图（Emits），绝不发起网络请求。
 */

/** 文本输入字段。 */
export type InspectorStringField = {
  kind: 'string';
  key: string;
  label: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  disabled?: boolean;
};

/** 数值输入字段（支持 min / max / step 约束）。 */
export type InspectorNumberField = {
  kind: 'number';
  key: string;
  label: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  disabled?: boolean;
};

/** 布尔开关字段。 */
export type InspectorBooleanField = {
  kind: 'boolean';
  key: string;
  label: string;
  description?: string;
  defaultValue?: boolean;
  disabled?: boolean;
};

/** 下拉选择字段。 */
export type InspectorSelectField = {
  kind: 'select';
  key: string;
  label: string;
  description?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  defaultValue?: string;
  disabled?: boolean;
};

export type InspectorField =
  | InspectorStringField
  | InspectorNumberField
  | InspectorBooleanField
  | InspectorSelectField;

/** 表单 schema（字段顺序即呈现顺序）。 */
export type InspectorSchema = InspectorField[];

/** 字段值表（宿主侧的单一事实源经 Props 注入）。 */
export type InspectorValues = Record<string, unknown>;

/** 变更意图载荷：key + 新值 + 旧值，由宿主裁决是否落库。 */
export type InspectorChangePayload = {
  key: string;
  value: unknown;
  previous: unknown;
};

/** 视图状态契约（MainUiViewLifecycle.getViewState 的产出形态）。 */
export type InspectorViewState = {
  values: InspectorValues;
  scrollTop: number;
};
