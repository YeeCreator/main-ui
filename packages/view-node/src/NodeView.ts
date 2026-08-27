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
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import { dedupeById, normalizeViewport, pruneDanglingEdges } from './node';
import type {
  NodeConnectIntentPayload,
  NodeGraphData,
  NodeGraphEdgeData,
  NodeMoveIntentPayload,
  NodeSelectionPayload,
  NodeViewport,
  NodeViewState,
} from './types';

/**
 * NodeView —— 节点图/关系图模板（@vue-flow/core 内核薄封装）。
 * 节点/连边数据经 Props 注入（含 loading / error 三态），移动/连线/选择等
 * 操作意图一律经 Emits 抛出，由宿主裁决是否落库；画布视口与选择进视图状态契约。
 */

/**
 * 内核结构样式（layout/positioning）按文档幂等注入：
 * @vue-flow/core 的结构样式以 `view-flow.css` 随包分发（构建时拷贝进 dist），
 * 运行时经 `<link>` 加载，不依赖宿主 bundler 的 css 处理能力；
 * 外观补充规则一律消费 --mui-* 变量。
 */
const ensureFlowStyles = () => {
  if (typeof document === 'undefined') return;
  if (!document.head.querySelector('link[data-main-ui-view-node]')) {
    try {
      const linkEl = document.createElement('link');
      linkEl.rel = 'stylesheet';
      linkEl.setAttribute('data-main-ui-view-node', '');
      linkEl.href = new URL('./view-flow.css', import.meta.url).href;
      document.head.appendChild(linkEl);
    } catch {
      // 宿主环境不支持 import.meta.url 相对解析时静默降级（仅剩主题化外观规则）
    }
  }
  if (document.head.querySelector('style[data-main-ui-view-node]')) return;
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-main-ui-view-node', '');
  styleEl.textContent = [
    // 默认节点/连边的呈现收敛到主题变量（不引内核 theme-default，避免硬编码色值进包）
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

export const NodeView = defineComponent({
  name: 'NodeView',
  props: {
    /** 节点数据（宿主适配层转成契约形态后注入） */
    nodes: { type: Array as PropType<NodeGraphData[]>, default: () => [] },
    /** 连边数据 */
    edges: { type: Array as PropType<NodeGraphEdgeData[]>, default: () => [] },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    /** 是否允许拖拽节点/拉线（选择恒可用） */
    editable: { type: Boolean, default: true },
    editorInstanceId: { type: String, default: null },
  },
  emits: ['node-move-intent', 'node-connect-intent', 'selection'],
  setup(props, { emit }) {
    // ---------- 内核实例（按编辑实例隔离画布状态） ----------
    const flowId = `main-ui-view-node-${props.editorInstanceId ?? 'default'}`;
    const { getViewport, setViewport } = useVueFlow({ id: flowId });

    let destroyed = false;
    const mounted = ref(false);
    const pendingViewport = ref<NodeViewport | null>(null);
    const selectedNodeIds = ref<string[]>([]);

    // ---------- 契约数据 → 内核形态（去重 + 悬空边剔除） ----------
    const flowNodes = computed<FlowNode[]>(() => dedupeById(props.nodes ?? []).map((node) => ({
      id: node.id,
      type: 'default',
      position: { x: node.position?.x ?? 0, y: node.position?.y ?? 0 },
      data: { label: node.label ?? node.id, ...(node.data ?? {}) },
    })));

    const flowEdges = computed<FlowEdge[]>(() => {
      const nodeIds = new Set(flowNodes.value.map((node) => node.id));
      return pruneDanglingEdges(dedupeById(props.edges ?? []), nodeIds).map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: 'default',
      }));
    });

    // ---------- 操作意图（一律经 Emits 抛出，由宿主裁决） ----------
    const onNodeDragStop = (event: NodeDragEvent) => {
      const payload: NodeMoveIntentPayload = {
        nodeId: event.node.id,
        position: { x: event.node.position.x, y: event.node.position.y },
      };
      emit('node-move-intent', payload);
    };

    const onConnect = (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const payload: NodeConnectIntentPayload = { source: connection.source, target: connection.target };
      emit('node-connect-intent', payload);
    };

    const syncSelection = (nodes: GraphNode[]) => {
      selectedNodeIds.value = nodes.filter((node) => node.selected).map((node) => node.id);
      const payload: NodeSelectionPayload = { nodeIds: [...selectedNodeIds.value] };
      emit('selection', payload);
    };

    const onNodeClick = (event: NodeMouseEvent) => {
      selectedNodeIds.value = [event.node.id];
      emit('selection', { nodeIds: [event.node.id] } satisfies NodeSelectionPayload);
    };

    // ---------- 视图生命周期契约（四成员，onDestroy 幂等） ----------
    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-node',
      getViewState: (): NodeViewState => ({
        viewport: normalizeViewport(getViewport()),
        selectedNodeIds: [...selectedNodeIds.value],
      }),
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<NodeViewState>;
        const viewport = normalizeViewport(snapshot.viewport);
        if (mounted.value) {
          void setViewport(viewport);
        } else {
          pendingViewport.value = viewport;
        }
        if (Array.isArray(snapshot.selectedNodeIds)) {
          selectedNodeIds.value = snapshot.selectedNodeIds.filter((id): id is string => typeof id === 'string');
        }
      },
      onDestroy: () => {
        destroyed = true;
      },
    };
    if (props.editorInstanceId) {
      useViewLifecycle(props.editorInstanceId, () => lifecycle);
    }

    onMounted(() => {
      ensureFlowStyles();
      mounted.value = true;
      if (pendingViewport.value) {
        void setViewport(pendingViewport.value);
        pendingViewport.value = null;
      }
    });

    // ---------- 渲染（颜色全部消费 --mui-* 变量） ----------
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
          minZoom: 0.1,
          maxZoom: 4,
          fitViewOnInit: true,
          onNodeDragStop,
          onConnect,
          onNodeClick,
          onSelectionChange: (params: { nodes: GraphNode[] }) => syncSelection(params.nodes),
        }),
      ]);
    };
  },
});
