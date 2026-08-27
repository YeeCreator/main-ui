# @main-ui/view-table

main-ui 官方视图模板：**自研虚拟滚动表格**。列定义 + 行数据，支持表头排序（无 → asc → desc 循环）、行选中、双击单元格行内编辑（编辑结果以意图形式抛出）。

> 遵循 v0.3 模板包红线：数据经 Props 注入（含 `loading` / `error` 三态），操作经 Emits 抛出，包内不发起任何网络请求；颜色一律消费 `--mui-*` 主题变量；实现完整 `MainUiViewLifecycle` 四成员契约。

## 安装

```bash
pnpm add @main-ui/view-table main-ui vue
```

## 组件用法

```ts
import { TableView, type TableColumn, type TableRow } from '@main-ui/view-table';

const columns: TableColumn[] = [
  { key: 'name', title: '名称', sortable: true },
  { key: 'score', title: '分数', width: 80, align: 'right', sortable: true },
];

h(TableView, {
  columns,
  rows: [{ id: 'r1', name: 'Alpha', score: 50 }],
  onRowSelect: (rowId) => { /* 宿主侧处理 */ },
  onSortChange: (sort) => { /* { key, direction } | null */ },
  onCellEditIntent: ({ rowId, columnKey, value }) => { /* 宿主裁决是否落库 */ },
})
```

### Props

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `columns` | `TableColumn[]` | 必填 | 列定义（`key`/`title`/`width?`/`align?`/`sortable?`） |
| `rows` | `TableRow[]` | 必填 | 行数据（键值表） |
| `loading` | `boolean` | `false` | 加载三态：显示 Loading 占位 |
| `error` | `string \| null` | `null` | 加载三态：显示错误文案 |
| `rowKey` | `string` | `'id'` | 行标识字段；缺省回退行索引 |
| `selectedRowId` | `string \| null` | `null` | 受控选中行 |
| `sort` | `TableSort` | `null` | 受控排序（`{ key, direction } \| null`） |
| `editable` | `boolean` | `true` | 双击单元格是否进入行内编辑 |
| `rowHeight` | `number` | `28` | 行高（虚拟滚动必需等行高） |
| `editorInstanceId` | `string \| null` | `null` | 传入则自动挂载 `MainUiViewLifecycle`，滚动/选中/排序进入快照回放 |

### Emits

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `row-select` | `(rowId: string)` | 点击行 |
| `sort-change` | `(sort: TableSort)` | 表头排序切换 |
| `cell-edit-intent` | `{ rowId, columnKey, value }` | 行内编辑提交（Enter / 失焦提交，Esc 取消） |

行内编辑只抛出意图，**不落库**：宿主裁决后通过回注 `rows` 生效。

### 纯函数助手

- `sortRows(rows, sort)`：稳定排序（数值按数值比、其余按字符串比，同值保序）。
- `nextSort(current, key)`：排序循环（无 → asc → desc → 无；换列重置）。
- `resolveRowId(row, index, rowKey)`：行标识解析。
- `computeTableRowWindow(...)`：虚拟滚动窗口计算。

### 视图状态（`TableViewState`）

`getViewState` / `restoreViewState` 携带 `{ scrollTop, selectedRowId, sort }`，随浮动窗口拖出/拖回、会话恢复完整回放。

## 一键注册为 main-ui 编辑器

```ts
import { registerTableViewEditor } from '@main-ui/view-table';

registerTableViewEditor(runtime, {
  allowedWorkspaceIds: ['demo'],
  title: 'Data Table',
});
```

- `createTableViewEditorDescriptor(options)`：只生成 descriptor（默认开启 `allowFloatingWindow`）。
- `createTableViewEditorRenderer(resolveProps?)`：生成 renderer 适配器；`resolveProps` 是宿主适配层扩展点，默认从 `editor.payload` 读取 `{ columns, rows, rowKey, loading, error }`。

## 宿主适配层职责

模板包不做取数。宿主适配层负责：异步加载 → 转成 `TableColumn[] + TableRow[]` 契约经 `payload`/props 注入，消费 `cell-edit-intent` 裁决落库后回注新行。参考 `demo` 中的模拟后端适配层示范。
