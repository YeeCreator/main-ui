# @main-ui/preset-views

main-ui 一期官方视图模板**聚合包**（仅重导出，不含任何逻辑）：

| 命名空间 | 来源包 | 能力 |
| --- | --- | --- |
| `tree` | `@main-ui/view-tree` | 自研虚拟滚动树（过滤/展开/选中） |
| `inspector` | `@main-ui/view-inspector` | schema 驱动属性表单（string/number/boolean/select） |
| `view2d` | `@main-ui/view-2d` | 2D 画布（2d-kit pixi 封装，相机进视图状态） |
| `table` | `@main-ui/view-table` | 自研虚拟滚动表格（排序/选中/单元格编辑意图） |

## 安装

```bash
pnpm add @main-ui/preset-views @main-ui/view-tree @main-ui/view-inspector @main-ui/view-2d @main-ui/view-table main-ui vue
# view-2d 还需：@main-ui/viewport-2d-kit pixi.js
```

> peerDependencies 只声明版本约束，不自动传递安装（npm 7+ / pnpm 视配置而定）；建议显式安装四个模板包。

## 用法

```ts
import { tree, inspector, view2d, table } from '@main-ui/preset-views';

tree.registerTreeViewEditor(runtime, { allowedWorkspaceIds: ['demo'] });
inspector.registerInspectorViewEditor(runtime, { allowedWorkspaceIds: ['demo'] });
view2d.registerView2dEditor(runtime, { allowedWorkspaceIds: ['demo'] });
table.registerTableViewEditor(runtime, { allowedWorkspaceIds: ['demo'] });
```

各模板的 Props / Emits / 视图状态契约与宿主适配层职责，见各模板包（`packages/view-*`）的 README。
