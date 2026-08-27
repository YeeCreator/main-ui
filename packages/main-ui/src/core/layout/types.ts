import type { GroupId, LayoutNodeId, SplitOrientation, TabId } from '../types';

export type LayoutDocument = {
  version: 1;
  rootNodeId: LayoutNodeId;
  nodes: Record<LayoutNodeId, LayoutNode>;
  groups: Record<GroupId, LeafGroup>;
  activeGroupId: GroupId | null;
  maximizedNodeId: LayoutNodeId | null;
};

export type LayoutNode = SplitNode | LeafNode;

export type SplitNode = {
  id: LayoutNodeId;
  type: 'split';
  orientation: SplitOrientation;
  children: LayoutNodeId[];
  weights: number[];
  minSize?: number;
};

export type LeafNode = {
  id: LayoutNodeId;
  type: 'leaf';
  groupId: GroupId;
  minWidth?: number;
  minHeight?: number;
};

export type LeafGroup = {
  id: GroupId;
  tabIds: TabId[];
  activeTabId: TabId | null;
  lastActiveTabId: TabId | null;
  locked?: boolean;
};
