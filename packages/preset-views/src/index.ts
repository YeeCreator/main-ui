/**
 * @main-ui/preset-views —— 官方视图模板聚合包（仅重导出，不含任何逻辑）。
 * 数据：tree / inspector / table / form / node / console；画布：world / sandbox / flow / host-engine。
 *
 * 命名空间重导出避免模板间的共享类型名冲突：
 *
 * ```ts
 * import { tree, inspector, world, table, form, node, console as consoleView, flow, sandbox } from '@main-ui/preset-views';
 * ```
 */
export * as tree from '@main-ui/view-tree';
export * as inspector from '@main-ui/view-inspector';
export * as world from '@main-ui/view-world';
export * as table from '@main-ui/view-table';
export * as form from '@main-ui/view-form';
export * as node from '@main-ui/view-node';
export * as consoleView from '@main-ui/view-console';
export * as flow from '@main-ui/view-flow';
export * as sandbox from '@main-ui/view-sandbox';
export * as hostEngine from '@main-ui/view-host-engine';
