/**
 * 停靠引导拖拽会话（v0.4 P0-1）——渲染层瞬态状态，不进入 WorkbenchDocument。
 *
 * 不变量：拖拽中间态只有视觉指示（落点标识 + Ghost 预览），不修改布局树；
 * 只有落点确认（drop）才 dispatch action；Esc 取消时浏览器结束拖拽并经
 * `endDockingDrag` 清理，无任何状态残留。
 */
import { reactive } from 'vue';
import type { DropZone } from '../core';

export type DockingDragSource = {
  groupId: string;
  tabId: string;
  editorKind: string;
};

export type DockingHover = {
  groupId: string;
  leafNodeId: string;
  floatingWindowId: string | null;
  zone: DropZone;
};

export type DockingDragSession = {
  source: DockingDragSource | null;
  hover: DockingHover | null;
};

/** 全工作台共享的单例拖拽会话（同一时刻仅一个原生拖拽）。 */
export const dockingDragSession = reactive<DockingDragSession>({
  source: null,
  hover: null,
});

export const beginDockingDrag = (source: DockingDragSource): void => {
  dockingDragSession.source = source;
  dockingDragSession.hover = null;
};

export const updateDockingHover = (hover: DockingHover | null): void => {
  dockingDragSession.hover = hover;
};

export const endDockingDrag = (): void => {
  dockingDragSession.source = null;
  dockingDragSession.hover = null;
};
