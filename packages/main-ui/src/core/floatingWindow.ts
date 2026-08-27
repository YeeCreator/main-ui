import type { FloatingWindowId, GroupId, IdFactory, LayoutNodeId, TabId } from './types';
import type { LayoutDocument } from './layout/types';
import type { FloatingWindowState } from './workspace/types';

/**
 * 浮动窗口（docking Window 层）纯函数助手：不依赖 DOM 与渲染层。
 */

/** 默认浮动窗口尺寸与最小尺寸约束。 */
export const floatingWindowDefaults = {
  width: 640,
  height: 420,
  minWidth: 240,
  minHeight: 160,
  offset: 64,
} as const;

export type FloatingViewport = { width: number; height: number };

/**
 * 多显示器坑处理：快照记录的窗口坐标可能越出当前视口
 * （外接屏断开、分辨率变化等），恢复时自动归位主视口内。
 * 返回归位后的几何信息；`changed` 为是否需要写回。
 */
export const clampFloatingGeometry = (
  window: Pick<FloatingWindowState, 'position' | 'size'>,
  viewport: FloatingViewport,
): { position: { x: number; y: number }; size: { width: number; height: number }; changed: boolean } => {
  const width = Math.max(floatingWindowDefaults.minWidth, Math.min(window.size.width, Math.max(floatingWindowDefaults.minWidth, viewport.width)));
  const height = Math.max(floatingWindowDefaults.minHeight, Math.min(window.size.height, Math.max(floatingWindowDefaults.minHeight, viewport.height)));
  // 至少保留标题栏可见区域在视口内，避免窗口完全跑出可交互范围。
  const titleBarKeep = 32;
  const x = Math.max(-(width - titleBarKeep), Math.min(window.position.x, viewport.width - titleBarKeep));
  const y = Math.max(0, Math.min(window.position.y, Math.max(0, viewport.height - titleBarKeep)));
  const changed = x !== window.position.x || y !== window.position.y || width !== window.size.width || height !== window.size.height;
  return { position: { x, y }, size: { width, height }, changed };
};

/**
 * 创建浮动窗口的独立布局子树：与主布局树同构（单 leaf + 单 group），
 * 初始承载给定的页签引用（业务实例不重建）。
 */
export const createFloatingWindowLayout = (tabIds: TabId[], activeTabId: TabId | null, createId: IdFactory): LayoutDocument => {
  const leafId: LayoutNodeId = createId('leaf');
  const groupId: GroupId = createId('group');
  return {
    version: 1,
    rootNodeId: leafId,
    nodes: {
      [leafId]: { id: leafId, type: 'leaf', groupId },
    },
    groups: {
      [groupId]: {
        id: groupId,
        tabIds: [...tabIds],
        activeTabId,
        lastActiveTabId: activeTabId,
      },
    },
    activeGroupId: groupId,
    maximizedNodeId: null,
  };
};

/** 统计浮动窗口布局子树中的页签总数（用于空窗口回收判断）。 */
export const countFloatingWindowTabs = (floatingWindow: FloatingWindowState): number => {
  return Object.values(floatingWindow.layout.groups).reduce((total, group) => total + group.tabIds.length, 0);
};

/** 生成浮动窗口的默认落位（相对主视口偏移，避免与既有窗口完全重叠由调用方叠加序号）。 */
export const defaultFloatingPosition = (index: number): { x: number; y: number } => ({
  x: floatingWindowDefaults.offset + index * floatingWindowDefaults.offset,
  y: floatingWindowDefaults.offset + index * floatingWindowDefaults.offset,
});

export const createFloatingWindowId = (createId: IdFactory): FloatingWindowId => createId('floating-window');
