import { computed, defineComponent, h, onMounted, ref, type CSSProperties, type PropType } from 'vue';
import {
  VueFlow,
  useVueFlow,
  type Connection,
  type Edge as FlowEdge,
  type GraphNode,
  type Node as FlowNode,
  type NodeDragEvent,
} from '@vue-flow/core';
import { dedupeNodes, dedupeEdges } from './flow';
import type {
  FlowConnectIntent,
  FlowDocument,
  FlowMoveNodeIntent,
  FlowPortRef,
  FlowSelectionIntent,
  FlowViewport,
} from './types';
import { DEFAULT_FLOW_VIEWPORT } from './types';

/**
 * FlowCanvas —— L1 可嵌入流程图画布组件（不实现四成员契约，不可挂 Slot）。
 *
 * 可被其他面板或复合 View（如 view-sandbox）嵌入使用。
 * 流程文档数据经 Props 注入，操作意图经 Emits 抛出。
 * 生命周期由父级（FlowView 薄壳或 EmbeddedViewHost）管理。
 */
export const FlowCanvas = defineComponent({
  name: 'FlowCanvas',
  props: {
    document: { type: Object as PropType<FlowDocument>, required: true },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    editable: { type: Boolean, default: true },
    canvasId: { type: String, default: 'default' },
    initialViewport: { type: Object as PropType<FlowViewport | null>, default: null },
  },
  emits: ['node-move-intent', 'connect-intent', 'selection', 'ready'],
  setup(props, { emit, expose }) {
    const flowId = `main-ui-flow-canvas-${props.canvasId}`;
    const { getViewport, setViewport } = useVueFlow({ id: flowId });

    const mounted = ref(false);
    const pendingViewport = ref<FlowViewport | null>(props.initialViewport);
    const selectedNodeIds = ref<string[]>([]);
    const selectedEdgeIds = ref<string[]>([]);

    // ---------- 文档数据 → vue-flow 内核形态 ----------
    const flowNodes = computed<FlowNode[]>(() => {
      const nodes = dedupeNodes(props.document.nodes ?? []);
      const layoutMap = new Map((props.document.node_layouts ?? []).map((l) => [l.id, l]));
      return nodes.map((node) => {
        const layout = layoutMap.get(node.id);
        return {
          id: node.id,
          type: 'default',
          position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
          data: {
            label: node.label ?? node.id,
            node_type: node.node_type,
            ports: node.ports,
            ...(node.content ?? {}),
          },
        };
      });
    });

    const flowEdges = computed<FlowEdge[]>(() => {
      const edges = dedupeEdges(props.document.edges ?? []);
      return edges.map((edge) => ({
        id: edge.id,
        source: edge.source.nodeId,
        target: edge.target.nodeId,
        sourceHandle: edge.source.portId,
        targetHandle: edge.target.portId,
        label: edge.label,
        type: edge.signal === 'control' ? 'default' : 'default',
        class: edge.signal === 'control' ? 'flow-edge--control' : 'flow-edge--data',
      }));
    });

    // ---------- 操作意图 ----------
    const onNodeDragStop = (event: NodeDragEvent) => {
      emit('node-move-intent', {
        nodeId: event.node.id,
        position: { x: event.node.position.x, y: event.node.position.y },
      } satisfies FlowMoveNodeIntent);
    };

    const onConnect = (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const source: FlowPortRef = { nodeId: connection.source, portId: connection.sourceHandle ?? 'out' };
      const target: FlowPortRef = { nodeId: connection.target, portId: connection.targetHandle ?? 'in' };
      emit('connect-intent', { source, target, signal: 'control' } satisfies FlowConnectIntent);
    };

    const onSelectionChange = (params: { nodes: GraphNode[]; edges: FlowEdge[] }) => {
      selectedNodeIds.value = params.nodes.map((n) => n.id);
      selectedEdgeIds.value = params.edges.map((e) => e.id);
      emit('selection', {
        nodeIds: [...selectedNodeIds.value],
        edgeIds: [...selectedEdgeIds.value],
      } satisfies FlowSelectionIntent);
    };

    onMounted(() => {
      mounted.value = true;
      if (pendingViewport.value) {
        void setViewport(pendingViewport.value);
        pendingViewport.value = null;
      }
      emit('ready', { getViewport, setViewport });
    });

    expose({
      getViewport: (): FlowViewport => {
        const vp = getViewport();
        return {
          x: Number.isFinite(vp?.x) ? vp.x : DEFAULT_FLOW_VIEWPORT.x,
          y: Number.isFinite(vp?.y) ? vp.y : DEFAULT_FLOW_VIEWPORT.y,
          zoom: Number.isFinite(vp?.zoom) ? vp.zoom : DEFAULT_FLOW_VIEWPORT.zoom,
        };
      },
      setViewport: (vp: FlowViewport) => { if (mounted.value) void setViewport(vp); },
      getSelectedNodeIds: () => [...selectedNodeIds.value],
      getSelectedEdgeIds: () => [...selectedEdgeIds.value],
    });

    // ---------- 渲染 ----------
    const rootStyle: CSSProperties = {
      width: '100%', height: '100%', overflow: 'hidden', position: 'relative',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
    };

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-flow', style: { ...rootStyle, display: 'grid', placeItems: 'center' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-flow', style: { ...rootStyle, display: 'grid', placeItems: 'center', color: 'var(--mui-color-danger)' } }, props.error);
      }
      return h('div', { class: 'main-ui-view-flow', style: rootStyle }, [
        h(VueFlow, {
          id: flowId,
          class: 'main-ui-view-flow__canvas',
          style: { width: '100%', height: '100%' },
          nodes: flowNodes.value,
          edges: flowEdges.value,
          nodesDraggable: props.editable,
          nodesConnectable: props.editable,
          elementsSelectable: true,
          minZoom: 0.1, maxZoom: 4,
          fitViewOnInit: true,
          onNodeDragStop, onConnect, onSelectionChange,
        }),
      ]);
    };
  },
});
