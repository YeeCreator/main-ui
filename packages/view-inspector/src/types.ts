/**
 * @main-ui/view-inspector 数据契约：宿主适配层负责取数并转成 schema + values 经 Props 注入，
 * 视图只呈现与抛出变更意图（Emits），绝不发起网络请求。
 *
 * 字段类型自 v0.4 起别名收敛到模板库公共基座 `@main-ui/core`（与 view-form 共享）；
 * 属性面板仅消费不含 textarea 的字段子集。
 */
import type {
  FormBooleanField,
  FormNumberField,
  FormSelectField,
  FormStringField,
  FormValues,
} from '@main-ui/core';

/** 文本输入字段。 */
export type InspectorStringField = FormStringField;

/** 数值输入字段（支持 min / max / step 约束）。 */
export type InspectorNumberField = FormNumberField;

/** 布尔开关字段。 */
export type InspectorBooleanField = FormBooleanField;

/** 下拉选择字段。 */
export type InspectorSelectField = FormSelectField;

/**
 * 只读字段（纯呈现，不可编辑）：ID、计算值、系统注入的属性。
 *
 * 为什么不复用 `disabled`：二者语义不同。`disabled` 是「此刻不能改」（如条件未满足），
 * 而 `readonly` 是「永远不该改」（如实例 id）。用 `disabled` 冒充会让用户
 * 以为自己漏满足了什么条件。
 */
export type InspectorReadonlyField = {
  kind: 'readonly';
  key: string;
  label: string;
  description?: string;
  /** 呈现形式：`text`（缺省）或 `code`（等宽字体） */
  display?: 'text' | 'code';
};

export type InspectorField =
  | InspectorStringField
  | InspectorNumberField
  | InspectorBooleanField
  | InspectorSelectField
  | InspectorReadonlyField;

/** 字段分组（呈现顺序即数组顺序；省略分组即平铺字段列表）。 */
export type InspectorGroup = {
  id: string;
  title: string;
  /** 分组级描述 */
  description?: string;
  fields: InspectorField[];
};

/** 表单 schema（字段顺序即呈现顺序；与 `groups` 并存时分组优先）。 */
export type InspectorSchema =
  | InspectorField[]
  | { fields?: InspectorField[]; groups?: InspectorGroup[] };

/** 字段值表（宿主侧的单一事实源经 Props 注入）。 */
export type InspectorValues = FormValues;

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
