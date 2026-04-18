import type { TreeAdapter } from './types';

/**
 * Arborist 树上下文。
 *
 * @typeParam TNode 节点数据类型。
 */
export type ArboristTreeContext<TNode> = {
  /** 归一化节点列表。 */
  nodes: TNode[];
  /** 节点键提取函数。 */
  getId: (node: TNode) => string;
  /** 子节点提取函数。 */
  getChildren: (node: TNode) => TNode[] | undefined;
};

/**
 * Arborist 树适配器实现。
 */
export const arboristTreeAdapter: TreeAdapter = {
  /**
   * 创建 Arborist 树上下文。
   *
   * @typeParam TNode 节点数据类型。
   * @param options 树配置。
   * @returns 树上下文对象。
   */
  createTreeContext<TNode>(options: {
    nodes: TNode[];
    getId: (node: TNode) => string;
    getChildren: (node: TNode) => TNode[] | undefined;
  }): ArboristTreeContext<TNode> {
    return {
      nodes: options.nodes,
      getId: options.getId,
      getChildren: options.getChildren,
    };
  },
};
