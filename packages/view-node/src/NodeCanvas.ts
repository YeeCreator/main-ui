import { computed, defineComponent, h, onMounted, ref, type CSSProperties, type PropType } from 'vue';
import {
  VueFlow,
  useVueFlow,
  type Connection,
  type Edge as FlowEdge,
  type GraphNode,
  type Node as FlowNode,
  type NodeDragEvent,
  type NodeMouseEvent,
} from '@vue-flow/core';
import { dedupeById, normalizeViewport, pruneDanglingEdges } from './node';
import type {
  NodeConnectIntentPayload,
  NodeGraphData,
  NodeGraphEdgeData,
  NodeMoveIntentPayload,
  NodeSelectionPayload,
  NodeViewport,
} from './types';

/**
 * NodeCanvas —— L1 可嵌入节点画布组件（不实现四成员契约，不可挂 Slot）。
 *
 * 可被其他面板或复合 View（如 view-sandbox）嵌入使用。
 * 节点/连边数据经 Props 注入，操作意图经 Emits 抛出。
 * 生命周期由父级（NodeView 薄壳或 EmbeddedViewHost）管理。
 */

/** @vue-flow/core 结构样式运行时注入（SSR 守卫）。 */
export const ensureFlowStyles = () => {
  if (typeof document === 'undefined') return;
  if (!document.head.querySelector('link[data-main-ui-view-node]')) {
    try {
      const linkEl = document.createElement('link');
      linkEl.rel = 'stylesheet';
      linkEl.setAttribute('data-main-ui-view-node', '');
      linkEl.href = new URL('./view-flow.css', import.meta.url).href;
      document.head.appendChild(linkEl);
    } catch {
      // 宿主环境不支持 import.meta.url 相对解析时静默降级
    }
  }
  if (document.head.querySelector('style[data-main-ui-view-node]')) return;
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-main-ui-view-node', '');
  styleEl.textContent = [
    `.main-ui-view-node .vue-flow__node-default { background: var(--mui-color-panel-raised, var(--mui-color-panel)); border: 1px solid var(--mui-color-border); border-radius: var(--mui-radius); color: var(--mui-color-text); font-size: 12px; padding: 6px 10px; }`,
    `.main-ui-view-node .vue-flow__node-default.selected { border-color: var(--mui-color-accent); box-shadow: 0 0 0 1px var(--mui-color-accent); }`,
    `.main-ui-view-node .vue-flow__edge-path { stroke: var(--mui-color-border); stroke-width: 1.5; }`,
    `.main-ui-view-node .vue-flow__edge.selected .vue-flow__edge-path { stroke: var(--mui-color-accent); }`,
    `.main-ui-view-node .vue-flow__edge-textbg { fill: var(--mui-color-panel); }`,
    `.main-ui-view-node .vue-flow__edge-text { fill: var(--mui-color-text-muted); font-size: 11px; }`,
    `.main-ui-view-node .vue-flow__connection-path { stroke: var(--mui-color-accent); stroke-width: 1.5; }`,
    `.main-ui-view-node .vue-flow__handle { background: var(--mui-color-accent); border: 1px solid var(--mui-color-panel); width: 7px; height: 7px; }`,
    `.main-ui-view-node .vue-flow__minimap { background: var(--mui-color-panel); }`,
  ].join('\n');
  document.head.appendChild(styleEl);
};

export const NodeCanvas = defineComponent({
  name: 'NodeCanvas',
  props: {
    nodes: { type: Array as PropType<NodeGraphData[]>, default: () => [] },
    edges: { type: Array as PropType<NodeGraphEdgeData[]>, default: () => [] },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    editable: { type: Boolean, default: true },
    /** 画布实例标识（多实例隔离） */
    canvasId: { type: String, default: 'default' },
    /** 初始视口（可选，用于快照恢复） */
    initialViewport: { type: Object as PropType<NodeViewport | null>, default: null },
  },
  emits: ['node-move-intent', 'node-connect-intent', 'selection', 'ready'],
  setup(props, { emit, expose }) {
    const flowId = `main-ui-node-canvas-${props.canvasId}`;
    const { getViewport, setViewport } = useVueFlow({ id: flowId });

    const mounted = ref(false);
    const pendingViewport = ref<NodeViewport | null>(props.initialViewport);
    const selectedNodeIds = ref<string[]>([]);

    // ---------- 契约数据 → 内核形态 ----------
    const flowNodes = computed<FlowNode[]>(() => dedupeById(props.nodes ?? []).map((node) => ({
      id: node.id,
      type: 'default',
      position: { x: node.position?.x ?? 0, y: node.position?.y ?? 0 },
      data: { label: node.label ?? node.id, ...(node.data ?? {}) },
    })));

    const flowEdges = computed<FlowEdge[]>(() => {
      const nodeIds = new Set(flowNodes.value.map((node) => node.id));
      return pruneDanglingEdges(dedupeById(props.edges ?? []), nodeIds).map((edge) => ({
        id: edge.id, source: edge.source, target: edge.target,
        label: edge.label, type: 'default',
      }));
    });

    // ---------- 操作意图 ----------
    const onNodeDragStop = (event: NodeDragEvent) => {
      const payload: NodeMoveIntentPayload = {
        nodeId: event.node.id,
        position: { x: event.node.position.x, y: event.node.position.y },
      };
      emit('node-move-intent', payload);
    };

    const onConnect = (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      emit('node-connect-intent', { source: connection.source, target: connection.target } satisfies NodeConnectIntentPayload);
    };

    const syncSelection = (nodes: GraphNode[]) => {
      selectedNodeIds.value = nodes.filter((node) => node.selected).map((node) => node.id);
      emit('selection', { nodeIds: [...selectedNodeIds.value] } satisfies NodeSelectionPayload);
    };

    const onNodeClick = (event: NodeMouseEvent) => {
      selectedNodeIds.value = [event.node.id];
      emit('selection', { nodeIds: [event.node.id] } satisfies NodeSelectionPayload);
    };

    onMounted(() => {
      ensureFlowStyles();
      mounted.value = true;
      if (pendingViewport.value) {
        void setViewport(pendingViewport.value);
        pendingViewport.value = null;
      }
      emit('ready', { getViewport, setViewport });
    });

    // 暴露给父组件使用的 API
    expose({
      getViewport: () => normalizeViewport(getViewport()),
      setViewport: (vp: NodeViewport) => { if (mounted.value) void setViewport(vp); },
      getSelectedNodeIds: () => [...selectedNodeIds.value],
    });

    // ---------- 渲染 ----------
    const rootStyle: CSSProperties = {
      width: '100%', height: '100%', overflow: 'hidden', position: 'relative',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
    };

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-node', style: { ...rootStyle, display: 'grid', placeItems: 'center' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-node', style: { ...rootStyle, display: 'grid', placeItems: 'center', color: 'var(--mui-color-danger)' } }, props.error);
      }
      return h('div', { class: 'main-ui-view-node', style: rootStyle }, [
        h(VueFlow, {
          id: flowId,
          class: 'main-ui-view-node__canvas',
          style: { width: '100%', height: '100%' },
          nodes: flowNodes.value,
          edges: flowEdges.value,
          nodesDraggable: props.editable,
          nodesConnectable: props.editable,
          elementsSelectable: true,
          minZoom: 0.1, maxZoom: 4,
          fitViewOnInit: true,
          onNodeDragStop, onConnect, onNodeClick,
          onSelectionChange: (params: { nodes: GraphNode[] }) => syncSelection(params.nodes),
        }),
      ]);
    };
  },
});
