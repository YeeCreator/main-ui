import { defineComponent, h, ref, type ComponentPublicInstance, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import { normalizeViewport } from './node';
import { NodeCanvas } from './NodeCanvas';
import type {
  NodeGraphData,
  NodeGraphEdgeData,
  NodeMoveIntentPayload,
  NodeConnectIntentPayload,
  NodeSelectionPayload,
  NodeViewport,
  NodeViewState,
} from './types';

/** NodeCanvas expose API 类型（薄壳通过 ref 访问）。 */
type NodeCanvasApi = {
  getViewport(): NodeViewState['viewport'];
  setViewport(vp: NodeViewport): void;
  getSelectedNodeIds(): string[];
};

/**
 * NodeView —— L3 薄壳视图（实现 MainUiViewLifecycle 四成员契约）。
 *
 * 包裹 L1 `NodeCanvas` 组件并附加视图生命周期管理。
 * 顶层停靠模式（挂 Slot）使用本组件；嵌入模式直接使用 `NodeCanvas`。
 * 二者共享同一套代码（双模式）。
 */
export const NodeView = defineComponent({
  name: 'NodeView',
  props: {
    nodes: { type: Array as PropType<NodeGraphData[]>, default: () => [] },
    edges: { type: Array as PropType<NodeGraphEdgeData[]>, default: () => [] },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    editable: { type: Boolean, default: true },
    editorInstanceId: { type: String, default: null },
  },
  emits: ['node-move-intent', 'node-connect-intent', 'selection'],
  setup(props, { emit }) {
    const canvasRef = ref<(ComponentPublicInstance & NodeCanvasApi) | null>(null);
    let destroyed = false;

    // ---------- 视图生命周期契约（四成员，onDestroy 幂等） ----------
    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-node',
      getViewState: (): NodeViewState => ({
        viewport: canvasRef.value?.getViewport() ?? normalizeViewport(null),
        selectedNodeIds: canvasRef.value?.getSelectedNodeIds() ?? [],
      }),
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<NodeViewState>;
        const viewport = normalizeViewport(snapshot.viewport);
        canvasRef.value?.setViewport(viewport);
      },
      onDestroy: () => {
        destroyed = true;
      },
    };
    if (props.editorInstanceId) {
      useViewLifecycle(props.editorInstanceId, () => lifecycle);
    }

    // ---------- 意图透传（薄壳不做裁决，一律外抛） ----------
    return () => h(NodeCanvas, {
      ref: canvasRef,
      nodes: props.nodes,
      edges: props.edges,
      loading: props.loading,
      error: props.error,
      editable: props.editable,
      canvasId: props.editorInstanceId ?? 'default',
      onNodeMoveIntent: (payload: NodeMoveIntentPayload) => emit('node-move-intent', payload),
      onNodeConnectIntent: (payload: NodeConnectIntentPayload) => emit('node-connect-intent', payload),
      onSelection: (payload: NodeSelectionPayload) => emit('selection', payload),
    });
  },
});
