/**
 * mainUiEditor —— viewport-2d-kit 的 main-ui 薄连接器。
 *
 * 定位（对齐 V3D = three.js 内核 + 薄壳的架构）：
 *   - 渲染内核：`viewport-2d-kit/pixi` 的 `PixiViewport`（pixi.js 高性能渲染，
 *     相机、坐标换算、交互全部由内核唯一管理）。
 *   - 薄壳：本组件只提供"能放进 main-ui 标签页的窗口外观"——标题/描述/状态徽标
 *     DOM 外壳 + 把 demo 业务数据画进 pixi world 容器。连接器不承载渲染实现。
 *   - 注册：`registerViewportMainUiEditor` 一键注册 editor descriptor + renderer。
 */
import { computed, defineComponent, h, ref, watch, type PropType } from 'vue';
import { Graphics, Text } from 'pixi.js';
import { PixiViewportCanvas } from '../pixi/PixiViewportCanvas';
import type { PixiViewport } from '../pixi/PixiViewport';

export type ViewportMainUiViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ViewportMainUiNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tone?: 'blue' | 'green' | 'gold' | 'pink' | 'gray';
};

export type ViewportMainUiEdge = {
  source: string;
  target: string;
};

export type ViewportMainUiEditorPayload = {
  title?: string;
  description?: string;
  viewBox?: ViewportMainUiViewBox;
  minScale?: number;
  maxScale?: number;
  paddingPx?: number;
  nodes?: ViewportMainUiNode[];
  edges?: ViewportMainUiEdge[];
};

export type MainUiLikeEditorContext = {
  editor?: {
    payload?: Record<string, unknown>;
  };
  tab?: {
    title?: string;
  };
};

const DEFAULT_VIEWBOX: ViewportMainUiViewBox = {
  x: -160,
  y: -120,
  width: 680,
  height: 420,
};

const DEFAULT_NODES: ViewportMainUiNode[] = [
  { id: 'source', label: 'Source', x: -20, y: 20, width: 128, height: 56, tone: 'blue' },
  { id: 'editor', label: 'Viewport editor', x: 200, y: 100, width: 160, height: 56, tone: 'green' },
  { id: 'runtime', label: 'Main-ui tab', x: 380, y: -30, width: 138, height: 56, tone: 'gold' },
  { id: 'overlay', label: 'Overlay', x: 140, y: 240, width: 120, height: 56, tone: 'pink' },
];

const DEFAULT_EDGES: ViewportMainUiEdge[] = [
  { source: 'source', target: 'editor' },
  { source: 'editor', target: 'runtime' },
  { source: 'editor', target: 'overlay' },
];

const TONE_FILL: Record<string, string> = {
  blue: '#d9ebff',
  green: '#dcfce7',
  gold: '#fef3c7',
  pink: '#fce7f3',
  gray: '#e5e7eb',
};

function toneToColor(tone?: string): number {
  const hex = TONE_FILL[tone ?? 'gray'] ?? TONE_FILL.gray;
  return parseInt(hex.slice(1), 16);
}

/**
 * 把 demo 节点/边绘制进 pixi world 容器（世界坐标）。
 * 这是“薄连接器”的示范：连接器本身不承载渲染，只把数据画进 pixi 内核。
 */
function drawDemoWorld(viewport: PixiViewport, nodes: ViewportMainUiNode[], edges: ViewportMainUiEdge[]): void {
  const world = viewport.world;
  world.removeChildren();

  const nodesById = new Map<string, ViewportMainUiNode>();
  for (const node of nodes) {
    nodesById.set(node.id, node);
  }

  // 边：单 Graphics 多线段
  const edgeGraphics = new Graphics();
  for (const edge of edges) {
    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);
    if (!source || !target) continue;
    edgeGraphics.moveTo(source.x + source.width / 2, source.y + source.height / 2);
    edgeGraphics.lineTo(target.x + target.width / 2, target.y + target.height / 2);
  }
  edgeGraphics.stroke({ width: 2, color: 0x64748b, alpha: 0.9 });
  world.addChild(edgeGraphics);

  // 节点：圆角矩形 + 居中文本
  for (const node of nodes) {
    const box = new Graphics();
    box.roundRect(node.x, node.y, node.width, node.height, 8);
    box.fill(toneToColor(node.tone));
    box.stroke({ width: 1, color: 0x475569 });
    world.addChild(box);

    const label = new Text({
      text: node.label,
      style: { fontSize: 12, fill: '#1e293b', fontFamily: 'inherit' },
    });
    label.anchor.set(0.5);
    label.position.set(node.x + node.width / 2, node.y + node.height / 2);
    world.addChild(label);
  }
}

