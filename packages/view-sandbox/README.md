# @main-ui/view-sandbox

自由沙盘画布（v0.6.0，旗舰复合模板）。2D 视口 + 异构元素（`shape` / `image` / `embed-view`）+ 连线 + 可控嵌套；面向沙盘、白板、简易流程图场景，不对标完备绘图软件。

- **L2 内核** `createSandboxKernel`：无头纯 TS（元素/连线/相机/变更事件/`toJSON` 序列化）；嵌入子 View 一律经 `@main-ui/core` 的 `EmbeddedViewHost` 托管（内核内置），嵌套深度保护默认 8 层（超限截断 + 告警）；
- **L3 视图** `SandboxView`：实现 `MainUiViewLifecycle` 四成员，`onDestroy` 级联销毁全部嵌入子实例。

不重新实现流程/节点逻辑——嵌入 `view-flow` / `view-node` 等只走数据引用（`embedViewRef`），绝不渗透 Docking 布局树。

## 安装

```bash
pnpm add @main-ui/view-sandbox @main-ui/core main-ui vue
```

## 一键注册

```ts
import { registerSandboxViewEditor, createSandboxKernel } from '@main-ui/view-sandbox'

// 内核：可脱离浏览器单测
const kernel = createSandboxKernel(doc, camera, { maxNestingDepth: 8 })
kernel.addElement({ id: 'a', type: 'shape', x: 0, y: 0, width: 100, height: 60, rotation: 0 })
kernel.addConnection({ id: 'c1', source: { elementId: 'a' }, target: { elementId: 'b' } })

registerSandboxViewEditor(
  runtime,
  { allowedWorkspaceIds: ['my-workspace'], title: 'Sandbox' },
  (context) => ({ document: myStore.getSandboxDoc(context.editor.id), loading: false, error: null }),
  (context) => ({
    onElementMoveIntent: (p) => myStore.moveElement(context.editor.id, p),
    onConnectIntent: (p) => myStore.connect(context.editor.id, p),
    onSelection: (p) => myStore.select(context.editor.id, p),
  }),
)
```

kind 为 `view-sandbox`，需并入 `WorkspaceDescriptor.allowedEditorKinds`。

## Props

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `document` | `SandboxDocument` | 沙盘文档（`elements` + `connections`；元素含 `shape` / `image` / `embedViewRef` 三类载荷） |
| `loading` / `error` | — | 三态 |
| `editable` | `boolean` | 是否允许拖拽/缩放/连线（默认 `true`） |
| `maxNestingDepth` | `number` | 最大嵌套深度（默认 `8`，超限降级占位） |
| `editorInstanceId` | `string \| null` | 传入则自动挂载视图生命周期 |

## Emits

`element-move-intent` / `element-remove-intent` / `element-add-intent` / `connect-intent` / `selection`。

## 视图状态

`SandboxViewState = { camera, selectedElementIds, embeddedRefs }`（嵌入子 View 只存引用，不深拷贝子 View 数据）。

## 红线

零网络请求（`image.src` 只收宿主注入的数据字段，模板不拉取资源）；嵌套只走数据引用；颜色消费 `--mui-*`。
