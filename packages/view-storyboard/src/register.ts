import { defineComponent, h, type Component, type PropType } from 'vue';
import { defaultEditorCapability, defaultTabPresentation, type EditorDescriptor } from 'main-ui/core';
import { StoryboardView } from './StoryboardView';
import type { StoryboardCard } from './types';

export const STORYBOARD_VIEW_EDITOR_KIND = 'view-storyboard';
export const STORYBOARD_VIEW_RENDERER_KEY = 'view-storyboard-editor';

/** 结构化 runtime 类型（避免模板包耦合 main-ui 内部实现）。 */
export type StoryboardViewRuntimeLike = {
  core: { registerEditor: (descriptor: EditorDescriptor) => void };
  vue: { registerEditorRenderer: (rendererKey: string, component: Component) => void };
};

export type StoryboardViewEditorOptions = {
  kind?: string;
  title?: string;
  description?: string;
  icon?: string;
  rendererKey?: string;
  allowedWorkspaceIds: string[];
  allowFloatingWindow?: boolean;
};

export const createStoryboardViewEditorDescriptor = (options: StoryboardViewEditorOptions): EditorDescriptor => ({
  kind: options.kind ?? STORYBOARD_VIEW_EDITOR_KIND,
  title: options.title ?? 'Storyboard',
  description: options.description ?? 'Generic storyboard / capture-card annotation view template.',
  icon: options.icon ?? 'image',
  rendererKey: options.rendererKey ?? STORYBOARD_VIEW_RENDERER_KEY,
  capability: { ...defaultEditorCapability, allowFloatingWindow: options.allowFloatingWindow ?? true },
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: options.allowedWorkspaceIds },
});

export type EditorRenderContextLike = {
  editor: { id: string; payload?: Record<string, unknown> };
};

type StoryboardViewPropsLike = {
  cards: StoryboardCard[];
  draftNote?: string;
  addEnabled?: boolean;
  exportEnabled?: boolean;
  loading?: boolean;
  error?: string | null;
  editorInstanceId?: string;
};

/**
 * 创建 main-ui editor renderer 适配器：把 EditorRenderContext 映射为分镜 Props。
 * `resolveProps` 为宿主适配层扩展点（对接卡片缓冲与注释草稿）；
 * `extraProps` 用于转发事件监听等附加 props（如 onAddCard / onRemoveCard / onExport）。
 */
export const createStoryboardViewEditorRenderer = (
  resolveProps: (context: EditorRenderContextLike) => Omit<StoryboardViewPropsLike, 'editorInstanceId'> = (context) => ({
    cards: (context.editor.payload?.cards as StoryboardCard[] | undefined) ?? [],
    draftNote: (context.editor.payload?.draftNote as string | undefined) ?? '',
    addEnabled: Boolean(context.editor.payload?.addEnabled ?? true),
    exportEnabled: Boolean(context.editor.payload?.exportEnabled ?? true),
    loading: Boolean(context.editor.payload?.loading ?? false),
    error: (context.editor.payload?.error as string | undefined) ?? null,
  }),
  extraProps: (context: EditorRenderContextLike) => Record<string, unknown> = () => ({}),
): Component => defineComponent({
  name: 'StoryboardViewEditorAdapter',
  props: {
    context: { type: Object as PropType<EditorRenderContextLike>, required: true },
  },
  setup(props) {
    return () => h(StoryboardView, { ...resolveProps(props.context), ...extraProps(props.context), editorInstanceId: props.context.editor.id });
  },
});

/** 一键注册：editor descriptor + renderer。 */
export const registerStoryboardViewEditor = (
  runtime: StoryboardViewRuntimeLike,
  options: StoryboardViewEditorOptions,
  resolveProps?: Parameters<typeof createStoryboardViewEditorRenderer>[0],
  extraProps?: Parameters<typeof createStoryboardViewEditorRenderer>[1],
): EditorDescriptor => {
  const descriptor = createStoryboardViewEditorDescriptor(options);
  runtime.core.registerEditor(descriptor);
  runtime.vue.registerEditorRenderer(descriptor.rendererKey, createStoryboardViewEditorRenderer(resolveProps, extraProps));
  return descriptor;
};
