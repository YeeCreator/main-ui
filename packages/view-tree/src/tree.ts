import type { ViewTreeNode } from './types';

/** 扁平化后的可见行（供虚拟滚动渲染）。 */
export type FlatTreeNode = {
  node: ViewTreeNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
};

const matchesFilter = (node: ViewTreeNode, keyword: string): boolean =>
  node.label.toLowerCase().includes(keyword);

const subtreeMatches = (node: ViewTreeNode, keyword: string): boolean =>
  matchesFilter(node, keyword) || (node.children ?? []).some((child) => subtreeMatches(child, keyword));

/**
 * 展开态 + 过滤关键词 → 可见行序列（纯函数，可单测）。
 * 过滤模式下自动展开命中路径（祖先链保留）。
 */
export const flattenTree = (
  items: ViewTreeNode[],
  expandedIds: ReadonlySet<string>,
  filter = '',
): FlatTreeNode[] => {
  const keyword = filter.trim().toLowerCase();
  const rows: FlatTreeNode[] = [];

  const visit = (nodes: ViewTreeNode[], depth: number, forceExpand: boolean): void => {
    for (const node of nodes) {
      if (keyword && !subtreeMatches(node, keyword)) {
        continue;
      }
      const hasChildren = (node.children ?? []).length > 0;
      const expanded = forceExpand || expandedIds.has(node.id);
      rows.push({ node, depth, hasChildren, expanded: hasChildren && expanded });
      if (hasChildren && (expanded || keyword)) {
        visit(node.children ?? [], depth + 1, Boolean(keyword));
      }
    }
  };

  visit(items, 0, false);
  return rows;
};

/** 虚拟滚动窗口计算（纯函数，可单测）：委托 @main-ui/core 公共基座。 */
export { computeVirtualWindow } from '@main-ui/core';
