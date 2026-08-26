import { computed, defineComponent, h } from 'vue';
import type { LayoutNodeId, SplitNode } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';
import { LeafGroupRenderer } from './LeafGroupRenderer';

export const WorkbenchLayoutRenderer = defineComponent({
  name: 'WorkbenchLayoutRenderer',
  setup() {
    const { document, dispatch } = useWorkbench();
    const workspace = computed(() => document.value.workspaceStates[document.value.activeWorkspaceId]);

    const startResize = (event: PointerEvent, splitNode: SplitNode, gutterIndex: number) => {
      const container = (event.currentTarget as HTMLElement).parentElement;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const start = splitNode.orientation === 'horizontal' ? event.clientX : event.clientY;
      const size = splitNode.orientation === 'horizontal' ? rect.width : rect.height;
      const initialWeights = [...splitNode.weights];
      const pointerId = event.pointerId;
      (event.currentTarget as HTMLElement).setPointerCapture(pointerId);

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

    const renderNode = (nodeId: LayoutNodeId): ReturnType<typeof h> => {
      const node = workspace.value.layout.nodes[nodeId];
      if (!node) {
        return h('div', { class: 'main-ui-layout-missing' }, `Missing node ${nodeId}`);
      }

      if (workspace.value.layout.maximizedNodeId && workspace.value.layout.maximizedNodeId !== nodeId) {
        const maximizedNode = workspace.value.layout.nodes[workspace.value.layout.maximizedNodeId];
        if (maximizedNode && nodeId === workspace.value.layout.rootNodeId) {
          return renderNode(maximizedNode.id);
        }
      }

      if (node.type === 'leaf') {
        return h(LeafGroupRenderer, { nodeId: node.id, groupId: node.groupId });
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

    return () => h('main', { class: 'main-ui-layout-renderer' }, [renderNode(workspace.value.layout.rootNodeId)]);
  },
});
