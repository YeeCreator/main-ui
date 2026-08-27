import { defineComponent, h, type PropType, type VNode } from 'vue';
import type { FloatingWindowId, LayoutDocument, LayoutNodeId, SplitNode } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';
import { LeafGroupRenderer } from './LeafGroupRenderer';

/**
 * 布局树递归渲染器：主布局与浮动窗口布局子树共用。
 * 浮动窗口场景传入 `floatingWindowId`，由 `LeafGroupRenderer` 从窗口布局子树解析组。
 */
export const LayoutNodeRenderer = defineComponent({
  name: 'LayoutNodeRenderer',
  props: {
    layout: {
      type: Object as PropType<LayoutDocument>,
      required: true,
    },
    nodeId: {
      type: String as PropType<LayoutNodeId>,
      required: true,
    },
    floatingWindowId: {
      type: String as PropType<FloatingWindowId>,
      default: null,
    },
  },
  setup(props) {
    const { dispatch } = useWorkbench();

    const startResize = (event: PointerEvent, splitNode: SplitNode, gutterIndex: number) => {
      const container = (event.currentTarget as HTMLElement).parentElement;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const start = splitNode.orientation === 'horizontal' ? event.clientX : event.clientY;
      const size = splitNode.orientation === 'horizontal' ? rect.width : rect.height;
      const initialWeights = [...splitNode.weights];

      const onPointerMove = (moveEvent: PointerEvent) => {
        const current = splitNode.orientation === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
        const delta = size > 0 ? (current - start) / size : 0;
        const nextWeights = [...initialWeights];
        nextWeights[gutterIndex] = Math.max(0.08, initialWeights[gutterIndex] + delta);
        nextWeights[gutterIndex + 1] = Math.max(0.08, initialWeights[gutterIndex + 1] - delta);
        void dispatch({ type: 'layout/resizeSplit', splitNodeId: splitNode.id, weights: nextWeights });
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp, { once: true });
    };

    const renderNode = (nodeId: LayoutNodeId): VNode => {
      const node = props.layout.nodes[nodeId];
      if (!node) {
        return h('div', { class: 'main-ui-layout-missing' }, `Missing node ${nodeId}`);
      }

      if (node.type === 'leaf') {
        return h(LeafGroupRenderer, { nodeId: node.id, groupId: node.groupId, floatingWindowId: props.floatingWindowId });
      }

      return h('div', {
        class: ['main-ui-split-node', `is-${node.orientation}`],
        'data-node-id': node.id,
      }, node.children.flatMap((childId, index) => {
        const child = h('div', {
          class: 'main-ui-split-node__child',
          style: {
            flexGrow: node.weights[index] ?? 1,
            flexBasis: 0,
          },
        }, [renderNode(childId)]);

        if (index === node.children.length - 1) {
          return [child];
        }

        const gutter = h('div', {
          class: ['main-ui-split-gutter', `is-${node.orientation}`],
          role: 'separator',
          onPointerdown: (event: PointerEvent) => startResize(event, node, index),
        });
        return [child, gutter];
      }));
    };

    return () => renderNode(props.nodeId);
  },
});
