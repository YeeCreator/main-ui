import type { WorkbenchAction } from './actions';
import type { EditorDescriptor, EditorInstance, EditorOpenRequest, TabInstance } from './editor/types';
import { closeLeaf, getFirstGroupId, getLeafNodeByGroupId, resizeSplit, setActiveGroup, splitLeaf, toggleMaximize } from './layout/operations';
import type { OverlaySession } from './overlay/types';
import type { Clock, EditorInstanceId, GroupId, IdFactory, JsonObject, Result, TabId } from './types';
import { fail, ok } from './types';
import { createWorkspaceState } from './documentFactory';
import type { WorkbenchDocument, WorkspaceDescriptor, WorkspaceState } from './workspace/types';

export type ReducerContext = {
  editors: Map<string, EditorDescriptor>;
  workspaces: Map<string, WorkspaceDescriptor>;
  createId: IdFactory;
  now: Clock;
};

const cloneDocument = (document: WorkbenchDocument): WorkbenchDocument => structuredClone(document);

const activeWorkspace = (document: WorkbenchDocument): WorkspaceState => document.workspaceStates[document.activeWorkspaceId];

const touchWorkspace = (workspace: WorkspaceState, now: Clock): void => {
  workspace.updatedAt = now();
};

const getDescriptorForRequest = (request: EditorOpenRequest, context: ReducerContext): Result<EditorDescriptor> => {
  const descriptor = context.editors.get(request.editorKind);
  if (!descriptor) {
    return fail('editor.descriptorNotFound', `Editor ${request.editorKind} is not registered.`);
  }
  return ok(descriptor);
};

const findExistingInstanceTab = (workspace: WorkspaceState, kind: string): { editor: EditorInstance; tab: TabInstance; groupId: GroupId } | null => {
  for (const editor of Object.values(workspace.editors)) {
    if (editor.kind !== kind) {
      continue;
    }

    const tab = Object.values(workspace.tabs).find((candidate) => candidate.editorInstanceId === editor.id);
    if (!tab) {
      continue;
    }

    const group = Object.values(workspace.layout.groups).find((candidate) => candidate.tabIds.includes(tab.id));
    if (group) {
      return { editor, tab, groupId: group.id };
    }
  }

  return null;
};

const activateTabInGroup = (workspace: WorkspaceState, groupId: GroupId, tabId: TabId, now: Clock): Result<void> => {
  const group = workspace.layout.groups[groupId];
  if (!group || !group.tabIds.includes(tabId)) {
    return fail('editor.tabNotInGroup', `Tab ${tabId} is not in group ${groupId}.`);
  }

  group.activeTabId = tabId;
  group.lastActiveTabId = tabId;
  workspace.layout.activeGroupId = groupId;
  workspace.focusHistory.push({ groupId, tabId, focusedAt: now() });
  if (tabId) workspace.tabHistory = [tabId, ...(workspace.tabHistory ?? []).filter((id) => id !== tabId)].slice(0, 50);
  return ok(undefined);
};

