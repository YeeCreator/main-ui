# PRESET_VIEWS_GUIDE

> 官方视图模板库（preset-views）统一指南。对应 `main-ui 0.4.0`。本文档随 `main-ui` 包分发（`node_modules/main-ui/docs/PRESET_VIEWS_GUIDE.md`）；每个模板包自身的 `README.md` 是安装后的第一入口，内容与本文一致。

## 1. 定位

官方视图模板库为下游宿主提供「开箱即用 + 可扩展」的通用业务视图，使宿主专注后端与业务。全部模板是成熟开源内核的**薄封装**，不重写内核。

模板红线（接入评审项，全部强制）：

1. 实现 `MainUiViewLifecycle` 全四成员（`viewType` / `getViewState` / `restoreViewState` / `onDestroy`，其中 `onDestroy` 必须幂等）；视图状态随布局保存/恢复。
2. 数据经 **Props 进**（含 `loading` / `error` / data 三态），操作经 **Emits 出**（意图由宿主裁决）。
3. 包内**零网络请求**（发布检查项：网络调用扫描零命中）。
4. 颜色一律消费 `--mui-*` 主题变量；密度消费 `--mui-row-height*` / `--mui-density-*`。
5. 根元素自适应 Surface 尺寸；不持有业务数据。

## 2. 包清单与安装

### 2.1 包清单

| 包 | 版本 | 内核 | 用途 |
| --- | --- | --- | --- |
| `@main-ui/view-tree` | 0.3.0 | 自研虚拟滚动 | 目录/项目/场景树：过滤、展开折叠、选中高亮 |
| `@main-ui/view-inspector` | 0.4.0 | schema 表单（`@main-ui/core` 基座） | 属性检视：对象 + schema，变更经 Emits 抛出 |
| `@main-ui/view-2d` | 0.3.0 | `@main-ui/viewport-2d-kit`（pixi） | 2D 画布：相机状态进 `getViewState` |
| `@main-ui/view-table` | 0.3.0 | 自研虚拟滚动 | 表格浏览/编辑：单元格编辑意图经 Emits 抛出 |
| `@main-ui/view-form` | 0.4.0 | schema 表单（`@main-ui/core` 基座） | 配置面板：提交/预设存取以意图抛出 |
| `@main-ui/view-node` | 0.4.0 | `@vue-flow/core`（peer `^1.48`） | 节点图/连线：视口与选中进 `getViewState` |
| `@main-ui/view-console` | 0.4.0 | 自研虚拟滚动 | 日志/控制台追加列表：过滤、自动跟随/锁滚 |
| `@main-ui/preset-views` | 0.4.0 | — | 聚合包：命名空间重导出（无逻辑） |

配套基座：`@main-ui/core`（0.4.0）为框架无关表单基座（`FormFieldSchema` / `FormValues` / 校验纯函数），供 `view-form` 与 `view-inspector` 共用，宿主自定义表单亦可单独消费。

### 2.2 安装矩阵

所有模板包把 `main-ui`（`^0.4.0`）与 `vue` 声明为 peerDependency，重型内核留在各包 peer 中，需显式安装：

```bash
# 按需安装（示例：只要树和表格）
pnpm add @main-ui/view-tree @main-ui/view-table main-ui vue

# 全量安装
pnpm add @main-ui/view-tree @main-ui/view-inspector @main-ui/view-2d @main-ui/view-table \
         @main-ui/view-form @main-ui/view-node @main-ui/view-console main-ui vue

# 聚合包（仅重导出，仍建议显式安装模板包本体）
pnpm add @main-ui/preset-views
```

额外内核依赖：

| 模板 | 额外必装 |
| --- | --- |
| `view-2d` | `@main-ui/viewport-2d-kit` + `pixi.js` |
| `view-node` | `@vue-flow/core@^1.48`（结构样式为包内 vendored，运行时自动注入，无需宿主处理） |
| `view-form` / `view-inspector` | `@main-ui/core`（peer） |

