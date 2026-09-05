import { defineComponent, h, type Component, type PropType } from 'vue';
import { defaultEditorCapability, defaultTabPresentation, type EditorDescriptor } from 'main-ui/core';
import { WorldView } from './WorldView';
import type { EntitySnapshot, GridSpec, ViewBox } from './types';

export const WORLD_VIEW_EDITOR_KIND = 'view-world';
export const WORLD_VIEW_RENDERER_KEY = 'view-world-editor';

export type WorldViewRuntimeLike = {
  core: { registerEditor: (descriptor: EditorDescriptor) => void };
  vue: { registerEditorRenderer: (rendererKey: string, component: Component) => void };
};

export type WorldViewEditorOptions = {
  kind?: string;
  title?: string;
  description?: string;
  icon?: string;
  rendererKey?: string;
  allowedWorkspaceIds: string[];
  allowFloatingWindow?: boolean;
};

export const createWorldViewEditorDescriptor = (options: WorldViewEditorOptions): EditorDescriptor => ({
  kind: options.kind ?? WORLD_VIEW_EDITOR_KIND,
  title: options.title ?? 'World',
  description: options.description ?? '2D world visualization (auto-render EntitySnapshot primitives or manual onReady escape hatch).',
  icon: options.icon ?? 'preview',
  rendererKey: options.rendererKey ?? WORLD_VIEW_RENDERER_KEY,
  capability: { ...defaultEditorCapability, allowFloatingWindow: options.allowFloatingWindow ?? true },
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: options.allowedWorkspaceIds },
});

export type WorldEditorRenderContextLike = {
  editor: { id: string; payload?: Record<string, unknown> };
};

type WorldViewPropsLike = {
  snapshot: EntitySnapshot | null;
  grid: GridSpec | null;
  viewBox: ViewBox | null;
  interactive: boolean;
  panOnDrag: boolean;
  loading?: boolean;
  error?: string | null;
  editorInstanceId?: string;
};

export const createWorldViewEditorRenderer = (
  resolveProps: (context: WorldEditorRenderContextLike) => Omit<WorldViewPropsLike, 'editorInstanceId'> = (context) => ({
    snapshot: (context.editor.payload?.snapshot as EntitySnapshot) ?? null,
    grid: (context.editor.payload?.grid as GridSpec) ?? null,
    viewBox: (context.editor.payload?.viewBox as ViewBox) ?? null,
    interactive: Boolean(context.editor.payload?.interactive ?? true),
    panOnDrag: Boolean(context.editor.payload?.panOnDrag ?? false),
    loading: Boolean(context.editor.payload?.loading ?? false),
    error: (context.editor.payload?.error as string) ?? null,
  }),
  extraProps: (context: WorldEditorRenderContextLike) => Record<string, unknown> = () => ({}),
): Component => defineComponent({
  name: 'WorldViewEditorAdapter',
  props: { context: { type: Object as PropType<WorldEditorRenderContextLike>, required: true } },
  setup(props) {
    return () => h(WorldView, { ...resolveProps(props.context), ...extraProps(props.context), editorInstanceId: props.context.editor.id });
  },
});

export const registerWorldViewEditor = (
  runtime: WorldViewRuntimeLike,
  options: WorldViewEditorOptions,
  resolveProps?: Parameters<typeof createWorldViewEditorRenderer>[0],
  extraProps?: Parameters<typeof createWorldViewEditorRenderer>[1],
): EditorDescriptor => {
  const descriptor = createWorldViewEditorDescriptor(options);
  runtime.core.registerEditor(descriptor);
  runtime.vue.registerEditorRenderer(descriptor.rendererKey, createWorldViewEditorRenderer(resolveProps, extraProps));
  return descriptor;
};
