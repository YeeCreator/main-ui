import React from 'react';
import { Tree, type NodeApi } from 'react-arborist';

/**
 * 树节点基础结构。
 */
export type TreePanelNode = {
  /** 节点唯一标识。 */
  id: string;
  /** 节点名称。 */
  name: string;
  /** 子节点集合。 */
  children?: TreePanelNode[];
};

/**
 * 树面板属性。
 */
export type TreePanelProps = {
  /** 面板标题。 */
  title?: string;
  /** 树节点数据。 */
  nodes: TreePanelNode[];
  /** 面板高度。 */
  height?: number;
  /** 节点点击回调。 */
  onSelectNode?: (node: TreePanelNode) => void;
  /** 外层样式。 */
  style?: React.CSSProperties;
};

/**
 * 树形导航面板（react-arborist 语义壳层）。
 *
 * @param props 树面板属性。
 * @returns 树形导航面板。
 */
export function TreePanel(props: TreePanelProps): React.JSX.Element {
  const { title = '资源树', nodes, height = 360, onSelectNode, style } = props;

  return (
    <section
      style={{
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 10,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: '#fff',
        ...style,
      }}
    >
      <strong style={{ fontSize: 14 }}>{title}</strong>
      <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, overflow: 'hidden' }}>
        <Tree<TreePanelNode>
          data={nodes}
          width="100%"
          height={height}
          rowHeight={30}
          indent={20}
          openByDefault={false}
          onSelect={(selection) => {
            const first = selection[0];
            if (first?.data && onSelectNode) {
              onSelectNode(first.data);
            }
          }}
        >
          {({ node, style: nodeStyle }) => (
            <TreeRow node={node} nodeStyle={nodeStyle} />
          )}
        </Tree>
      </div>
    </section>
  );
}

/**
 * 树节点行渲染器。
 *
 * @param props 渲染参数。
 * @returns 单行节点视图。
 */
function TreeRow(props: { node: NodeApi<TreePanelNode>; nodeStyle: React.CSSProperties }): React.JSX.Element {
  const { node, nodeStyle } = props;

  return (
    <div
      style={{
        ...nodeStyle,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 8px',
        borderBottom: '1px solid rgba(0,0,0,0.04)',
        fontSize: 13,
        background: node.isSelected ? 'rgba(0,0,0,0.05)' : 'transparent',
        cursor: 'pointer',
      }}
      onClick={() => {
        node.toggle();
      }}
      role="treeitem"
      aria-selected={node.isSelected}
    >
      <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center' }}>{node.isLeaf ? '•' : node.isOpen ? '▾' : '▸'}</span>
      <span>{node.data.name}</span>
    </div>
  );
}
