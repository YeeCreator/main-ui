import type { EditorOpenRequest } from './editor/types';
import type { FloatingWindowId, GroupId, LayoutNodeId, OverlayDismissReason, OverlaySessionId, SplitDirection, TabId, ThemeId, WorkspaceId } from './types';

export type WorkbenchAction = LayoutAction | EditorAction | TabStateAction | OverlayAction | FloatingWindowAction | WorkspaceAction | ThemeAction;

export type LayoutAction =
  | { type: 'layout/splitLeaf'; leafNodeId: LayoutNodeId; direction: SplitDirection; ratio?: number }
  | { type: 'layout/resizeSplit'; splitNodeId: LayoutNodeId; weights: number[] }
  | { type: 'layout/closeLeaf'; leafNodeId: LayoutNodeId }
  | { type: 'layout/toggleMaximize'; nodeId: LayoutNodeId }
  | { type: 'layout/setActiveGroup'; groupId: GroupId }
  | { type: 'layout/setChromeState'; workspaceId: WorkspaceId; patch: Partial<{ sidebarVisible: boolean; sidebarWidth: number; bottomPanelVisible: boolean; bottomPanelHeight: number; activeViewId?: string; activePanelId?: string }> }
  | { type: 'layout/resetWorkspace'; workspaceId: WorkspaceId };

export type EditorAction =
  | { type: 'editor/open'; request: EditorOpenRequest }
  | { type: 'editor/closeTab'; groupId: GroupId; tabId: string }
  | { type: 'editor/activateTab'; groupId: GroupId; tabId: string }
  | { type: 'editor/reopenRecentlyClosed'; targetGroupId?: GroupId }
  | { type: 'editor/moveTabToGroup'; fromGroupId: GroupId; toGroupId: GroupId; tabId: string; index?: number }
  | { type: 'editor/moveTabToNewSplit'; fromGroupId: GroupId; targetLeafNodeId: LayoutNodeId; tabId: string; direction: SplitDirection }
  | { type: 'editor/duplicateInstance'; groupId: GroupId; tabId: string; payloadOverride?: Record<string, unknown> };

export type TabStateAction =
  | { type: 'editor/setTabState'; groupId: GroupId; tabId: string; pinned?: boolean; preview?: boolean; dirty?: boolean }
  | { type: 'editor/reorderTab'; groupId: GroupId; tabId: string; index: number };

export type OverlayAction =
  | { type: 'overlay/open'; request: EditorOpenRequest }
  | { type: 'overlay/dismiss'; overlayId: OverlaySessionId; reason: OverlayDismissReason }
  | { type: 'overlay/promoteToTab'; overlayId: OverlaySessionId; targetGroupId?: GroupId };

/**
 * 浮动窗口（docking Window 层）动作。
 * 拖出/拖回只迁移页签引用，业务实例不重建；能力仲裁经 Slot/EditorCapabilityPolicy。
 */
export type FloatingWindowAction =
  | { type: 'floatingWindow/popout'; groupId: GroupId; tabIds?: TabId[]; position?: { x: number; y: number }; size?: { width: number; height: number } }
  | { type: 'floatingWindow/dockBack'; windowId: FloatingWindowId; targetGroupId?: GroupId }
  | { type: 'floatingWindow/updateGeometry'; windowId: FloatingWindowId; position?: { x: number; y: number }; size?: { width: number; height: number } }
  | { type: 'floatingWindow/close'; windowId: FloatingWindowId };

export type WorkspaceAction =
  | { type: 'workspace/switch'; workspaceId: WorkspaceId }
  | { type: 'workspace/registerDefaults' };

export type ThemeAction =
  | { type: 'theme/setMode'; mode: 'light' | 'dark' | 'system'; resolvedMode?: 'light' | 'dark'; themeId?: ThemeId };