const openEditor = (document: WorkbenchDocument, request: EditorOpenRequest, context: ReducerContext): Result<WorkbenchDocument> => {
  const descriptorResult = getDescriptorForRequest(request, context);
  if (!descriptorResult.ok) {
    return descriptorResult;
  }

  const descriptor = descriptorResult.value;
  const next = cloneDocument(document);
  const workspace = activeWorkspace(next);
  const workspaceDescriptor = context.workspaces.get(workspace.workspaceId);
  if (!workspaceDescriptor) {
    return fail('workspace.descriptorNotFound', `Workspace ${workspace.workspaceId} is not registered.`);
  }

  if (!workspaceDescriptor.allowedEditorKinds.includes(request.editorKind)) {
    return fail('editor.notAllowedInWorkspace', `Editor ${request.editorKind} is not allowed in workspace ${workspace.workspaceId}.`);
  }

  if (!descriptor.capability.allowCreate) {
    return fail('editor.createDisabled', `Editor ${request.editorKind} cannot be created.`);
  }

  const existing = findExistingInstanceTab(workspace, request.editorKind);
  if (existing && !descriptor.capability.allowMultipleInstances) {
    const activated = activateTabInGroup(workspace, existing.groupId, existing.tab.id, context.now);
    if (!activated.ok) {
      return activated as Result<WorkbenchDocument>;
    }
    touchWorkspace(workspace, context.now);
    return ok(next);
  }

  const payload = request.payload ?? descriptor.createDefaultPayload?.({ workspaceId: workspace.workspaceId, payload: request.payload }) ?? {};
  const editorId = context.createId('editor');
  const editor: EditorInstance = {
    id: editorId,
    kind: request.editorKind,
    payload,
    restoreKey: request.restoreKey,
    createdAt: context.now(),
    updatedAt: context.now(),
  };
  workspace.editors[editorId] = editor;

  const preferredSurface = request.surface ?? descriptor.presentation.defaultSurface;
  if (preferredSurface === 'modal-overlay') {
    if (!descriptor.capability.allowModalOverlay) {
      return fail('overlay.notAllowed', `Editor ${request.editorKind} cannot open as overlay.`);
    }

    const overlayId = context.createId('overlay');
    workspace.overlays[overlayId] = {
      id: overlayId,
      editorInstanceId: editorId,
      presentation: descriptor.presentation.modalVariant ?? 'centered-modal',
      dismissOnOutsidePointerDown: true,
      dismissOnEscape: true,
      showBackdrop: true,
      canPromoteToTab: descriptor.presentation.canPromoteModalToTab,
      width: descriptor.presentation.modalWidth ?? 640,
      height: descriptor.presentation.modalHeight ?? 420,
    } satisfies OverlaySession;
    touchWorkspace(workspace, context.now);
    return ok(next);
  }

  const targetGroupId = request.targetGroupId ?? workspace.layout.activeGroupId ?? getFirstGroupId(workspace.layout);
  if (!targetGroupId || !workspace.layout.groups[targetGroupId]) {
    return fail('layout.noTargetGroup', 'No target group is available for opening editor.');
  }

  const tabId = context.createId('tab');
  workspace.tabs[tabId] = {
    id: tabId,
    editorInstanceId: editorId,
    title: request.title ?? descriptor.title,
    icon: descriptor.icon,
    closable: descriptor.capability.allowClose,
  };
  const group = workspace.layout.groups[targetGroupId];
  group.tabIds.push(tabId);
  const activated = activateTabInGroup(workspace, targetGroupId, tabId, context.now);
  if (!activated.ok) {
    return activated as Result<WorkbenchDocument>;
  }
  touchWorkspace(workspace, context.now);
  return ok(next);
};

const removeEditorIfUnused = (workspace: WorkspaceState, editorInstanceId: EditorInstanceId): void => {
  const isUsedByTab = Object.values(workspace.tabs).some((tab) => tab.editorInstanceId === editorInstanceId);
  const isUsedByOverlay = Object.values(workspace.overlays).some((overlay) => overlay.editorInstanceId === editorInstanceId);
  if (!isUsedByTab && !isUsedByOverlay) {
    delete workspace.editors[editorInstanceId];
  }
};

const closeTab = (document: WorkbenchDocument, groupId: GroupId, tabId: TabId, context: ReducerContext): Result<WorkbenchDocument> => {
  const next = cloneDocument(document);
  const workspace = activeWorkspace(next);
  const group = workspace.layout.groups[groupId];
  const tab = workspace.tabs[tabId];
  if (!group || !tab || !group.tabIds.includes(tabId)) {
    return fail('editor.tabNotFound', `Tab ${tabId} was not found in group ${groupId}.`);
  }

  const editor = workspace.editors[tab.editorInstanceId];
  const descriptor = editor ? context.editors.get(editor.kind) : undefined;
  if (descriptor && !descriptor.capability.allowClose) {
    return fail('editor.closeDisabled', `Editor ${editor.kind} cannot be closed.`);
  }

  group.tabIds = group.tabIds.filter((candidate) => candidate !== tabId);
  group.activeTabId = group.activeTabId === tabId ? group.tabIds.at(-1) ?? null : group.activeTabId;
  group.lastActiveTabId = group.activeTabId;
  delete workspace.tabs[tabId];

  if (editor) {
    workspace.recentlyClosed.unshift({ tab, editor, closedAt: context.now() });
    workspace.recentlyClosed = workspace.recentlyClosed.slice(0, 20);
    removeEditorIfUnused(workspace, editor.id);
  }

  touchWorkspace(workspace, context.now);
  return ok(next);
};

