# @main-ui/view-inspector

main-ui 官方视图模板：**schema 驱动的属性检查器表单**。内置 `string` / `number` / `boolean` / `select` 四种字段类型，两栏栅格布局，值变更以「意图」形式抛出。

> 遵循 v0.3 模板包红线：数据经 Props 注入（含 `loading` / `error` 三态），操作经 Emits 抛出，包内不发起任何网络请求；颜色一律消费 `--mui-*` 主题变量；实现完整 `MainUiViewLifecycle` 四成员契约。

## 安装

```bash
pnpm add @main-ui/view-inspector main-ui vue
```

## 组件用法

```ts
import { InspectorView, type InspectorSchema } from '@main-ui/view-inspector';

const schema: InspectorSchema = [
  { kind: 'string', key: 'name', label: '名称' },
  { kind: 'number', key: 'width', label: '宽度', min: 0, max: 1000, step: 1 },
  { kind: 'boolean', key: 'visible', label: '可见' },
  { kind: 'select', key: 'mode', label: '模式', options: [
    { value: 'edit', label: '编辑' },
    { value: 'view', label: '预览' },
  ]},
];

h(InspectorView, {
  schema,
  values: { name: 'Scene', width: 200, visible: true, mode: 'edit' },
  onChange: ({ key, value, previous }) => { /* 宿主裁决是否落库 */ },
})
```

### Props

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `schema` | `InspectorSchema` | 必填 | 字段定义数组（顺序即呈现顺序） |
| `values` | `InspectorValues \| null` | `null` | 受控值表；缺省字段回退 `defaultValue` 再按 kind 推导 |
| `loading` | `boolean` | `false` | 加载三态：显示 Loading 占位 |
| `error` | `string \| null` | `null` | 加载三态：显示错误文案 |
| `editorInstanceId` | `string \| null` | `null` | 传入则自动挂载 `MainUiViewLifecycle`，值表 + 滚动进入快照回放 |

### Emits

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `change` | `{ key, value, previous }` | 字段变更意图；数值自动钳制 `min`/`max`，select 只接受 schema 内选项；值未变化不抛出 |

### 纯函数助手

- `clampNumber(value, min?, max?)`：数值钳制。
- `fieldFallback(field)` / `resolveFieldValue(field, values)`：缺省值推导与解析。
- `buildInspectorDefaults(schema)`：全量缺省值表（供宿主初始化/重置）。
- `coerceFieldValue(field, raw, previous)`：按字段类型规范化控件原始输入。

### 视图状态（`InspectorViewState`）

`getViewState` / `restoreViewState` 携带 `{ values, scrollTop }`，随浮动窗口拖出/拖回、会话恢复完整回放。

## 一键注册为 main-ui 编辑器

```ts
import { registerInspectorViewEditor } from '@main-ui/view-inspector';

registerInspectorViewEditor(runtime, {
  allowedWorkspaceIds: ['demo'],
  title: 'Inspector',
});
```

- `createInspectorViewEditorDescriptor(options)`：只生成 descriptor（默认开启 `allowFloatingWindow`）。
- `createInspectorViewEditorRenderer(resolveProps?)`：生成 renderer 适配器；`resolveProps` 是宿主适配层扩展点——取数、把领域对象转成 `{ schema, values }` 都在宿主侧完成，默认实现从 `editor.payload` 读取。

## 宿主适配层职责

模板包不做取数。宿主适配层负责：根据选中对象生成 `InspectorSchema` + `InspectorValues` 经 props 注入，并消费 `change` 意图裁决落库后回注新的 `values`。参考 `demo` 中的模拟后端适配层示范。
