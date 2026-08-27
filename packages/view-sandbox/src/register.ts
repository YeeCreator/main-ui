import { defineComponent, h, type Component, type PropType } from 'vue';
import { defaultEditorCapability, defaultTabPresentation, type EditorDescriptor } from 'main-ui/core';
import { SandboxView } from './SandboxView';
import type { SandboxDocument } from './types';

export const SANDBOX_VIEW_EDITOR_KIND = 'view-sandbox';
export const SANDBOX_VIEW_RENDERER_KEY = 'view-sandbox-editor';

export type SandboxViewRuntimeLike = {
  core: { registerEditor: (descriptor: EditorDescriptor) => void };
  vue: { registerEditorRenderer: (rendererKey: string, component: Component) => void };
};

export type SandboxViewEditorOptions = {
  kind?: string;
  title?: string;
  description?: string;
  icon?: string;
  rendererKey?: string;
  allowedWorkspaceIds: string[];
  allowFloatingWindow?: boolean;
};

export const createSandboxViewEditorDescriptor = (options: SandboxViewEditorOptions): EditorDescriptor => ({
  kind: options.kind ?? SANDBOX_VIEW_EDITOR_KIND,
  title: options.title ?? 'Sandbox',
  description: options.description ?? 'Free-form sandbox canvas (composite View with embedded sub-views).',
  icon: options.icon ?? 'preview',
  rendererKey: options.rendererKey ?? SANDBOX_VIEW_RENDERER_KEY,
  capability: { ...defaultEditorCapability, allowFloatingWindow: options.allowFloatingWindow ?? true },
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: options.allowedWorkspaceIds },
});

export type SandboxEditorRenderContextLike = {
  editor: { id: string; payload?: Record<string, unknown> };
};

type SandboxViewPropsLike = {
  document: SandboxDocument;
  loading?: boolean;
  error?: string | null;
  editable?: boolean;
  editorInstanceId?: string;
};

export const createSandboxViewEditorRenderer = (
  resolveProps: (context: SandboxEditorRenderContextLike) => Omit<SandboxViewPropsLike, 'editorInstanceId'> = (context) => ({
    document: (context.editor.payload?.document as SandboxDocument) ?? { elements: [], connections: [] },
    loading: Boolean(context.editor.payload?.loading ?? false),
    error: (context.editor.payload?.error as string) ?? null,
    editable: Boolean(context.editor.payload?.editable ?? true),
  }),
  extraProps: (context: SandboxEditorRenderContextLike) => Record<string, unknown> = () => ({}),
): Component => defineComponent({
  name: 'SandboxViewEditorAdapter',
  props: { context: { type: Object as PropType<SandboxEditorRenderContextLike>, required: true } },
  setup(props) {
    return () => h(SandboxView, { ...resolveProps(props.context), ...extraProps(props.context), editorInstanceId: props.context.editor.id });
  },
});

export const registerSandboxViewEditor = (
  runtime: SandboxViewRuntimeLike,
  options: SandboxViewEditorOptions,
  resolveProps?: Parameters<typeof createSandboxViewEditorRenderer>[0],
  extraProps?: Parameters<typeof createSandboxViewEditorRenderer>[1],
): EditorDescriptor => {
  const descriptor = createSandboxViewEditorDescriptor(options);
  runtime.core.registerEditor(descriptor);
  runtime.vue.registerEditorRenderer(descriptor.rendererKey, createSandboxViewEditorRenderer(resolveProps, extraProps));
  return descriptor;
};
