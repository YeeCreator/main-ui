# @main-ui/core

main-ui 模板库公共基座（`packages/core`）：框架无关的表单 schema 类型与校验纯函数，供 `@main-ui/view-form` 与 `@main-ui/view-inspector` 共享。

> 注意：本包是**模板库公共基座**，与主包 `main-ui` 的 core 层（`main-ui/core` 子路径导出）相互独立、互不依赖。

## 边界

- 纯类型 + 纯函数，无运行时副作用、无框架依赖、无网络语义字段（无 `url` / `token`）。
- 校验输出语义化错误码（`required` / `min` / `max` / `pattern` / `minLength` / `maxLength` / `notANumber`），文案仅供兜底呈现，宿主可据错误码本地化。
- 是否阻断提交由宿主裁决：视图模板照常抛出意图（Emits），本基座不做任何拦截。

## 导出面

| 类别 | 导出 |
| --- | --- |
| 字段类型 | `FormStringField` / `FormNumberField` / `FormBooleanField` / `FormSelectField` / `FormTextareaField` / `FormField` |
| Schema | `FormGroup` / `FormSchema` / `FormValues` |
| 意图载荷 | `FormChangePayload` / `FormSubmitPayload` / `FormSavePresetIntentPayload` / `FormApplyPresetIntentPayload` |
| 纯函数 | `flattenFormSchema` / `createDefaultFormValues` / `validateFormField` / `validateFormValues` |

## 用法示例

```ts
import { validateFormValues, createDefaultFormValues, type FormSchema } from '@main-ui/core';

const schema: FormSchema = {
  groups: [
    {
      id: 'basic',
      title: 'Basic',
      fields: [
        { kind: 'string', key: 'name', label: 'Name', required: true, maxLength: 32 },
        { kind: 'number', key: 'hp', label: 'HP', min: 1, max: 999, defaultValue: 10 },
      ],
    },
  ],
};

const values = { ...createDefaultFormValues(schema), ...hostValues };
const result = validateFormValues(schema, values); // { valid, errors }
```