const ROOT_STYLE = {
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  gap: '8px',
  padding: '10px',
  boxSizing: 'border-box',
};

const HEADER_STYLE = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '8px',
};

const STAGE_STYLE = {
  minHeight: 0,
  border: '1px solid #d7dbe3',
  borderRadius: '8px',
  overflow: 'hidden',
  background: '#f8fafc',
};

const TITLE_STYLE = {
  margin: 0,
  fontSize: '14px',
  fontWeight: '600',
};

const DESCRIPTION_STYLE = {
  margin: '4px 0 0',
  fontSize: '12px',
  color: '#475569',
};

const BADGE_STYLE = {
  fontSize: '11px',
  color: '#334155',
  background: '#e2e8f0',
  borderRadius: '999px',
  padding: '4px 8px',
  whiteSpace: 'nowrap',
};

export const ViewportMainUiEditor = defineComponent({
  name: 'ViewportMainUiEditor',
  props: {
    context: {
      type: Object as PropType<MainUiLikeEditorContext>,
      required: true,
    },
  },
  setup(props) {
    const pointerStatus = ref('pointer: idle');

    const payload = computed(() => {
      const raw = props.context?.editor?.payload;
      return (raw ?? {}) as ViewportMainUiEditorPayload;
    });

    const title = computed(() => {
      if (payload.value.title) return payload.value.title;
      const hostTitle = props.context?.tab?.title;
      if (hostTitle && hostTitle.trim().length > 0) {
        return `${hostTitle} viewport`;
      }
      return 'Viewport 2D editor';
    });
    const description = computed(
      () => payload.value.description ?? 'Vue + core viewport surface that can be mounted in any main-ui tab.',
    );

    const viewBox = computed(() => payload.value.viewBox ?? DEFAULT_VIEWBOX);
    const minScale = computed(() => payload.value.minScale ?? 0.25);
    const maxScale = computed(() => payload.value.maxScale ?? 4);
    const paddingPx = computed(() => payload.value.paddingPx ?? 56);

    const nodes = computed(() => {
      if (Array.isArray(payload.value.nodes) && payload.value.nodes.length > 0) {
        return payload.value.nodes;
      }
      return DEFAULT_NODES;
    });

    const edges = computed(() => {
      if (Array.isArray(payload.value.edges) && payload.value.edges.length > 0) {
        return payload.value.edges;
      }
      return DEFAULT_EDGES;
    });

    const nodesById = computed(() => {
      const map = new Map<string, ViewportMainUiNode>();
      for (const node of nodes.value) {
        map.set(node.id, node);
      }
      return map;
    });

    const drawableEdges = computed(() => {
      return edges.value.flatMap((edge) => {
        const source = nodesById.value.get(edge.source);
        const target = nodesById.value.get(edge.target);
        if (!source || !target) {
          return [] as Array<{ source: ViewportMainUiNode; target: ViewportMainUiNode }>;
        }
        return [{ source, target }];
      });
    });

    let lastViewport: PixiViewport | null = null;

    function redrawWorld(viewport: PixiViewport | null): void {
      if (!viewport) return;
      lastViewport = viewport;
      drawDemoWorld(viewport, nodes.value, edges.value);
    }

    function onPixiReady(viewport: PixiViewport): void {
      redrawWorld(viewport);
      // 薄壳只做状态展示：把 canvas 指针位置反映到状态徽标
      viewport.app.canvas.addEventListener('pointermove', (event: PointerEvent) => {
        const rect = viewport.app.canvas.getBoundingClientRect();
        pointerStatus.value = `pointer: ${Math.round(event.clientX - rect.left)}, ${Math.round(event.clientY - rect.top)}`;
      });
    }

    // payload 中的 nodes/edges 变化时重绘 world（薄壳不缓存业务数据）
    watch([nodes, edges], () => {
      redrawWorld(lastViewport);
    });

    return () =>
      h('div', { style: ROOT_STYLE }, [
        h('div', { style: HEADER_STYLE }, [
          h('div', [h('h3', { style: TITLE_STYLE }, title.value), h('p', { style: DESCRIPTION_STYLE }, description.value)]),
          h('span', { style: BADGE_STYLE }, pointerStatus.value),
        ]),
        h(
          'div',
          { style: STAGE_STYLE },
          h(PixiViewportCanvas, {
            viewBox: viewBox.value,
            minScale: minScale.value,
            maxScale: maxScale.value,
            paddingPx: paddingPx.value,
            background: 0xf8fafc,
            onReady: onPixiReady,
          }),
        ),
      ]);
  },
});

