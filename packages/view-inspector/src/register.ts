import { defineComponent, h, type Component, type PropType } from 'vue';
import { defaultEditorCapability, defaultTabPresentation, type EditorDescriptor } from 'main-ui/core';
import { InspectorView } from './InspectorView';
import type { InspectorSchema, InspectorValues } from './types';

export const INSPECTOR_VIEW_EDITOR_KIND = 'view-inspector';
export const INSPECTOR_VIEW_RENDERER_KEY = 'view-inspector-editor';

/** 结构化 runtime 类型（避免模板包耦合 main-ui 内部实现）。 */
export type InspectorViewRuntimeLike = {
  core: { registerEditor: (descriptor: EditorDescriptor) => void };
  vue: { registerEditorRenderer: (rendererKey: string, component: Component) => void };
};

export type InspectorViewEditorOptions = {
  kind?: string;
  title?: string;
  description?: string;
  icon?: string;
  rendererKey?: string;
  allowedWorkspaceIds: string[];
  allowFloatingWindow?: boolean;
};

export const createInspectorViewEditorDescriptor = (options: InspectorViewEditorOptions): EditorDescriptor => ({
  kind: options.kind ?? INSPECTOR_VIEW_EDITOR_KIND,
  title: options.title ?? 'Inspector',
  description: options.description ?? 'Schema-driven inspector form template.',
  icon: options.icon ?? 'inspector',
  rendererKey: options.rendererKey ?? INSPECTOR_VIEW_RENDERER_KEY,
  capability: { ...defaultEditorCapability, allowFloatingWindow: options.allowFloatingWindow ?? true },
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: options.allowedWorkspaceIds },
});

export type EditorRenderContextLike = {
  editor: { id: string; payload?: Record<string, unknown> };
};

/**
 * 创建 main-ui editor renderer 适配器：把 EditorRenderContext 映射为检查器 Props。
 * `resolveProps` 为宿主适配层扩展点（取数、结构转换都在宿主侧完成）；
 * `extraProps` 用于转发事件监听等附加 props（如 onChange）。
 */
export const createInspectorViewEditorRenderer = (
  resolveProps: (context: EditorRenderContextLike) => Omit<InspectorViewPropsLike, 'editorInstanceId'> = (context) => ({
    schema: (context.editor.payload?.schema as InspectorSchema | undefined) ?? [],
    values: (context.editor.payload?.values as InspectorValues | undefined) ?? null,
    loading: Boolean(context.editor.payload?.loading ?? false),
    error: (context.editor.payload?.error as string | undefined) ?? null,
  }),
  extraProps: (context: EditorRenderContextLike) => Record<string, unknown> = () => ({}),
): Component => defineComponent({
  name: 'InspectorViewEditorAdapter',
  props: {
    context: { type: Object as PropType<EditorRenderContextLike>, required: true },
  },
  setup(props) {
    return () => h(InspectorView, { ...resolveProps(props.context), ...extraProps(props.context), editorInstanceId: props.context.editor.id });
  },
});

type InspectorViewPropsLike = {
  schema: InspectorSchema;
  values?: InspectorValues | null;
  loading?: boolean;
  error?: string | null;
  editorInstanceId?: string;
};

/** 一键注册：editor descriptor + renderer。 */
export const registerInspectorViewEditor = (
  runtime: InspectorViewRuntimeLike,
  options: InspectorViewEditorOptions,
  resolveProps?: Parameters<typeof createInspectorViewEditorRenderer>[0],
  extraProps?: Parameters<typeof createInspectorViewEditorRenderer>[1],
): EditorDescriptor => {
  const descriptor = createInspectorViewEditorDescriptor(options);
  runtime.core.registerEditor(descriptor);
  runtime.vue.registerEditorRenderer(descriptor.rendererKey, createInspectorViewEditorRenderer(resolveProps, extraProps));
  return descriptor;
};
