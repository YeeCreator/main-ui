# @main-ui/view-node

main-ui 官方视图模板：节点图 / 关系图（图编辑、公式连线等场景）。内核为 `@vue-flow/core`（1.48.x，选型定案见主仓 `docs/DEVELOPMENT_LOG.md`），本包为薄封装，收敛未来替换内核的替换成本。

## 边界（强制规范）

- **零业务逻辑、零网络**：节点/连边数据经 Props 注入（含 `loading` / `error` 三态），移动/连线/选择等操作意图一律经 Emits 抛出，由宿主裁决是否落库；视图不发起任何请求。
- **实现契约四成员**：`viewType: 'view-node'` + `getViewState` / `restoreViewState` / `onDestroy`（幂等），经 `main-ui/vue` 的 `useViewLifecycle` 挂载。画布视口（平移 + 缩放）与选中节点进视图状态契约。
- **零硬编码色值**：内核结构样式随组件幂等注入，节点/连边外观全部消费 `--mui-*` 主题变量（不引内核 theme-default 样式）。
- 数据健壮性：节点按 `id` 去重保序，端点缺失的悬空连边不呈现（纯函数可单测）。

## Props

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `nodes` | `NodeGraphData[]` | 节点数据（`id` / `label` / `position` / `data` 透传载荷） |
| `edges` | `NodeGraphEdgeData[]` | 连边数据（`source` / `target` / `label`） |
| `loading` / `error` | 三态 | 取数状态由宿主注入 |
| `editable` | `boolean` | 是否允许拖拽节点/拉线（默认 `true`；选择恒可用） |
| `editorInstanceId` | `string \| null` | 传入则挂载视图生命周期并按实例隔离画布 |

## Emits（意图）

| 事件 | 载荷 | 语义 |
| --- | --- | --- |
| `node-move-intent` | `NodeMoveIntentPayload` | 节点拖拽结束（目标位置由宿主裁决落库） |
| `node-connect-intent` | `NodeConnectIntentPayload` | 新建连线意向（`source` → `target`） |
| `selection` | `NodeSelectionPayload` | 选中节点集合变更 |

## 快速接入

```ts
import { registerNodeViewEditor } from '@main-ui/view-node';

registerNodeViewEditor(runtime, { allowedWorkspaceIds: ['demo'] }, undefined, () => ({
  onNodeMoveIntent: (payload) => adapter.moveNode(payload),
  onNodeConnectIntent: (payload) => adapter.connectNodes(payload),
  onSelection: (payload) => adapter.updateSelection(payload),
}));
```

## 依赖说明

`@vue-flow/core` 为 peerDependency（`^1.48.0`），由宿主安装，避免强制传递给其他模板使用者。