const reopenRecentlyClosed = (document: WorkbenchDocument, targetGroupId: GroupId | undefined, context: ReducerContext): Result<WorkbenchDocument> => {
  const next = cloneDocument(document);
  const workspace = activeWorkspace(next);
  const entry = workspace.recentlyClosed.shift();
  if (!entry) {
    return ok(next, ['No recently closed tab is available.']);
  }

  const editorId = context.createId('editor');
  const tabId = context.createId('tab');
  const target = targetGroupId ?? workspace.layout.activeGroupId ?? getFirstGroupId(workspace.layout);
  if (!target || !workspace.layout.groups[target]) {
    return fail('layout.noTargetGroup', 'No target group is available for reopening editor.');
  }

  workspace.editors[editorId] = {
    ...entry.editor,
    id: editorId,
    createdAt: context.now(),
    updatedAt: context.now(),
  };
  workspace.tabs[tabId] = {
    ...entry.tab,
    id: tabId,
    editorInstanceId: editorId,
  };
  workspace.layout.groups[target].tabIds.push(tabId);
  const activated = activateTabInGroup(workspace, target, tabId, context.now);
  if (!activated.ok) {
    return activated as Result<WorkbenchDocument>;
  }
  touchWorkspace(workspace, context.now);
  return ok(next);
};

const moveTabToGroup = (document: WorkbenchDocument, fromGroupId: GroupId, toGroupId: GroupId, tabId: TabId, index: number | undefined, context: ReducerContext): Result<WorkbenchDocument> => {
  const next = cloneDocument(document);
  const workspace = activeWorkspace(next);
  const fromGroup = workspace.layout.groups[fromGroupId];
  const toGroup = workspace.layout.groups[toGroupId];
  if (!fromGroup || !toGroup || !fromGroup.tabIds.includes(tabId)) {
    return fail('editor.moveTargetInvalid', 'The tab move target is invalid.');
  }

  fromGroup.tabIds = fromGroup.tabIds.filter((candidate) => candidate !== tabId);
  if (fromGroup.activeTabId === tabId) {
    fromGroup.activeTabId = fromGroup.tabIds.at(-1) ?? null;
  }
  const insertIndex = index ?? toGroup.tabIds.length;
  toGroup.tabIds.splice(insertIndex, 0, tabId);
  const activated = activateTabInGroup(workspace, toGroupId, tabId, context.now);
  if (!activated.ok) {
    return activated as Result<WorkbenchDocument>;
  }
  touchWorkspace(workspace, context.now);
  return ok(next);
};

const dismissOverlay = (document: WorkbenchDocument, overlayId: string, context: ReducerContext): Result<WorkbenchDocument> => {
  const next = cloneDocument(document);
  const workspace = activeWorkspace(next);
  const overlay = workspace.overlays[overlayId];
  if (!overlay) {
    return fail('overlay.notFound', `Overlay ${overlayId} was not found.`);
  }

  delete workspace.overlays[overlayId];
  removeEditorIfUnused(workspace, overlay.editorInstanceId);
  touchWorkspace(workspace, context.now);
  return ok(next);
};

const promoteOverlayToTab = (document: WorkbenchDocument, overlayId: string, targetGroupId: GroupId | undefined, context: ReducerContext): Result<WorkbenchDocument> => {
  const next = cloneDocument(document);
  const workspace = activeWorkspace(next);
  const overlay = workspace.overlays[overlayId];
  if (!overlay) {
    return fail('overlay.notFound', `Overlay ${overlayId} was not found.`);
  }
  if (!overlay.canPromoteToTab) {
    return fail('overlay.promoteDisabled', `Overlay ${overlayId} cannot be promoted to tab.`);
  }

  const editor = workspace.editors[overlay.editorInstanceId];
  const descriptor = editor ? context.editors.get(editor.kind) : undefined;
  if (!editor || !descriptor) {
    return fail('editor.descriptorNotFound', 'Overlay editor descriptor was not found.');
  }

  const target = targetGroupId ?? workspace.layout.activeGroupId ?? getFirstGroupId(workspace.layout);
  if (!target || !workspace.layout.groups[target]) {
    return fail('layout.noTargetGroup', 'No target group is available for promoting overlay.');
  }

  const tabId = context.createId('tab');
  workspace.tabs[tabId] = {
    id: tabId,
    editorInstanceId: editor.id,
    title: descriptor.title,
    icon: descriptor.icon,
    closable: descriptor.capability.allowClose,
  };
  workspace.layout.groups[target].tabIds.push(tabId);
  delete workspace.overlays[overlayId];
  const activated = activateTabInGroup(workspace, target, tabId, context.now);
  if (!activated.ok) {
    return activated as Result<WorkbenchDocument>;
  }
  touchWorkspace(workspace, context.now);
  return ok(next);
};

