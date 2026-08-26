import type { GroupId, IdFactory, LayoutNodeId } from '../types';
import type { LayoutDocument } from './types';

export type SingleGroupLayoutOptions = {
  groupId?: GroupId;
  leafNodeId?: LayoutNodeId;
};

export const createSingleGroupLayout = (options: SingleGroupLayoutOptions = {}): LayoutDocument => {
  const groupId = options.groupId ?? 'group-root';
  const leafNodeId = options.leafNodeId ?? 'leaf-root';

  return {
    version: 1,
    rootNodeId: leafNodeId,
    nodes: {
      [leafNodeId]: {
        id: leafNodeId,
        type: 'leaf',
        groupId,
      },
    },
    groups: {
      [groupId]: {
        id: groupId,
        tabIds: [],
        activeTabId: null,
        lastActiveTabId: null,
      },
    },
    activeGroupId: groupId,
    maximizedNodeId: null,
  };
};

export const createTwoPaneLayout = (prefix: string, orientation: 'horizontal' | 'vertical' = 'horizontal'): LayoutDocument => {
  const firstGroupId = `${prefix}-group-1`;
  const secondGroupId = `${prefix}-group-2`;
  const firstLeafId = `${prefix}-leaf-1`;
  const secondLeafId = `${prefix}-leaf-2`;
  const splitId = `${prefix}-split-root`;

  return {
    version: 1,
    rootNodeId: splitId,
    nodes: {
      [splitId]: {
        id: splitId,
        type: 'split',
        orientation,
        children: [firstLeafId, secondLeafId],
        weights: [0.62, 0.38],
      },
      [firstLeafId]: {
        id: firstLeafId,
        type: 'leaf',
        groupId: firstGroupId,
      },
      [secondLeafId]: {
        id: secondLeafId,
        type: 'leaf',
        groupId: secondGroupId,
      },
    },
    groups: {
      [firstGroupId]: {
        id: firstGroupId,
        tabIds: [],
        activeTabId: null,
        lastActiveTabId: null,
      },
      [secondGroupId]: {
        id: secondGroupId,
        tabIds: [],
        activeTabId: null,
        lastActiveTabId: null,
      },
    },
    activeGroupId: firstGroupId,
    maximizedNodeId: null,
  };
};

export const createThreePaneLayout = (prefix: string): LayoutDocument => {
  const leftGroupId = `${prefix}-group-left`;
  const centerGroupId = `${prefix}-group-center`;
  const rightGroupId = `${prefix}-group-right`;
  const leftLeafId = `${prefix}-leaf-left`;
  const centerLeafId = `${prefix}-leaf-center`;
  const rightLeafId = `${prefix}-leaf-right`;
  const splitId = `${prefix}-split-root`;

  return {
    version: 1,
    rootNodeId: splitId,
    nodes: {
      [splitId]: {
        id: splitId,
        type: 'split',
        orientation: 'horizontal',
        children: [leftLeafId, centerLeafId, rightLeafId],
        weights: [0.2, 0.58, 0.22],
      },
      [leftLeafId]: {
        id: leftLeafId,
        type: 'leaf',
        groupId: leftGroupId,
      },
      [centerLeafId]: {
        id: centerLeafId,
        type: 'leaf',
        groupId: centerGroupId,
      },
      [rightLeafId]: {
        id: rightLeafId,
        type: 'leaf',
        groupId: rightGroupId,
      },
    },
    groups: {
      [leftGroupId]: {
        id: leftGroupId,
        tabIds: [],
        activeTabId: null,
        lastActiveTabId: null,
      },
      [centerGroupId]: {
        id: centerGroupId,
        tabIds: [],
        activeTabId: null,
        lastActiveTabId: null,
      },
      [rightGroupId]: {
        id: rightGroupId,
        tabIds: [],
        activeTabId: null,
        lastActiveTabId: null,
      },
    },
    activeGroupId: centerGroupId,
    maximizedNodeId: null,
  };
};

export const createGeneratedSingleGroupLayout = (createId: IdFactory): LayoutDocument => {
  const groupId = createId('group');
  const leafNodeId = createId('leaf');
  return createSingleGroupLayout({ groupId, leafNodeId });
};
