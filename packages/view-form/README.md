# @main-ui/view-form

main-ui 官方视图模板：schema 驱动分组表单（配置面板 / 动态表单）。与 `@main-ui/view-inspector` 共享模板库公共基座 `@main-ui/core`（字段类型 / 分组 / 校验纯函数）。

## 边界（强制规范）

- **零业务逻辑、零网络**：数据经 Props 注入（含 `loading` / `error` 三态），操作意图一律经 Emits 抛出，由宿主裁决落库；视图不发起任何请求。
- **实现契约四成员**：`viewType: 'view-form'` + `getViewState` / `restoreViewState` / `onDestroy`（幂等），经 `main-ui/vue` 的 `useViewLifecycle` 挂载。
- **零硬编码色值**：颜色全部消费 `--mui-*` 主题变量。
- 校验只呈现（字段级错误提示 + 提交意图携带 `valid` 标记），不阻断、不拦截——是否阻断由宿主裁决。

## Props

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `schema` | `FormSchema` | 平铺字段或分组字段（分组优先） |
| `values` | `FormValues \| null` | 宿主侧单一事实源 |
| `loading` / `error` | 三态 | 取数状态由宿主注入 |
| `presets` | `string[]` | 预设模板名称列表（宿主注入，视图不接触存储） |
| `presetsEnabled` | `boolean` | 预设条开关（默认开） |
| `submitLabel` | `string` | 提交按钮文案（默认 `Submit`） |
| `editorInstanceId` | `string \| null` | 传入则挂载视图生命周期 |

## Emits（意图）

| 事件 | 载荷 | 语义 |
| --- | --- | --- |
| `change` | `FormChangePayload` | 单字段变更（含旧值） |
| `submit` | `FormSubmitPayload` | 提交（携带全部值 + `valid`） |
| `save-preset-intent` | `FormSavePresetIntentPayload` | 保存预设模板（持久化在宿主） |
| `apply-preset-intent` | `FormApplyPresetIntentPayload` | 应用预设模板（回填由宿主完成） |

## 快速接入

```ts
import { registerFormViewEditor } from '@main-ui/view-form';

registerFormViewEditor(runtime, { allowedWorkspaceIds: ['demo'] }, undefined, () => ({
  onSubmit: (payload) => adapter.submitConfig(payload),
  onSavePresetIntent: (payload) => adapter.savePreset(payload),
  onApplyPresetIntent: (payload) => adapter.applyPreset(payload),
}));
```
