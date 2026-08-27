import { defineComponent, h, type Component, type PropType } from 'vue';
import { defaultEditorCapability, defaultTabPresentation, type EditorDescriptor } from 'main-ui/core';
import { FlowView } from './FlowView';
import type { FlowDocument } from './types';

export const FLOW_VIEW_EDITOR_KIND = 'view-flow';
export const FLOW_VIEW_RENDERER_KEY = 'view-flow-editor';

export type FlowViewRuntimeLike = {
  core: { registerEditor: (descriptor: EditorDescriptor) => void };
  vue: { registerEditorRenderer: (rendererKey: string, component: Component) => void };
};

export type FlowViewEditorOptions = {
  kind?: string;
  title?: string;
  description?: string;
  icon?: string;
  rendererKey?: string;
  allowedWorkspaceIds: string[];
  allowFloatingWindow?: boolean;
};

export const createFlowViewEditorDescriptor = (options: FlowViewEditorOptions): EditorDescriptor => ({
  kind: options.kind ?? FLOW_VIEW_EDITOR_KIND,
  title: options.title ?? 'Flow Editor',
  description: options.description ?? 'Flow/state-machine document editor (vue-flow kernel + FSM layer).',
  icon: options.icon ?? 'workflow',
  rendererKey: options.rendererKey ?? FLOW_VIEW_RENDERER_KEY,
  capability: { ...defaultEditorCapability, allowFloatingWindow: options.allowFloatingWindow ?? true },
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: options.allowedWorkspaceIds },
});

export type FlowEditorRenderContextLike = {
  editor: { id: string; payload?: Record<string, unknown> };
};

type FlowViewPropsLike = {
  document: FlowDocument;
  loading?: boolean;
  error?: string | null;
  editable?: boolean;
  editorInstanceId?: string;
};

export const createFlowViewEditorRenderer = (
  resolveProps: (context: FlowEditorRenderContextLike) => Omit<FlowViewPropsLike, 'editorInstanceId'> = (context) => ({
    document: (context.editor.payload?.document as FlowDocument | undefined) ?? { nodes: [], edges: [], node_layouts: [] },
    loading: Boolean(context.editor.payload?.loading ?? false),
    error: (context.editor.payload?.error as string | undefined) ?? null,
    editable: Boolean(context.editor.payload?.editable ?? true),
  }),
  extraProps: (context: FlowEditorRenderContextLike) => Record<string, unknown> = () => ({}),
): Component => defineComponent({
  name: 'FlowViewEditorAdapter',
  props: {
    context: { type: Object as PropType<FlowEditorRenderContextLike>, required: true },
  },
  setup(props) {
    return () => h(FlowView, { ...resolveProps(props.context), ...extraProps(props.context), editorInstanceId: props.context.editor.id });
  },
});

export const registerFlowViewEditor = (
  runtime: FlowViewRuntimeLike,
  options: FlowViewEditorOptions,
  resolveProps?: Parameters<typeof createFlowViewEditorRenderer>[0],
  extraProps?: Parameters<typeof createFlowViewEditorRenderer>[1],
): EditorDescriptor => {
  const descriptor = createFlowViewEditorDescriptor(options);
  runtime.core.registerEditor(descriptor);
  runtime.vue.registerEditorRenderer(descriptor.rendererKey, createFlowViewEditorRenderer(resolveProps, extraProps));
  return descriptor;
};
