/**
 * @main-ui/preset-views —— 官方视图模板聚合包（仅重导出，不含任何逻辑）。
 * 一期：tree / inspector / 2d / table；二期：form / node / console。
 *
 * 命名空间重导出避免模板间的共享类型名（如 EditorRenderContextLike）冲突：
 *
 * ```ts
 * import { tree, inspector, view2d, table, form, node, console as consoleView } from '@main-ui/preset-views';
 * tree.registerTreeViewEditor(runtime, { allowedWorkspaceIds: ['demo'] });
 * ```
 *
 * 也可以按包名单独安装（@main-ui/view-tree 等），聚合包只是便利入口。
 */
export * as tree from '@main-ui/view-tree';
export * as inspector from '@main-ui/view-inspector';
export * as view2d from '@main-ui/view-2d';
export * as table from '@main-ui/view-table';
export * as form from '@main-ui/view-form';
export * as node from '@main-ui/view-node';
export * as consoleView from '@main-ui/view-console';
