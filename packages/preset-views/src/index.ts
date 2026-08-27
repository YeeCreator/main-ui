/**
 * @main-ui/preset-views —— 一期官方视图模板聚合包（仅重导出，不含任何逻辑）。
 *
 * 命名空间重导出避免四模板间的共享类型名（如 EditorRenderContextLike）冲突：
 *
 * ```ts
 * import { tree, inspector, view2d, table } from '@main-ui/preset-views';
 * tree.registerTreeViewEditor(runtime, { allowedWorkspaceIds: ['demo'] });
 * ```
 *
 * 也可以按包名单独安装（@main-ui/view-tree 等），聚合包只是便利入口。
 */
export * as tree from '@main-ui/view-tree';
export * as inspector from '@main-ui/view-inspector';
export * as view2d from '@main-ui/view-2d';
export * as table from '@main-ui/view-table';
