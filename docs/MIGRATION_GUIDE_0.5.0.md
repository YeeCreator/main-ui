# Migration Guide: 0.4.0 → 0.5.0

## 概览

v0.5.0 是模板库大规模建设版本：新增 `@main-ui/view-flow`（流程/状态机文档编辑器）、虚拟滚动基座去重、`EmbeddedViewHost` + 嵌套深度保护、view-node 双模式改造，以及 `@main-ui/core` schema 扩展（数组字段 + 条件显隐）。

**向下兼容**：核心包名 `main-ui` 与导出面不变；既有 editor/workspace/renderer/payload 继续可用；持久化格式无变更。

## 包版本矩阵

| 包 | 0.4.0 | 0.5.0 | 说明 |
|---|---|---|---|
| `main-ui` | 0.4.0 | 0.4.0 | 主包版本不变 |
| `@main-ui/core` | 0.4.0 | **0.5.0** | 新增虚拟滚动 + 嵌入托管 + schema 扩展 |
| `@main-ui/view-flow` | — | **0.5.0** | 新模板 |
| `@main-ui/view-tree` | 0.3.0 | 0.3.0 | 改消费 core 虚拟滚动基座（无 API 变更） |
| `@main-ui/view-table` | 0.3.0 | 0.3.0 | 改消费 core 虚拟滚动基座（无 API 变更） |
| `@main-ui/view-console` | 0.4.0 | 0.4.0 | 改消费 core 虚拟滚动基座（无 API 变更） |
| `@main-ui/view-node` | 0.4.0 | 0.4.0 | 新增 `NodeCanvas` 导出（既有 `NodeView` 无变更） |
| `@main-ui/preset-views` | 0.4.0 | **0.5.0** | 新增 `flow` 命名空间 |

## 变更详情

### 1. `@main-ui/core` 新增导出

```ts
// 虚拟滚动基座
import { computeVirtualWindow, isNearBottom, type VirtualWindow } from '@main-ui/core';

// 嵌入视图托管件（v0.6 view-sandbox 前置件）
import {
  createEmbeddedViewHost,
  checkNestingDepth,
  DEFAULT_MAX_NESTING_DEPTH,
  type EmbeddedViewDescriptor,
  type EmbeddedViewHostContract,
  type NestingCheckResult,
} from '@main-ui/core';

// schema 扩展
import {
  evaluateVisibility,
  validateArrayField,
  type FormArrayField,
  type FormFieldWithVisibility,
  type VisibleWhen,
} from '@main-ui/core';
```

### 2. `@main-ui/view-flow` 新模板接入

```ts
import { registerFlowViewEditor } from '@main-ui/view-flow';

registerFlowViewEditor(runtime, {
  allowedWorkspaceIds: ['my-workspace'],
  title: 'Flow Editor',
}, (context) => ({
  document: context.editor.payload?.document as FlowDocument,
  // ...
}), (context) => ({
  onNodeMoveIntent: (payload) => { /* 宿主裁决 */ },
  onConnectIntent: (payload) => { /* 宿主裁决 */ },
}));
```

### 3. `@main-ui/view-node` 新增 `NodeCanvas` 导出

```ts
// L1 可嵌入组件（可被复合 View 嵌入，不可挂 Slot）
import { NodeCanvas } from '@main-ui/view-node';

// L3 薄壳（挂 Slot 的标准用法不变）
import { NodeView, registerNodeViewEditor } from '@main-ui/view-node';
```

### 4. 虚拟滚动基座消费方式（模板内部变更）

view-tree / view-table / view-console 内部改为消费 `@main-ui/core` 的 `computeVirtualWindow`，但**对外 API 无变更**：

- `view-tree`：`computeVirtualWindow` 从 `./tree` 重导出（底层委托 core）
- `view-table`：`computeTableRowWindow` 内部委托 core
- `view-console`：`computeConsoleRowWindow` / `isAtBottom` 内部委托 core

### 5. 新增 peerDependency

以下包新增 `@main-ui/core` 作为 peerDependency（版本 `^0.5.0`）：

- `@main-ui/view-tree`
- `@main-ui/view-table`
- `@main-ui/view-console`
- `@main-ui/view-flow`

安装时无需手动操作（pnpm workspace 自动解析）；独立安装时请确保 `@main-ui/core >= 0.5.0`。

## 不变更

- `main-ui` 主包版本、导出面、API 不变
- 持久化格式（WorkbenchDocument v3）不变
- 既有模板包的 `registerXxxEditor` / Props / Emits / 视图状态契约不变
- 主题系统（`--mui-*` / `data-mui-theme`）不变

## 验证

```bash
pnpm typecheck   # 12 包全绿
pnpm test        # 168 项全绿
pnpm build       # 全量构建成功
# 网络扫描零命中
grep -rE "fetch\(|axios|XMLHttpRequest|WebSocket" packages/*/src  # 零结果
```
