# @main-ui/preset-views

main-ui 官方视图模板**聚合包**（一期 + 二期，仅命名空间重导出，不含任何逻辑）。统一指南见 `main-ui` 包 `docs/PRESET_VIEWS_GUIDE.md`（`node_modules/main-ui/docs/PRESET_VIEWS_GUIDE.md`）。

| 命名空间 | 来源包 | 能力 |
| --- | --- | --- |
| `tree` | `@main-ui/view-tree` | 自研虚拟滚动树（过滤/展开/选中） |
| `inspector` | `@main-ui/view-inspector` | schema 驱动属性表单（`@main-ui/core` 基座） |
| `view2d` | `@main-ui/view-2d` | 2D 画布（2d-kit pixi 封装，相机进视图状态） |
| `table` | `@main-ui/view-table` | 自研虚拟滚动表格（排序/选中/单元格编辑意图） |
| `form` | `@main-ui/view-form` | schema 配置面板（提交/预设存取以意图抛出，`@main-ui/core` 基座） |
| `node` | `@main-ui/view-node` | 节点图（`@vue-flow/core` 薄封装，视口/选中进视图状态） |
| `consoleView` | `@main-ui/view-console` | 日志/控制台追加列表（过滤/自动跟随/锁滚/清空意图） |

## 安装

```bash
pnpm add @main-ui/preset-views \
  @main-ui/view-tree @main-ui/view-inspector @main-ui/view-2d @main-ui/view-table \
  @main-ui/view-form @main-ui/view-node @main-ui/view-console \
  @main-ui/core main-ui vue
# view-2d 还需：@main-ui/viewport-2d-kit pixi.js
# view-node 还需：@vue-flow/core@^1.48
```

> peerDependencies 只声明版本约束，不自动传递安装；建议显式安装七个模板包。只装部分模板时，可直接安装对应 `@main-ui/view-*` 包，无需聚合包。

## 用法

```ts
import { tree, inspector, view2d, table, form, node, consoleView } from '@main-ui/preset-views';

tree.registerTreeViewEditor(runtime, { allowedWorkspaceIds: ['demo'] });
inspector.registerInspectorViewEditor(runtime, { allowedWorkspaceIds: ['demo'] });
view2d.registerView2dEditor(runtime, { allowedWorkspaceIds: ['demo'] });
table.registerTableViewEditor(runtime, { allowedWorkspaceIds: ['demo'] });
form.registerFormViewEditor(runtime, { allowedWorkspaceIds: ['demo'] });
node.registerNodeViewEditor(runtime, { allowedWorkspaceIds: ['demo'] });
consoleView.registerConsoleViewEditor(runtime, { allowedWorkspaceIds: ['demo'] });
```

注册后需把模板 kind（`view-tree` / `view-inspector` / `view-2d` / `view-table` / `view-form` / `view-node` / `view-console`）并入对应 `WorkspaceDescriptor.allowedEditorKinds`。

各模板的 Props / Emits / 视图状态契约与宿主适配层职责：统一见 `main-ui` 包 `docs/PRESET_VIEWS_GUIDE.md`，分包细节见各模板包（`packages/view-*`）的 README。
