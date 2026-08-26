import type { EditorInstanceId, EditorKind, GroupId, IconToken, JsonObject, TabId, WorkspaceId } from '../types';

export type EditorCreateContext = {
  workspaceId: WorkspaceId;
  payload?: JsonObject;
};

export type EditorRenderContext = {
  editor: EditorInstance;
  tab?: TabInstance;
  workspaceId: WorkspaceId;
};

export type EditorOpenRequest = {
  editorKind: EditorKind;
  payload?: JsonObject;
  title?: string;
  targetGroupId?: GroupId;
  restoreKey?: string;
  surface?: 'tab' | 'modal-overlay';
};

export type EditorCapabilityPolicy = {
  allowCreate: boolean;
  allowDuplicate: boolean;
  allowMultipleInstances: boolean;
  allowMultipleSurfacesPerInstance: boolean;
  allowClose: boolean;
  allowReorderInGroup: boolean;
  allowMoveAcrossGroups: boolean;
  allowSplitDrop: boolean;
  allowPopoutWindow: boolean;
  allowFloatingWindow: boolean;
  allowModalOverlay: boolean;
  allowMirrorDisplay: boolean;
  launcherVisibility: 'visible' | 'hidden' | 'hidden-when-opened';
};

export type EditorPresentationPolicy = {
  defaultSurface: 'tab' | 'modal-overlay';
  modalVariant?: 'centered-modal' | 'anchored-popover';
  modalWidth?: number;
  modalHeight?: number;
  canPromoteModalToTab: boolean;
};

export type EditorAvailabilityPolicy = {
  allowedWorkspaceIds: WorkspaceId[];
};

export type EditorDescriptor = {
  kind: EditorKind;
  title: string;
  description?: string;
  icon?: IconToken;
  module?: string;
  rendererKey: string;
  createDefaultPayload?: (context: EditorCreateContext) => JsonObject;
  capability: EditorCapabilityPolicy;
  presentation: EditorPresentationPolicy;
  availability: EditorAvailabilityPolicy;
};

export type EditorInstance = {
  id: EditorInstanceId;
  kind: EditorKind;
  payload: JsonObject;
  restoreKey?: string;
  createdAt: string;
  updatedAt: string;
};

export type TabInstance = {
  id: TabId;
  editorInstanceId: EditorInstanceId;
  title: string;
  icon?: IconToken;
  closable: boolean;
  pinned?: boolean;
  preview?: boolean;
  dirty?: boolean;
};

export type RecentlyClosedEntry = {
  tab: TabInstance;
  editor: EditorInstance;
  closedAt: string;
};

export type FocusEntry = {
  groupId: GroupId;
  tabId?: TabId;
  focusedAt: string;
};

export const defaultEditorCapability: EditorCapabilityPolicy = {
  allowCreate: true,
  allowDuplicate: true,
  allowMultipleInstances: true,
  allowMultipleSurfacesPerInstance: false,
  allowClose: true,
  allowReorderInGroup: true,
  allowMoveAcrossGroups: true,
  allowSplitDrop: true,
  allowPopoutWindow: false,
  allowFloatingWindow: false,
  allowModalOverlay: true,
  allowMirrorDisplay: false,
  launcherVisibility: 'visible',
};

export const defaultTabPresentation: EditorPresentationPolicy = {
  defaultSurface: 'tab',
  canPromoteModalToTab: false,
};

export const defaultModalPresentation: EditorPresentationPolicy = {
  defaultSurface: 'modal-overlay',
  modalVariant: 'centered-modal',
  canPromoteModalToTab: true,
};
