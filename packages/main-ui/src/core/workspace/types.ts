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
  /**
   * 微件显隐与方位配置（布局模型的一部分，随快照持久化）。
   *
   * 为什么放布局而非设置：它描述的是「这个工作台怎么摆」而不是「用户偏好什么」，
   * 与侧栏宽度、面板高度同一性质 —— 换一台机器打开同一布局，应看到同样的微件。
   * 全部可选，旧快照读取时补默认值。
   */
  auxiliary?: AuxiliaryConfig;
};

/** 单个位置的微件配置。 */
export type AuxiliarySlotConfig = {
  /** 是否显示该位置的微件（缺省 true） */
  visible?: boolean;
  /** 方位（仅部分位置支持；供后续扩展左右/上下） */
  position?: 'start' | 'end';
};

/** 微件配置：按位置分别控制显隐与方位。 */
export type AuxiliaryConfig = {
  toolbar?: AuxiliarySlotConfig;
  'context-menu'?: AuxiliarySlotConfig;
  status?: AuxiliarySlotConfig;
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
  /**
   * 快照版本。
   *
   * v4（2026-10-27）：新增 `meta`（宿主透传元数据）与每个 workspace 的 `auxiliary`
   * （微件配置）。两者均全可选，旧快照读取时自动补默认值。
   */
  version: 1 | 2 | 3 | 4;
  activeWorkspaceId: WorkspaceId;
  workspaceStates: Record<WorkspaceId, WorkspaceState>;
  theme: ThemeState;
  settings: WorkbenchSettings;
  recentWorkspaces: WorkspaceId[];
  recentEditors: Array<{ editorKind: EditorKind; restoreKey?: string; openedAt: string }>;
  /**
   * 宿主透传元数据（**main-ui 不解释、不读取、不校验其内容**）。
   *
   * 用途：宿主需要把一点自己的状态跟着布局一起存（当前项目 id、上次选中的图层
   * 等等），但又不想另建一份持久化。内核只负责原样存取。
   *
   * 红线：不得让 main-ui 的任何逻辑依赖其中的字段 —— 一旦依赖，它就不再是「宿主
   * 元数据」而变成了内核契约，会造成两份真相。
   */
  meta?: Record<string, unknown>;
};