### 2.3 安装后文档位置

| 包 | 文档 |
| --- | --- |
| 各 `@main-ui/view-*` | `node_modules/@main-ui/view-*/README.md`（完整 Props/Emits/视图状态 API） |
| `@main-ui/preset-views` | `node_modules/@main-ui/preset-views/README.md` |
| `@main-ui/core` | `node_modules/@main-ui/core/README.md` |
| 统一指南（本文） | `node_modules/main-ui/docs/PRESET_VIEWS_GUIDE.md` |

## 3. 统一接入模式（三步）

每包统一结构：`types.ts`（数据契约 TS 类型）+ 主组件 + `register.ts`（一键注册）。

### 步骤 1：注册

```ts
import { registerTreeViewEditor } from '@main-ui/view-tree'

registerTreeViewEditor(runtime, { allowedWorkspaceIds: ['my-workspace'], title: 'Project Tree' })
```

- `options.allowedWorkspaceIds` 声明模板可出现的 workspace；同时需把模板 kind（`view-tree` / `view-inspector` / `view-2d` / `view-table` / `view-form` / `view-node` / `view-console`）并入对应 `WorkspaceDescriptor.allowedEditorKinds`。
- 底层拆解可用：`createXxxEditorDescriptor(options)` 只生成 descriptor；`createXxxEditorRenderer(resolveProps?, extraProps?)` 只生成 renderer 适配器。

### 步骤 2：数据经 Props 进

`resolveProps(context)` 把宿主适配层数据转成模板契约（含 `loading` / `error` 三态）；模板不取数、不缓存。

### 步骤 3：意图经 Emits 出

`extraProps(context)` 转发模板事件；宿主裁决后回写自己的数据源，经受控回流更新视图。

完整示例：

```ts
registerTreeViewEditor(
  runtime,
  { allowedWorkspaceIds: ['my-workspace'], title: 'Project Tree' },
  // resolveProps：取数 → 转契约（三态）
  (context) => ({
    items: myStore.getItems(context.editor.id),
    loading: myStore.isLoading(context.editor.id),
    error: myStore.getError(context.editor.id),
  }),
  // extraProps：消费意图（Emits），裁决后回写
  (context) => ({ onSelect: (nodeId) => myStore.select(context.editor.id, nodeId) }),
)
```

聚合包用法：

```ts
import { tree, inspector, view2d, table, form, node, consoleView } from '@main-ui/preset-views'

tree.registerTreeViewEditor(runtime, { allowedWorkspaceIds: ['demo'] })
form.registerFormViewEditor(runtime, { allowedWorkspaceIds: ['demo'] })
node.registerNodeViewEditor(runtime, { allowedWorkspaceIds: ['demo'] })
consoleView.registerConsoleViewEditor(runtime, { allowedWorkspaceIds: ['demo'] })
```

## 4. 各模板 API

### 4.1 `@main-ui/view-tree`（虚拟滚动树）

组件 `TreeView`；注册 `registerTreeViewEditor`。数万节点只渲染可见切片。

Props：

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `items` | `ViewTreeNode[]` | 必填 | 树数据（`{ id, label, icon?, children? }`） |
| `loading` / `error` | `boolean` / `string \| null` | — | 加载三态 |
| `selectedId` | `string \| null` | `null` | 受控选中节点 |
| `expandedIds` | `string[] \| null` | `null` | 受控展开集合（`null` 不覆盖内部状态） |
| `filterable` | `boolean` | `true` | 是否显示过滤输入框 |
| `itemHeight` | `number` | `26` | 行高（虚拟滚动必需等行高） |
| `editorInstanceId` | `string \| null` | `null` | 传入则自动挂载视图生命周期 |

Emits：`select(nodeId)` / `toggle(nodeId, expanded)` / `filter-change(keyword)`。过滤为组件内部即时行为（命中路径自动展开），`filter-change` 供宿主做异步搜索扩展。

