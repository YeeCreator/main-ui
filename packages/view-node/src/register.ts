import { defineComponent, h, type Component, type PropType } from 'vue';
import { defaultEditorCapability, defaultTabPresentation, type EditorDescriptor } from 'main-ui/core';
import { NodeView } from './NodeView';
import type { NodeGraphData, NodeGraphEdgeData } from './types';

export const NODE_VIEW_EDITOR_KIND = 'view-node';
export const NODE_VIEW_RENDERER_KEY = 'view-node-editor';

/** 结构化 runtime 类型（避免模板包耦合 main-ui 内部实现）。 */
export type NodeViewRuntimeLike = {
  core: { registerEditor: (descriptor: EditorDescriptor) => void };
  vue: { registerEditorRenderer: (rendererKey: string, component: Component) => void };
};

export type NodeViewEditorOptions = {
  kind?: string;
  title?: string;
  description?: string;
  icon?: string;
  rendererKey?: string;
  allowedWorkspaceIds: string[];
  allowFloatingWindow?: boolean;
};

export const createNodeViewEditorDescriptor = (options: NodeViewEditorOptions): EditorDescriptor => ({
  kind: options.kind ?? NODE_VIEW_EDITOR_KIND,
  title: options.title ?? 'Node Graph',
  description: options.description ?? 'Node/edge graph view template (vue-flow kernel).',
  icon: options.icon ?? 'preview',
  rendererKey: options.rendererKey ?? NODE_VIEW_RENDERER_KEY,
  capability: { ...defaultEditorCapability, allowFloatingWindow: options.allowFloatingWindow ?? true },
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: options.allowedWorkspaceIds },
});

export type EditorRenderContextLike = {
  editor: { id: string; payload?: Record<string, unknown> };
};

type NodeViewPropsLike = {
  nodes: NodeGraphData[];
  edges: NodeGraphEdgeData[];
  loading?: boolean;
  error?: string | null;
  editable?: boolean;
  editorInstanceId?: string;
};

/**
 * 创建 main-ui editor renderer 适配器：把 EditorRenderContext 映射为节点图 Props。
 * `resolveProps` 为宿主适配层扩展点（取数、结构转换都在宿主侧完成）；
 * `extraProps` 用于转发事件监听等附加 props（如 onNodeMoveIntent / onNodeConnectIntent）。
 */
export const createNodeViewEditorRenderer = (
  resolveProps: (context: EditorRenderContextLike) => Omit<NodeViewPropsLike, 'editorInstanceId'> = (context) => ({
    nodes: (context.editor.payload?.nodes as NodeGraphData[] | undefined) ?? [],
    edges: (context.editor.payload?.edges as NodeGraphEdgeData[] | undefined) ?? [],
    loading: Boolean(context.editor.payload?.loading ?? false),
    error: (context.editor.payload?.error as string | undefined) ?? null,
    editable: Boolean(context.editor.payload?.editable ?? true),
  }),
  extraProps: (context: EditorRenderContextLike) => Record<string, unknown> = () => ({}),
): Component => defineComponent({
  name: 'NodeViewEditorAdapter',
  props: {
    context: { type: Object as PropType<EditorRenderContextLike>, required: true },
  },
  setup(props) {
    return () => h(NodeView, { ...resolveProps(props.context), ...extraProps(props.context), editorInstanceId: props.context.editor.id });
  },
});

/** 一键注册：editor descriptor + renderer。 */
export const registerNodeViewEditor = (
  runtime: NodeViewRuntimeLike,
  options: NodeViewEditorOptions,
  resolveProps?: Parameters<typeof createNodeViewEditorRenderer>[0],
  extraProps?: Parameters<typeof createNodeViewEditorRenderer>[1],
): EditorDescriptor => {
  const descriptor = createNodeViewEditorDescriptor(options);
  runtime.core.registerEditor(descriptor);
  runtime.vue.registerEditorRenderer(descriptor.rendererKey, createNodeViewEditorRenderer(resolveProps, extraProps));
  return descriptor;
};