export const workbenchReducer = (document: WorkbenchDocument, action: WorkbenchAction, context: ReducerContext): Result<WorkbenchDocument> => {
  if (action.type === 'workspace/switch') {
    if (!document.workspaceStates[action.workspaceId]) {
      return fail('workspace.notFound', `Workspace ${action.workspaceId} was not found.`);
    }
    const next = cloneDocument(document);
    next.activeWorkspaceId = action.workspaceId;
    next.recentWorkspaces = [action.workspaceId, ...next.recentWorkspaces.filter((id) => id !== action.workspaceId)].slice(0, 20);
    return ok(next);
  }

  if (action.type === 'layout/resetWorkspace') {
    const descriptor = context.workspaces.get(action.workspaceId);
    if (!descriptor) {
      return fail('workspace.descriptorNotFound', `Workspace ${action.workspaceId} is not registered.`);
    }
    const next = cloneDocument(document);
    next.workspaceStates[action.workspaceId] = createWorkspaceState({
      descriptor,
      editorDescriptors: context.editors,
      createId: context.createId,
      now: context.now,
    });
    return ok(next);
  }

  if (action.type === 'layout/setChromeState') {
    const next = cloneDocument(document);
    const target = next.workspaceStates[action.workspaceId];
    if (!target) return fail('workspace.notFound', `Workspace ${action.workspaceId} was not found.`);
    target.chrome = { ...target.chrome, ...action.patch };
    touchWorkspace(target, context.now);
    return ok(next);
  }

  if (action.type === 'editor/open' || action.type === 'overlay/open') {
    const request = action.type === 'overlay/open' ? { ...action.request, surface: 'modal-overlay' as const } : action.request;
    return openEditor(document, request, context);
  }

  const next = cloneDocument(document);
  const workspace = activeWorkspace(next);

  switch (action.type) {
    case 'layout/splitLeaf': {
      const result = splitLeaf(workspace.layout, action.leafNodeId, action.direction, action.ratio, context.createId);
      if (!result.ok) return result as Result<WorkbenchDocument>;
      workspace.layout = result.value;
      touchWorkspace(workspace, context.now);
      return ok(next);
    }
    case 'layout/resizeSplit': {
      const result = resizeSplit(workspace.layout, action.splitNodeId, action.weights);
      if (!result.ok) return result as Result<WorkbenchDocument>;
      workspace.layout = result.value;
      touchWorkspace(workspace, context.now);
      return ok(next);
    }
    case 'layout/closeLeaf': {
      const sourceNode = workspace.layout.nodes[action.leafNodeId];
      const sourceGroupId = sourceNode?.type === 'leaf' ? sourceNode.groupId : undefined;
      const sourceGroup = sourceGroupId ? workspace.layout.groups[sourceGroupId] : undefined;
      const orphanTabIds = sourceGroup ? [...sourceGroup.tabIds] : [];
      const result = closeLeaf(workspace.layout, action.leafNodeId);
      if (!result.ok) return result as Result<WorkbenchDocument>;
      workspace.layout = result.value;
      for (const tabId of orphanTabIds) {
        const tab = workspace.tabs[tabId];
        if (tab) {
          const editor = workspace.editors[tab.editorInstanceId];
          if (editor) workspace.recentlyClosed.unshift({ tab, editor, closedAt: context.now() });
          delete workspace.tabs[tabId];
          workspace.tabHistory = (workspace.tabHistory ?? []).filter((id) => id !== tabId);
          if (editor) removeEditorIfUnused(workspace, editor.id);
        }
      }
      workspace.recentlyClosed = workspace.recentlyClosed.slice(0, 20);
      touchWorkspace(workspace, context.now);
      return ok(next);
    }
    case 'layout/toggleMaximize': {
      const result = toggleMaximize(workspace.layout, action.nodeId);
      if (!result.ok) return result as Result<WorkbenchDocument>;
      workspace.layout = result.value;
      touchWorkspace(workspace, context.now);
      return ok(next);
    }
    case 'layout/setActiveGroup': {
      const result = setActiveGroup(workspace.layout, action.groupId);
      if (!result.ok) return result as Result<WorkbenchDocument>;
      workspace.layout = result.value;
      touchWorkspace(workspace, context.now);
      return ok(next);
    }
    case 'editor/activateTab': {
      const result = activateTabInGroup(workspace, action.groupId, action.tabId, context.now);
      if (!result.ok) return result as Result<WorkbenchDocument>;
      touchWorkspace(workspace, context.now);
      return ok(next);
    }
    case 'editor/setTabState': {
      const tab = workspace.tabs[action.tabId];
      if (!tab || !workspace.layout.groups[action.groupId]?.tabIds.includes(action.tabId)) return fail('editor.tabNotFound', `Tab ${action.tabId} was not found.`);
      if (action.pinned !== undefined) tab.pinned = action.pinned;
      if (action.preview !== undefined) tab.preview = action.preview;
      if (action.dirty !== undefined) tab.dirty = action.dirty;
      touchWorkspace(workspace, context.now);
      return ok(next);
    }
    case 'editor/reorderTab': {
      const group = workspace.layout.groups[action.groupId];
      if (!group || !group.tabIds.includes(action.tabId)) return fail('editor.tabNotFound', `Tab ${action.tabId} was not found.`);
      group.tabIds = group.tabIds.filter((id) => id !== action.tabId);
      group.tabIds.splice(Math.max(0, Math.min(action.index, group.tabIds.length)), 0, action.tabId);
      touchWorkspace(workspace, context.now);
      return ok(next);
    }
    case 'editor/closeTab':
      return closeTab(document, action.groupId, action.tabId, context);
    case 'editor/reopenRecentlyClosed':
      return reopenRecentlyClosed(document, action.targetGroupId, context);
    case 'editor/moveTabToGroup':
      return moveTabToGroup(document, action.fromGroupId, action.toGroupId, action.tabId, action.index, context);
    case 'editor/moveTabToNewSplit': {
      const leaf = getLeafNodeByGroupId(workspace.layout, action.fromGroupId);
      if (!leaf) return fail('layout.leafNotFound', `Leaf for group ${action.fromGroupId} was not found.`);
      const splitResult = splitLeaf(workspace.layout, action.targetLeafNodeId, action.direction, 0.5, context.createId);
      if (!splitResult.ok) return splitResult as Result<WorkbenchDocument>;
      workspace.layout = splitResult.value;
      const toGroupId = workspace.layout.activeGroupId;
      if (!toGroupId) return fail('layout.noTargetGroup', 'No new split group was created.');
      return moveTabToGroup(next, action.fromGroupId, toGroupId, action.tabId, undefined, context);
    }
    case 'editor/duplicateInstance': {
      const tab = workspace.tabs[action.tabId];
      const editor = tab ? workspace.editors[tab.editorInstanceId] : undefined;
      if (!editor) return fail('editor.instanceNotFound', `Editor for tab ${action.tabId} was not found.`);
      const payload = (action.payloadOverride as JsonObject | undefined) ?? editor.payload;
      return openEditor(document, { editorKind: editor.kind, payload, title: tab.title, targetGroupId: action.groupId }, context);
    }
    case 'overlay/dismiss':
      return dismissOverlay(document, action.overlayId, context);
    case 'overlay/promoteToTab':
      return promoteOverlayToTab(document, action.overlayId, action.targetGroupId, context);
    case 'theme/setMode': {
      const resolvedMode = action.resolvedMode ?? (action.mode === 'dark' ? 'dark' : 'light');
      next.theme = {
        mode: action.mode,
        resolvedMode,
        themeId: action.themeId ?? `main-ui-${action.mode}`,
      };
      return ok(next);
    }
    case 'workspace/registerDefaults':
      return ok(next);
    default:
      return ok(next);
  }
};