视图状态（`TreeViewState`）：`{ expandedIds, selectedId, filter, scrollTop }`。

### 4.2 `@main-ui/view-inspector`（schema 属性检视）

组件 `InspectorView`；注册 `registerInspectorViewEditor`。

Props：

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `schema` | `InspectorSchema` | 必填 | 字段定义数组（顺序即呈现顺序；支持 string/number/boolean/select） |
| `values` | `InspectorValues \| null` | `null` | 受控值表；缺省字段回退 `defaultValue` 再按 kind 推导 |
| `loading` / `error` | — | — | 加载三态 |
| `editorInstanceId` | `string \| null` | `null` | 挂载视图生命周期（值表 + 滚动进快照） |

Emits：`change({ key, value, previous })`——数值自动钳制 `min`/`max`，select 只接受 schema 内选项，值未变化不抛出。

### 4.3 `@main-ui/view-2d`（2D 画布）

组件 `View2d`；注册 `registerView2dEditor`。基于 `@main-ui/viewport-2d-kit`（PixiJS）。

Props：

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `viewBox` | `View2dViewBox` | `DEFAULT_VIEW_2D_VIEWBOX` | 首次打开相机 fit 的世界范围 |
| `minScale` / `maxScale` | `number` | `0.25` / `4` | 缩放边界 |
| `paddingPx` | `number` | `56` | fit 留白 |
| `background` | `number \| null` | `null` | pixi 数值色；`null` 时读取 `--mui-color-panel` 换算（主题跟随） |
| `loading` / `error` | — | — | 加载三态（loading 时不挂载 pixi） |
| `editorInstanceId` | `string \| null` | `null` | 挂载视图生命周期（相机进快照） |

Emits：`ready(viewport: PixiViewport)`（pixi 就绪，宿主在此绘制世界内容）/ `camera-change(camera)`。

宿主适配层职责：世界内容绘制完全在宿主侧（`onReady` 拿到 viewport 后自行绘制）。

### 4.4 `@main-ui/view-table`（虚拟滚动表格）

组件 `TableView`；注册 `registerTableViewEditor`。

Props：

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `columns` | `TableColumn[]` | 必填 | 列定义（`key` / `title` / `width?` / `align?` / `sortable?`） |
| `rows` | `TableRow[]` | 必填 | 行数据（键值表） |
| `loading` / `error` | — | — | 加载三态 |
| `rowKey` | `string` | `'id'` | 行标识字段（缺省回退行索引） |
| `selectedRowId` | `string \| null` | `null` | 受控选中行 |
| `sort` | `TableSort` | `null` | 受控排序（`{ key, direction } \| null`） |
| `editable` | `boolean` | `true` | 双击单元格是否进入行内编辑 |
| `rowHeight` | `number` | `28` | 行高（虚拟滚动必需等行高） |
| `editorInstanceId` | `string \| null` | `null` | 挂载视图生命周期（滚动/选中/排序进快照） |

Emits：`row-select(rowId)` / `sort-change(sort)` / `cell-edit-intent({ rowId, columnKey, value })`（Enter/失焦提交，Esc 取消）。

### 4.5 `@main-ui/view-form`（配置面板，v0.4）

组件 `FormView`；注册 `registerFormViewEditor`。schema 驱动（`@main-ui/core` 基座），支持平铺字段与分组字段（分组优先）。

Props：

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `schema` | `FormSchema` | 平铺字段或分组字段 |
| `values` | `FormValues \| null` | 宿主侧单一事实源 |
| `loading` / `error` | — | 三态 |
| `presets` | `string[]` | 预设模板名称列表（宿主注入，视图不接触存储） |
| `presetsEnabled` | `boolean` | 预设条开关（默认开） |
| `submitLabel` | `string` | 提交按钮文案（默认 `Submit`） |
| `editorInstanceId` | `string \| null` | 挂载视图生命周期（表单草稿进快照） |

