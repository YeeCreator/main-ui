import type { EditorKind, FloatingWindowId, WorkspaceId } from '../types';
import type { EditorInstance, EditorOpenRequest, FocusEntry, RecentlyClosedEntry, TabInstance } from '../editor/types';
import type { LayoutDocument } from '../layout/types';
import type { OverlaySession } from '../overlay/types';
import type { ThemeState, WorkbenchSettings } from '../theme/types';

export type WorkspaceCreateContext = {
  workspaceId: WorkspaceId;
};

/**
 * 浮动窗口（docking Window 层）。
 * 每个浮动窗口持有独立布局子树（与主布局树同构，完整 split/leaf/group 结构），
 * 布局快照只存引用，业务实例不重建。
 */
export type FloatingWindowState = {
  id: FloatingWindowId;
  layout: LayoutDocument;
  /** 窗口左上角坐标（相对主视口；恢复时越界自动归位） */
  position: { x: number; y: number };
  size: { width: number; height: number };
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceState = {
  workspaceId: WorkspaceId;
  layout: LayoutDocument;
  /** 浮动窗口（v0.3+）；旧快照无此字段，读取时按空集处理 */
  floatingWindows?: Record<FloatingWindowId, FloatingWindowState>;
  editors: Record<string, EditorInstance>;
  tabs: Record<string, TabInstance>;
  overlays: Record<string, OverlaySession>;
  recentlyClosed: RecentlyClosedEntry[];
  focusHistory: FocusEntry[];
  dirtyFromPreset: boolean;
  updatedAt: string;
  tabHistory: string[];
  chrome: {
    sidebarVisible: boolean;
    sidebarWidth: number;
    bottomPanelVisible: boolean;
    bottomPanelHeight: number;
    activeViewId?: string;
    activePanelId?: string;
  };
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
  /**
   * 把该 workspace 归入活动栏**下半区**（辅助工具组）。
   *
   * 用途：区分「同级的多个主视角」与「辅助工具」。全放上半区会让活动栏
   * 读起来像「一堆并列的 App」——正是 GeoGebra 分裂式入口被诟病之处。
   * 上半区放视角，下半区放文件/分析之类辅助入口，层级一眼可辨。
   */
  pinToBottom?: boolean;
};

export type WorkbenchDocument = {
  version: 1 | 2 | 3;
  activeWorkspaceId: WorkspaceId;
  workspaceStates: Record<WorkspaceId, WorkspaceState>;
  theme: ThemeState;
  settings: WorkbenchSettings;
  recentWorkspaces: WorkspaceId[];
  recentEditors: Array<{ editorKind: EditorKind; restoreKey?: string; openedAt: string }>;
};