export const VIEWPORT_MAIN_UI_EDITOR_KIND = 'viewport-2d-editor';
export const VIEWPORT_MAIN_UI_RENDERER_KEY = 'viewport-main-ui-editor';

export type ViewportMainUiCompatibleEditorDescriptor = {
  kind: string;
  title: string;
  description?: string;
  icon?: string;
  rendererKey: string;
  createDefaultPayload?: () => Record<string, unknown>;
  capability: {
    allowCreate: boolean;
    allowDuplicate: boolean;
    allowMultipleInstances: boolean;
    allowMultipleSurfacesPerInstance: boolean;
    allowClose: boolean;
    allowReorderInGroup: boolean;
    allowMoveAcrossGroups: boolean;
    allowSplitDrop: boolean;
    allowPopoutWindow: boolean;
    allowFloatingWindow: boolean;
    allowModalOverlay: boolean;
    allowMirrorDisplay: boolean;
    launcherVisibility: 'visible' | 'hidden' | 'hidden-when-opened';
  };
  presentation: {
    defaultSurface: 'tab' | 'modal-overlay';
    modalVariant?: 'centered-modal' | 'anchored-popover';
    canPromoteModalToTab: boolean;
  };
  availability: {
    allowedWorkspaceIds: string[];
  };
};

export type ViewportMainUiEditorDescriptorOptions = {
  kind?: string;
  title?: string;
  description?: string;
  icon?: string;
  rendererKey?: string;
  allowedWorkspaceIds: string[];
  defaultPayload?: ViewportMainUiEditorPayload;
};

export type MainUiRuntimeLike = {
  core: {
    registerEditor: (descriptor: ViewportMainUiCompatibleEditorDescriptor) => void;
  };
  vue: {
    registerEditorRenderer: (rendererKey: string, component: unknown) => void;
  };
};

export function createViewportMainUiEditorDescriptor(
  options: ViewportMainUiEditorDescriptorOptions,
): ViewportMainUiCompatibleEditorDescriptor {
  const kind = options.kind ?? VIEWPORT_MAIN_UI_EDITOR_KIND;
  const rendererKey = options.rendererKey ?? VIEWPORT_MAIN_UI_RENDERER_KEY;

  return {
    kind,
    title: options.title ?? 'Viewport 2D',
    description: options.description ?? 'Generic Vue viewport editor for main-ui tabs.',
    icon: options.icon ?? 'map',
    rendererKey,
    createDefaultPayload: options.defaultPayload
      ? () => ({ ...(options.defaultPayload as Record<string, unknown>) })
      : undefined,
    capability: {
      allowCreate: true,
      allowDuplicate: true,
      allowMultipleInstances: true,
      allowMultipleSurfacesPerInstance: false,
      allowClose: true,
      allowReorderInGroup: true,
      allowMoveAcrossGroups: true,
      allowSplitDrop: true,
      allowPopoutWindow: false,
      allowFloatingWindow: false,
      allowModalOverlay: false,
      allowMirrorDisplay: false,
      launcherVisibility: 'visible',
    },
    presentation: {
      defaultSurface: 'tab',
      canPromoteModalToTab: false,
    },
    availability: {
      allowedWorkspaceIds: options.allowedWorkspaceIds,
    },
  };
}

export function registerViewportMainUiEditor(
  runtime: MainUiRuntimeLike,
  options: ViewportMainUiEditorDescriptorOptions,
): ViewportMainUiCompatibleEditorDescriptor {
  const descriptor = createViewportMainUiEditorDescriptor(options);
  runtime.core.registerEditor(descriptor);
  runtime.vue.registerEditorRenderer(descriptor.rendererKey, ViewportMainUiEditor);
  return descriptor;
}
