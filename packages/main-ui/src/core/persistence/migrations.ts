import type { WorkbenchDocument, WorkspaceState } from '../workspace/types';

/**
 * 快照迁移链。
 *
 * ## 版本历史
 *
 * | 版本 | 变化 | 迁移动作 |
 * | --- | --- | --- |
 * | v1 | 初版 | — |
 * | v2 | 主题 / 模块字段 | 补默认值 |
 * | v3 | 浮动窗口子树 | `floatingWindows` 缺省空集 |
 * | v4 | 宿主 `meta` + 微件配置 `auxiliary` | 两者均**全可选**，无需补值 |
 *
 * ## 为什么 v4 不需要真迁移
 *
 * v4 新增的两个字段都是**可选**的：`meta` 缺省即「宿主没有元数据」，
 * `auxiliary` 缺省即「微件全用默认显隐」。因此迁移只是「把 version 标为 4」，
 * 数据结构原样保留 —— 这比补一堆空对象更安全（补了反而会让「宿主从未设置过」
 * 与「宿主显式设为空」变得无法区分）。
 *
 * 前置版本（v1/v2）经同一条链升到现在：`migrateWorkspace` 负责补齐 workspace
 * 级字段，其余字段按 `??` 兜底。
 */

const migrateWorkspace = (workspace: Partial<WorkspaceState>): WorkspaceState => ({
  workspaceId: workspace.workspaceId ?? 'workspace-demo',
  layout: workspace.layout!,
  floatingWindows: workspace.floatingWindows ?? {},
  editors: workspace.editors ?? {},
  tabs: workspace.tabs ?? {},
  overlays: workspace.overlays ?? {},
  recentlyClosed: workspace.recentlyClosed ?? [],
  focusHistory: workspace.focusHistory ?? [],
  dirtyFromPreset: workspace.dirtyFromPreset ?? false,
  updatedAt: workspace.updatedAt ?? new Date(0).toISOString(),
  tabHistory: workspace.tabHistory ?? [],
  chrome: workspace.chrome ?? {
    sidebarVisible: true,
    sidebarWidth: 240,
    bottomPanelVisible: false,
    bottomPanelHeight: 220,
  },
  // v4：微件配置全可选，缺省表示「未设置过」→ 交由消费方用默认显隐
  ...(workspace.auxiliary ? { auxiliary: workspace.auxiliary } : {}),
});

/** 当前快照版本。写在这里而不是散在各处，避免升级时漏改。 */
export const CURRENT_SNAPSHOT_VERSION = 4 as const;

export const migrateWorkbenchDocument = (input: unknown): WorkbenchDocument | null => {
  if (!input || typeof input !== 'object') return null;
  const source = input as Partial<WorkbenchDocument> & { version?: number };
  if (!source.workspaceStates || !source.activeWorkspaceId) return null;
  const entries = Object.entries(source.workspaceStates);
  if (entries.some(([, workspace]) => !workspace?.layout)) return null;
  const workspaceStates = Object.fromEntries(entries.map(([id, workspace]) => [id, migrateWorkspace({ ...workspace, workspaceId: workspace.workspaceId ?? id })]));
  const activeWorkspaceId = workspaceStates[source.activeWorkspaceId] ? source.activeWorkspaceId : Object.keys(workspaceStates)[0];
  if (!activeWorkspaceId) return null;
  const recentWorkspaces = source.recentWorkspaces?.filter((id) => Boolean(workspaceStates[id])) ?? [activeWorkspaceId];
  const recentEditors = source.recentEditors ?? Object.values(workspaceStates).flatMap((workspace) => Object.values(workspace.editors).map((editor) => ({ editorKind: editor.kind, restoreKey: editor.restoreKey, openedAt: editor.createdAt }))).slice(0, 30);
  return {
    version: CURRENT_SNAPSHOT_VERSION,
    activeWorkspaceId,
    workspaceStates,
    theme: source.theme ?? { mode: 'system', resolvedMode: 'light', themeId: 'main-ui-system' },
    settings: source.settings ?? { density: 'compact' },
    recentWorkspaces: recentWorkspaces.length > 0 ? recentWorkspaces : [activeWorkspaceId],
    recentEditors,
    // v4：宿主元数据原样透传（内核不解释其内容）
    ...(source.meta ? { meta: source.meta } : {}),
  };
};
