import { defineComponent, h, type Component, type PropType } from 'vue';
import { defaultEditorCapability, defaultTabPresentation, type EditorDescriptor } from 'main-ui/core';
import { View2dCanvas } from './View2dCanvas';
import { DEFAULT_VIEW_2D_VIEWBOX, type View2dViewBox } from './types';

export const VIEW_2D_EDITOR_KIND = 'view-2d';
export const VIEW_2D_RENDERER_KEY = 'view-2d-editor';

/** 结构化 runtime 类型（避免模板包耦合 main-ui 内部实现）。 */
export type View2dRuntimeLike = {
  core: { registerEditor: (descriptor: EditorDescriptor) => void };
  vue: { registerEditorRenderer: (rendererKey: string, component: Component) => void };
};

export type View2dEditorOptions = {
  kind?: string;
  title?: string;
  description?: string;
  icon?: string;
  rendererKey?: string;
  allowedWorkspaceIds: string[];
  allowFloatingWindow?: boolean;
};

export const createView2dEditorDescriptor = (options: View2dEditorOptions): EditorDescriptor => ({
  kind: options.kind ?? VIEW_2D_EDITOR_KIND,
  title: options.title ?? '2D Canvas',
  description: options.description ?? 'Docking-ready 2D canvas template backed by viewport-2d-kit.',
  icon: options.icon ?? 'map',
  rendererKey: options.rendererKey ?? VIEW_2D_RENDERER_KEY,
  capability: { ...defaultEditorCapability, allowFloatingWindow: options.allowFloatingWindow ?? true },
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: options.allowedWorkspaceIds },
});

export type EditorRenderContextLike = {
  editor: { id: string; payload?: Record<string, unknown> };
};

type View2dPropsLike = {
  viewBox?: View2dViewBox;
  minScale?: number;
  maxScale?: number;
  paddingPx?: number;
  loading?: boolean;
  error?: string | null;
  editorInstanceId?: string;
};

/**
 * 创建 main-ui editor renderer 适配器：把 EditorRenderContext 映射为画布 Props。
 * `resolveProps` 为宿主适配层扩展点（取数都在宿主侧完成）；
 * `extraProps` 用于转发事件监听（如 onReady 绘制世界、onCameraChange）。
 */
export const createView2dEditorRenderer = (
  resolveProps: (context: EditorRenderContextLike) => Omit<View2dPropsLike, 'editorInstanceId'> = (context) => ({
    viewBox: (context.editor.payload?.viewBox as View2dViewBox | undefined) ?? DEFAULT_VIEW_2D_VIEWBOX,
    loading: Boolean(context.editor.payload?.loading ?? false),
    error: (context.editor.payload?.error as string | undefined) ?? null,
  }),
  extraProps: (context: EditorRenderContextLike) => Record<string, unknown> = () => ({}),
): Component => defineComponent({
  name: 'View2dEditorAdapter',
  props: {
    context: { type: Object as PropType<EditorRenderContextLike>, required: true },
  },
  setup(props) {
    return () => h(View2dCanvas, { ...resolveProps(props.context), ...extraProps(props.context), editorInstanceId: props.context.editor.id });
  },
});

/** 一键注册：editor descriptor + renderer。 */
export const registerView2dEditor = (
  runtime: View2dRuntimeLike,
  options: View2dEditorOptions,
  resolveProps?: Parameters<typeof createView2dEditorRenderer>[0],
  extraProps?: Parameters<typeof createView2dEditorRenderer>[1],
): EditorDescriptor => {
  const descriptor = createView2dEditorDescriptor(options);
  runtime.core.registerEditor(descriptor);
  runtime.vue.registerEditorRenderer(descriptor.rendererKey, createView2dEditorRenderer(resolveProps, extraProps));
  return descriptor;
};
