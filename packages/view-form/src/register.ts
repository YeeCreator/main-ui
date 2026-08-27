import { defineComponent, h, type Component, type PropType } from 'vue';
import { defaultEditorCapability, defaultTabPresentation, type EditorDescriptor } from 'main-ui/core';
import type { FormSchema, FormValues } from '@main-ui/core';
import { FormView } from './FormView';

export const FORM_VIEW_EDITOR_KIND = 'view-form';
export const FORM_VIEW_RENDERER_KEY = 'view-form-editor';

/** 结构化 runtime 类型（避免模板包耦合 main-ui 内部实现）。 */
export type FormViewRuntimeLike = {
  core: { registerEditor: (descriptor: EditorDescriptor) => void };
  vue: { registerEditorRenderer: (rendererKey: string, component: Component) => void };
};

export type FormViewEditorOptions = {
  kind?: string;
  title?: string;
  description?: string;
  icon?: string;
  rendererKey?: string;
  allowedWorkspaceIds: string[];
  allowFloatingWindow?: boolean;
};

export const createFormViewEditorDescriptor = (options: FormViewEditorOptions): EditorDescriptor => ({
  kind: options.kind ?? FORM_VIEW_EDITOR_KIND,
  title: options.title ?? 'Form',
  description: options.description ?? 'Schema driven form view template.',
  icon: options.icon ?? 'settings',
  rendererKey: options.rendererKey ?? FORM_VIEW_RENDERER_KEY,
  capability: { ...defaultEditorCapability, allowFloatingWindow: options.allowFloatingWindow ?? true },
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: options.allowedWorkspaceIds },
});

export type EditorRenderContextLike = {
  editor: { id: string; payload?: Record<string, unknown> };
};

type FormViewPropsLike = {
  schema: FormSchema;
  values: FormValues | null;
  loading?: boolean;
  error?: string | null;
  presets?: string[];
  presetsEnabled?: boolean;
  submitLabel?: string;
  editorInstanceId?: string;
};

/**
 * 创建 main-ui editor renderer 适配器：把 EditorRenderContext 映射为表单 Props。
 * `resolveProps` 为宿主适配层扩展点（取数、结构转换都在宿主侧完成）；
 * `extraProps` 用于转发事件监听等附加 props（如 onSubmit / onSavePresetIntent）。
 */
export const createFormViewEditorRenderer = (
  resolveProps: (context: EditorRenderContextLike) => Omit<FormViewPropsLike, 'editorInstanceId'> = (context) => ({
    schema: (context.editor.payload?.schema as FormSchema | undefined) ?? {},
    values: (context.editor.payload?.values as FormValues | undefined) ?? null,
    loading: Boolean(context.editor.payload?.loading ?? false),
    error: (context.editor.payload?.error as string | undefined) ?? null,
    presets: (context.editor.payload?.presets as string[] | undefined) ?? [],
  }),
  extraProps: (context: EditorRenderContextLike) => Record<string, unknown> = () => ({}),
): Component => defineComponent({
  name: 'FormViewEditorAdapter',
  props: {
    context: { type: Object as PropType<EditorRenderContextLike>, required: true },
  },
  setup(props) {
    return () => h(FormView, { ...resolveProps(props.context), ...extraProps(props.context), editorInstanceId: props.context.editor.id });
  },
});

/** 一键注册：editor descriptor + renderer。 */
export const registerFormViewEditor = (
  runtime: FormViewRuntimeLike,
  options: FormViewEditorOptions,
  resolveProps?: Parameters<typeof createFormViewEditorRenderer>[0],
  extraProps?: Parameters<typeof createFormViewEditorRenderer>[1],
): EditorDescriptor => {
  const descriptor = createFormViewEditorDescriptor(options);
  runtime.core.registerEditor(descriptor);
  runtime.vue.registerEditorRenderer(descriptor.rendererKey, createFormViewEditorRenderer(resolveProps, extraProps));
  return descriptor;
};
