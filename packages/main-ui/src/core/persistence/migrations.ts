import type { WorkbenchDocument, WorkspaceState } from '../workspace/types';

const migrateWorkspace = (workspace: Partial<WorkspaceState>): WorkspaceState => ({
  workspaceId: workspace.workspaceId ?? 'workspace-demo',
  layout: workspace.layout!,
  editors: workspace.editors ?? {}, tabs: workspace.tabs ?? {}, overlays: workspace.overlays ?? {},
  recentlyClosed: workspace.recentlyClosed ?? [], focusHistory: workspace.focusHistory ?? [],
  dirtyFromPreset: workspace.dirtyFromPreset ?? false, updatedAt: workspace.updatedAt ?? new Date(0).toISOString(),
  tabHistory: workspace.tabHistory ?? [], chrome: workspace.chrome ?? { sidebarVisible: true, sidebarWidth: 240, bottomPanelVisible: false, bottomPanelHeight: 220 },
});

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
  return { version: 2, activeWorkspaceId, workspaceStates, theme: source.theme ?? { mode: 'system', resolvedMode: 'light', themeId: 'main-ui-system' }, settings: source.settings ?? { density: 'compact' }, recentWorkspaces: recentWorkspaces.length > 0 ? recentWorkspaces : [activeWorkspaceId], recentEditors };
};