Emits：`change(FormChangePayload)`（单字段变更，含旧值）/ `submit({ values, valid, errors })` / `save-preset-intent` / `apply-preset-intent`（预设存取均走意图，存储介质由宿主决定）。

标准链路：提交 → 宿主校验裁决 → 落库（可异步）→ 经数据源回写回填。参考实现：`demo/src/adapter/registerPresetViewEditors.ts`。

### 4.6 `@main-ui/view-node`（节点图，v0.4）

组件 `NodeGraphView`；注册 `registerNodeViewEditor`。`@vue-flow/core` 薄封装；节点/边只接收纯 JSON，悬空边自动剪除；结构样式经运行时 `<link>` 幂等注入（带 document 守卫，SSR 自动跳过）。

Props：

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `nodes` | `NodeGraphData[]` | 节点（`id` / `label` / `position` / `data` 透传载荷） |
| `edges` | `NodeGraphEdgeData[]` | 连边（`source` / `target` / `label`） |
| `loading` / `error` | — | 三态 |
| `editable` | `boolean` | 是否允许拖拽节点/拉线（默认 `true`；选择恒可用） |
| `editorInstanceId` | `string \| null` | 挂载视图生命周期（视口/选中进快照，按实例隔离画布） |

Emits：`node-move-intent(NodeMoveIntentPayload)` / `node-connect-intent({ source, target })` / `selection(NodeSelectionPayload)`。

### 4.7 `@main-ui/view-console`（日志/控制台，v0.4）

组件 `ConsoleView`；注册 `registerConsoleViewEditor`。自研虚拟滚动追加列表。

Props：

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `entries` | `ConsoleEntry[]` | 日志条目（`id` / `level` / `message` / `timestamp?`，追加式） |
| `loading` / `error` | — | 三态 |
| `clearEnabled` | `boolean` | 是否呈现清空按钮（默认 `true`） |
| `rowHeight` | `number` | 行高（虚拟滚动定高，默认 20） |
| `editorInstanceId` | `string \| null` | 挂载视图生命周期（过滤/跟随态进快照） |

Emits：`clear-intent`（请求宿主清空数据源，是否执行由宿主裁决）。

呈现行为（视图本地）：等级/文本过滤、自动跟随/锁滚（手动上滚锁滚，贴底恢复跟随）、上限截断由宿主数据源承担。

## 5. 宿主适配层职责（模板不承担）

1. 取数、缓存、三态管理（参考实现：`demo/src/adapter/` 的 `mockApi` + `presetViewStore` + `registerPresetViewEditors`）。
2. 编辑意图的校验/裁决与后端提交（含 `view-form` 的提交落库与回填）。
3. `view-2d` 的世界内容绘制（模板只提供相机/视口底座）。
4. 日志/条目流的生产与上限管理（`view-console`）、预设的存储介质（`view-form`）。
5. 编辑器实例关闭时的数据清理（可选，防内存增长）。
6. 停靠引导为内核内置交互，无需宿主接入；若宿主自实现拖拽，可复用 `main-ui/core` 的 `resolveDropZone` / `dropZoneToSplitDirection` 纯函数。

## 6. 扩展模式

1. **配置式**：经 props 开关行为（如 `filterable` / `editable` / `presetsEnabled`）。
2. **包装式**：在宿主侧包一层组件，组合模板与业务控件。
3. **自绘**：契约公开，宿主可直接实现 `MainUiViewLifecycle` 自绘任意视图并注册为 editor。

禁止修改模板源码；模板语义缺口应经反馈信道（mailbox/relay）回流。

## 7. 顺延与规划

- `view-asset`（资产网格）：顺延至 v0.5，缩略图契约待下游信箱回执。
- `view-3d`：三期，先与 scene-studio 的 @scene-kit 路线对齐。
- 长期候选：`view-dashboard` / `view-timeline` / `view-chat` / `view-whiteboard` / `view-terminal`，按需求信号滚动。
