import type { EditorKind, WorkspaceId } from '../types';
import type { EditorInstance, EditorOpenRequest, FocusEntry, RecentlyClosedEntry, TabInstance } from '../editor/types';
import type { LayoutDocument } from '../layout/types';
import type { OverlaySession } from '../overlay/types';
import type { ThemeState, WorkbenchSettings } from '../theme/types';

export type WorkspaceCreateContext = {
  workspaceId: WorkspaceId;
};

export type WorkspaceState = {
  workspaceId: WorkspaceId;
  layout: LayoutDocument;
  editors: Record<string, EditorInstance>;
  tabs: Record<string, TabInstance>;
  overlays: Record<string, OverlaySession>;
  recentlyClosed: RecentlyClosedEntry[];
  focusHistory: FocusEntry[];
  dirtyFromPreset: boolean;
  updatedAt: string;
};

export type WorkspaceDescriptor = {
  id: WorkspaceId;
  title: string;
  description?: string;
  icon?: string;
  allowedEditorKinds: EditorKind[];
  recommendedEditorKinds: EditorKind[];
  defaultOpenRequests: EditorOpenRequest[];
  createDefaultLayout: (context: WorkspaceCreateContext) => LayoutDocument;
  allowUserReset: boolean;
};

export type WorkbenchDocument = {
  version: 1;
  activeWorkspaceId: WorkspaceId;
  workspaceStates: Record<WorkspaceId, WorkspaceState>;
  theme: ThemeState;
  settings: WorkbenchSettings;
};
