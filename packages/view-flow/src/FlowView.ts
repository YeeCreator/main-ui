import { defineComponent, h, ref, type ComponentPublicInstance, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import { FlowCanvas } from './FlowCanvas';
import type {
  FlowConnectIntent,
  FlowDocument,
  FlowMoveNodeIntent,
  FlowSelectionIntent,
  FlowViewport,
  FlowViewState,
} from './types';
import { DEFAULT_FLOW_VIEWPORT } from './types';

/** FlowCanvas expose API 类型。 */
type FlowCanvasApi = {
  getViewport(): FlowViewport;
  setViewport(vp: FlowViewport): void;
  getSelectedNodeIds(): string[];
  getSelectedEdgeIds(): string[];
};

/**
 * FlowView —— L3 薄壳视图（实现 MainUiViewLifecycle 四成员契约）。
 *
 * 包裹 L1 `FlowCanvas` 组件并附加视图生命周期管理。
 * 顶层停靠模式（挂 Slot）使用本组件；嵌入模式直接使用 `FlowCanvas`。
 * 二者共享同一套代码（双模式）。
 */
export const FlowView = defineComponent({
  name: 'FlowView',
  props: {
    document: { type: Object as PropType<FlowDocument>, required: true },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    editable: { type: Boolean, default: true },
    editorInstanceId: { type: String, default: null },
  },
  emits: ['node-move-intent', 'connect-intent', 'selection'],
  setup(props, { emit }) {
    const canvasRef = ref<(ComponentPublicInstance & FlowCanvasApi) | null>(null);
    let destroyed = false;

    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-flow',
      getViewState: (): FlowViewState => ({
        viewport: canvasRef.value?.getViewport() ?? DEFAULT_FLOW_VIEWPORT,
        selectedNodeIds: canvasRef.value?.getSelectedNodeIds() ?? [],
        selectedEdgeIds: canvasRef.value?.getSelectedEdgeIds() ?? [],
      }),
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<FlowViewState>;
        if (snapshot.viewport) canvasRef.value?.setViewport(snapshot.viewport);
      },
      onDestroy: () => {
        destroyed = true;
      },
    };
    if (props.editorInstanceId) {
      useViewLifecycle(props.editorInstanceId, () => lifecycle);
    }

    return () => h(FlowCanvas, {
      ref: canvasRef,
      document: props.document,
      loading: props.loading,
      error: props.error,
      editable: props.editable,
      canvasId: props.editorInstanceId ?? 'default',
      onNodeMoveIntent: (payload: FlowMoveNodeIntent) => emit('node-move-intent', payload),
      onConnectIntent: (payload: FlowConnectIntent) => emit('connect-intent', payload),
      onSelection: (payload: FlowSelectionIntent) => emit('selection', payload),
    });
  },
});
