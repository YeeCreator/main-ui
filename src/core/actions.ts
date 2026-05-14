import type { EditorOpenRequest } from './editor/types';
import type { GroupId, LayoutNodeId, OverlayDismissReason, OverlaySessionId, SplitDirection, ThemeId, WorkspaceId } from './types';

export type WorkbenchAction = LayoutAction | EditorAction | OverlayAction | WorkspaceAction | ThemeAction;

export type LayoutAction =
  | { type: 'layout/splitLeaf'; leafNodeId: LayoutNodeId; direction: SplitDirection; ratio?: number }
  | { type: 'layout/resizeSplit'; splitNodeId: LayoutNodeId; weights: number[] }
  | { type: 'layout/closeLeaf'; leafNodeId: LayoutNodeId }
  | { type: 'layout/toggleMaximize'; nodeId: LayoutNodeId }
  | { type: 'layout/setActiveGroup'; groupId: GroupId }
  | { type: 'layout/resetWorkspace'; workspaceId: WorkspaceId };

export type EditorAction =
  | { type: 'editor/open'; request: EditorOpenRequest }
  | { type: 'editor/closeTab'; groupId: GroupId; tabId: string }
  | { type: 'editor/activateTab'; groupId: GroupId; tabId: string }
  | { type: 'editor/reopenRecentlyClosed'; targetGroupId?: GroupId }
  | { type: 'editor/moveTabToGroup'; fromGroupId: GroupId; toGroupId: GroupId; tabId: string; index?: number }
  | { type: 'editor/moveTabToNewSplit'; fromGroupId: GroupId; targetLeafNodeId: LayoutNodeId; tabId: string; direction: SplitDirection }
  | { type: 'editor/duplicateInstance'; groupId: GroupId; tabId: string; payloadOverride?: Record<string, unknown> };

export type OverlayAction =
  | { type: 'overlay/open'; request: EditorOpenRequest }
  | { type: 'overlay/dismiss'; overlayId: OverlaySessionId; reason: OverlayDismissReason }
  | { type: 'overlay/promoteToTab'; overlayId: OverlaySessionId; targetGroupId?: GroupId };

export type WorkspaceAction =
  | { type: 'workspace/switch'; workspaceId: WorkspaceId }
  | { type: 'workspace/registerDefaults' };

export type ThemeAction =
  | { type: 'theme/setMode'; mode: 'light' | 'dark' | 'system'; resolvedMode?: 'light' | 'dark'; themeId?: ThemeId };
