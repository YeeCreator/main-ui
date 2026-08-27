# @main-ui/view-tree

main-ui 官方视图模板：**自研虚拟滚动树**（目录树 / 项目树 / 场景树）。支持搜索过滤、展开折叠、选中高亮，数万节点只渲染可见切片。

> 遵循 v0.3 模板包红线：数据经 Props 注入（含 `loading` / `error` 三态），操作经 Emits 抛出，包内不发起任何网络请求；颜色一律消费 `--mui-*` 主题变量；实现完整 `MainUiViewLifecycle` 四成员契约。

## 安装

```bash
pnpm add @main-ui/view-tree main-ui vue
```

## 组件用法

```ts
import { TreeView } from '@main-ui/view-tree';
import type { ViewTreeNode } from '@main-ui/view-tree';

const items: ViewTreeNode[] = [
  { id: 'src', label: 'src', children: [{ id: 'src/main', label: 'main.ts' }] },
];
```

```ts
h(TreeView, {
  items,
  loading: false,
  error: null,
  selectedId: null,
  expandedIds: ['src'],
  filterable: true,
  onSelect: (nodeId) => { /* 宿主侧处理 */ },
  onToggle: (nodeId, expanded) => { /* 宿主侧处理 */ },
  onFilterChange: (keyword) => { /* 宿主侧处理 */ },
})
```

### Props

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `items` | `ViewTreeNode[]` | 必填 | 树数据契约（`{ id, label, icon?, children? }`） |
| `loading` | `boolean` | `false` | 加载三态：显示 Loading 占位 |
| `error` | `string \| null` | `null` | 加载三态：显示错误文案 |
| `selectedId` | `string \| null` | `null` | 受控选中节点 |
| `expandedIds` | `string[]` | `null` | 受控展开集合（`null` 时不覆盖内部状态） |
| `filterable` | `boolean` | `true` | 是否显示过滤输入框 |
| `itemHeight` | `number` | `26` | 行高（虚拟滚动必需等行高） |
| `editorInstanceId` | `string \| null` | `null` | 传入则自动挂载 `MainUiViewLifecycle`，视图状态（展开/选中/过滤/滚动）进入快照回放 |

### Emits

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `select` | `(nodeId: string)` | 点击行 |
| `toggle` | `(nodeId: string, expanded: boolean)` | 展开/折叠 |
| `filter-change` | `(keyword: string)` | 过滤关键词变化 |

过滤为组件内部即时行为（命中路径自动展开），`filter-change` 仅供宿主做异步搜索等扩展。

### 视图状态（`TreeViewState`）

`getViewState` / `restoreViewState` 携带 `{ expandedIds, selectedId, filter, scrollTop }`，随浮动窗口拖出/拖回、会话恢复完整回放。

## 一键注册为 main-ui 编辑器

```ts
import { registerTreeViewEditor } from '@main-ui/view-tree';

registerTreeViewEditor(runtime, {
  allowedWorkspaceIds: ['demo'],
  title: 'Project Tree',
});
```

- `createTreeViewEditorDescriptor(options)`：只生成 descriptor（默认开启 `allowFloatingWindow`）。
- `createTreeViewEditorRenderer(resolveProps?)`：生成 renderer 适配器；`resolveProps` 是宿主适配层扩展点——取数、把领域结构转成 `ViewTreeNode[]` 都在宿主侧完成，默认实现从 `editor.payload` 读取 `{ items, loading, error, expandedIds }`。

## 宿主适配层职责

模板包不做取数。宿主适配层负责：异步加载数据 → 转成 `ViewTreeNode[]` 契约 → 经 `payload` / props 注入，并维护 `loading` / `error` 三态。参考 `demo` 中的模拟后端适配层示范。
