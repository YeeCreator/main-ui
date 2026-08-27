/**
 * @main-ui/preset-views —— 官方视图模板聚合包（仅重导出，不含任何逻辑）。
 * 一期：tree / inspector / 2d / table；二期：form / node / console；v0.5：flow。
 *
 * 命名空间重导出避免模板间的共享类型名冲突：
 *
 * ```ts
 * import { tree, inspector, view2d, table, form, node, console as consoleView, flow } from '@main-ui/preset-views';
 * ```
 */
export * as tree from '@main-ui/view-tree';
export * as inspector from '@main-ui/view-inspector';
export * as view2d from '@main-ui/view-2d';
export * as table from '@main-ui/view-table';
export * as form from '@main-ui/view-form';
export * as node from '@main-ui/view-node';
export * as consoleView from '@main-ui/view-console';
export * as flow from '@main-ui/view-flow';
