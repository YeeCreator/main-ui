import type { GroupId, IdFactory, LayoutNodeId, Result, SplitDirection } from '../types';
import { fail, ok } from '../types';
import type { LayoutDocument, LayoutNode, SplitNode } from './types';

const directionToOrientation = (direction: SplitDirection): 'horizontal' | 'vertical' => {
  return direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical';
};

const insertsBefore = (direction: SplitDirection): boolean => direction === 'left' || direction === 'up';

const cloneLayout = (layout: LayoutDocument): LayoutDocument => ({
  ...layout,
  nodes: structuredClone(layout.nodes),
  groups: structuredClone(layout.groups),
});

export const normalizeWeights = (weights: number[]): number[] => {
  if (weights.length === 0) {
    return [];
  }

  const positive = weights.map((weight) => Math.max(0.05, Number.isFinite(weight) ? weight : 0));
  const sum = positive.reduce((total, weight) => total + weight, 0);
  return positive.map((weight) => Number((weight / sum).toFixed(4)));
};

export const getLeafNodeByGroupId = (layout: LayoutDocument, groupId: GroupId) => {
  return Object.values(layout.nodes).find((node) => node.type === 'leaf' && node.groupId === groupId);
};

export const getFirstGroupId = (layout: LayoutDocument): GroupId | null => {
  return Object.keys(layout.groups)[0] ?? null;
};

export const getFirstLeafNodeId = (layout: LayoutDocument): LayoutNodeId | null => {
  return Object.values(layout.nodes).find((node) => node.type === 'leaf')?.id ?? null;
};

export const findParentNode = (layout: LayoutDocument, childNodeId: LayoutNodeId): SplitNode | null => {
  for (const node of Object.values(layout.nodes)) {
    if (node.type === 'split' && node.children.includes(childNodeId)) {
      return node;
    }
  }
  return null;
};

export const splitLeaf = (
  layout: LayoutDocument,
  leafNodeId: LayoutNodeId,
  direction: SplitDirection,
  ratio: number | undefined,
  createId: IdFactory,
): Result<LayoutDocument> => {
  const sourceNode = layout.nodes[leafNodeId];
  if (!sourceNode || sourceNode.type !== 'leaf') {
    return fail('layout.leafNotFound', `Leaf node ${leafNodeId} does not exist.`);
  }

  const originalParent = findParentNode(layout, leafNodeId);
  const next = cloneLayout(layout);
  const orientation = directionToOrientation(direction);
  const splitId = createId('split');
  const newLeafId = createId('leaf');
  const newGroupId = createId('group');
  const firstWeight = Math.min(0.9, Math.max(0.1, ratio ?? 0.5));
  const newLeaf = {
    id: newLeafId,
    type: 'leaf' as const,
    groupId: newGroupId,
  };

  next.nodes[newLeafId] = newLeaf;
  next.groups[newGroupId] = {
    id: newGroupId,
    tabIds: [],
    activeTabId: null,
    lastActiveTabId: null,
  };

  const children = insertsBefore(direction) ? [newLeafId, leafNodeId] : [leafNodeId, newLeafId];
  const weights = insertsBefore(direction) ? [firstWeight, 1 - firstWeight] : [1 - firstWeight, firstWeight];
  next.nodes[splitId] = {
    id: splitId,
    type: 'split',
    orientation,
    children,
    weights: normalizeWeights(weights),
  };

  if (!originalParent) {
    next.rootNodeId = splitId;
  } else {
    const parent = next.nodes[originalParent.id];
    if (parent.type === 'split') {
      parent.children = parent.children.map((childId) => (childId === leafNodeId ? splitId : childId));
    }
  }

  next.activeGroupId = newGroupId;
  return ok(next);
};

export const resizeSplit = (layout: LayoutDocument, splitNodeId: LayoutNodeId, weights: number[]): Result<LayoutDocument> => {
  const node = layout.nodes[splitNodeId];
  if (!node || node.type !== 'split') {
    return fail('layout.splitNotFound', `Split node ${splitNodeId} does not exist.`);
  }

  if (weights.length !== node.children.length) {
    return fail('layout.weightMismatch', 'Split weights must match child count.');
  }

  const next = cloneLayout(layout);
  const nextNode = next.nodes[splitNodeId];
  if (nextNode.type === 'split') {
    nextNode.weights = normalizeWeights(weights);
  }
  return ok(next);
};

