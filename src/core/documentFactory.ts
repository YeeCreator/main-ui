import type { EditorDescriptor, EditorOpenRequest } from './editor/types';
import { createDefaultThemeState, createDefaultWorkbenchSettings } from './theme/types';
import type { Clock, IdFactory } from './types';
import type { WorkbenchDocument, WorkspaceDescriptor, WorkspaceState } from './workspace/types';

type CreateWorkspaceStateOptions = {
  descriptor: WorkspaceDescriptor;
  editorDescriptors: Map<string, EditorDescriptor>;
  createId: IdFactory;
  now: Clock;
};

export const createWorkspaceState = ({ descriptor, editorDescriptors, createId, now }: CreateWorkspaceStateOptions): WorkspaceState => {
  const layout = descriptor.createDefaultLayout({ workspaceId: descriptor.id });
  const state: WorkspaceState = {
    workspaceId: descriptor.id,
    layout,
    editors: {},
    tabs: {},
    overlays: {},
    recentlyClosed: [],
    focusHistory: [],
    dirtyFromPreset: false,
    updatedAt: now(),
    tabHistory: [],
    chrome: { sidebarVisible: true, sidebarWidth: 240, bottomPanelVisible: false, bottomPanelHeight: 220 },
  };

  for (const request of descriptor.defaultOpenRequests) {
    openDefaultEditor(state, request, editorDescriptors, createId, now);
  }

  return state;
};

const openDefaultEditor = (
  state: WorkspaceState,
  request: EditorOpenRequest,
  editorDescriptors: Map<string, EditorDescriptor>,
  createId: IdFactory,
  now: Clock,
): void => {
  const descriptor = editorDescriptors.get(request.editorKind);
  if (!descriptor || !state.layout.activeGroupId) {
    return;
  }

  const targetGroupId = request.targetGroupId ?? state.layout.activeGroupId;
  const group = state.layout.groups[targetGroupId];
  if (!group) {
    return;
  }

  const editorId = createId('editor');
  const tabId = createId('tab');
  const payload = request.payload ?? descriptor.createDefaultPayload?.({ workspaceId: state.workspaceId, payload: request.payload }) ?? {};
  state.editors[editorId] = {
    id: editorId,
    kind: request.editorKind,
    payload,
    restoreKey: request.restoreKey,
    createdAt: now(),
    updatedAt: now(),
  };
  state.tabs[tabId] = {
    id: tabId,
    editorInstanceId: editorId,
    title: request.title ?? descriptor.title,
    icon: descriptor.icon,
    closable: descriptor.capability.allowClose,
  };
  group.tabIds.push(tabId);
  group.activeTabId = tabId;
  group.lastActiveTabId = tabId;
};

export const createWorkbenchDocument = (
  workspaceDescriptors: WorkspaceDescriptor[],
  editorDescriptors: EditorDescriptor[],
  activeWorkspaceId: string | undefined,
  createId: IdFactory,
  now: Clock,
): WorkbenchDocument => {
  const editorDescriptorMap = new Map(editorDescriptors.map((descriptor) => [descriptor.kind, descriptor]));
  const firstWorkspaceId = activeWorkspaceId ?? workspaceDescriptors[0]?.id ?? 'workspace-demo';
  const workspaceStates = Object.fromEntries(
    workspaceDescriptors.map((descriptor) => [
      descriptor.id,
      createWorkspaceState({ descriptor, editorDescriptors: editorDescriptorMap, createId, now }),
    ]),
  );

  return {
    version: 2,
    activeWorkspaceId: firstWorkspaceId,
    workspaceStates,
    theme: createDefaultThemeState(),
    settings: createDefaultWorkbenchSettings(),
    recentWorkspaces: [firstWorkspaceId],
    recentEditors: [],
  };
};