export const toggleMaximize = (layout: LayoutDocument, nodeId: LayoutNodeId): Result<LayoutDocument> => {
  if (!layout.nodes[nodeId]) {
    return fail('layout.nodeNotFound', `Layout node ${nodeId} does not exist.`);
  }

  return ok({
    ...cloneLayout(layout),
    maximizedNodeId: layout.maximizedNodeId === nodeId ? null : nodeId,
  });
};

export const setActiveGroup = (layout: LayoutDocument, groupId: GroupId): Result<LayoutDocument> => {
  if (!layout.groups[groupId]) {
    return fail('layout.groupNotFound', `Group ${groupId} does not exist.`);
  }

  return ok({
    ...cloneLayout(layout),
    activeGroupId: groupId,
  });
};

const deleteNodeTree = (nodes: Record<LayoutNodeId, LayoutNode>, nodeId: LayoutNodeId): void => {
  const node = nodes[nodeId];
  if (!node) {
    return;
  }

  if (node.type === 'split') {
    for (const childId of node.children) {
      deleteNodeTree(nodes, childId);
    }
  }

  delete nodes[nodeId];
};

export const compressLayout = (layout: LayoutDocument): LayoutDocument => {
  const next = cloneLayout(layout);
  let changed = true;

  while (changed) {
    changed = false;
    for (const node of Object.values(next.nodes)) {
      if (node.type !== 'split') {
        continue;
      }

      node.children = node.children.filter((childId) => Boolean(next.nodes[childId]));
      node.weights = normalizeWeights(node.weights.slice(0, node.children.length));

      if (node.children.length === 1) {
        const onlyChildId = node.children[0];
        const parent = findParentNode(next, node.id);
        if (!parent) {
          next.rootNodeId = onlyChildId;
        } else {
          parent.children = parent.children.map((childId) => (childId === node.id ? onlyChildId : childId));
        }
        delete next.nodes[node.id];
        changed = true;
        break;
      }

      const flattenedChildren: LayoutNodeId[] = [];
      const flattenedWeights: number[] = [];
      for (let index = 0; index < node.children.length; index += 1) {
        const childId = node.children[index];
        const child = next.nodes[childId];
        if (child?.type === 'split' && child.orientation === node.orientation) {
          flattenedChildren.push(...child.children);
          const parentWeight = node.weights[index] ?? 1;
          flattenedWeights.push(...child.weights.map((weight) => weight * parentWeight));
          delete next.nodes[childId];
          changed = true;
        } else {
          flattenedChildren.push(childId);
          flattenedWeights.push(node.weights[index] ?? 1);
        }
      }
      node.children = flattenedChildren;
      node.weights = normalizeWeights(flattenedWeights);
    }
  }

  return next;
};

export const closeLeaf = (layout: LayoutDocument, leafNodeId: LayoutNodeId): Result<LayoutDocument> => {
  const node = layout.nodes[leafNodeId];
  if (!node || node.type !== 'leaf') {
    return fail('layout.leafNotFound', `Leaf node ${leafNodeId} does not exist.`);
  }

  if (Object.values(layout.nodes).filter((item) => item.type === 'leaf').length <= 1) {
    return fail('layout.lastLeaf', 'The last leaf cannot be closed.');
  }

  const next = cloneLayout(layout);
  delete next.groups[node.groupId];
  deleteNodeTree(next.nodes, leafNodeId);

  const parent = findParentNode(next, leafNodeId);
  if (parent) {
    parent.children = parent.children.filter((childId) => childId !== leafNodeId);
    parent.weights = normalizeWeights(parent.weights.slice(0, parent.children.length));
  }

  const compressed = compressLayout(next);
  compressed.activeGroupId = getFirstGroupId(compressed);
  return ok(compressed);
};
