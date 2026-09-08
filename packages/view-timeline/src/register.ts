import { defineComponent, h, type Component, type PropType } from 'vue';
import { defaultEditorCapability, defaultTabPresentation, type EditorDescriptor } from 'main-ui/core';
import { TimelineView } from './TimelineView';
import type { TimelineFrame } from './types';

export const TIMELINE_VIEW_EDITOR_KIND = 'view-timeline';
export const TIMELINE_VIEW_RENDERER_KEY = 'view-timeline-editor';

/** 结构化 runtime 类型（避免模板包耦合 main-ui 内部实现）。 */
export type TimelineViewRuntimeLike = {
  core: { registerEditor: (descriptor: EditorDescriptor) => void };
  vue: { registerEditorRenderer: (rendererKey: string, component: Component) => void };
};

export type TimelineViewEditorOptions = {
  kind?: string;
  title?: string;
  description?: string;
  icon?: string;
  rendererKey?: string;
  allowedWorkspaceIds: string[];
  allowFloatingWindow?: boolean;
};

export const createTimelineViewEditorDescriptor = (options: TimelineViewEditorOptions): EditorDescriptor => ({
  kind: options.kind ?? TIMELINE_VIEW_EDITOR_KIND,
  title: options.title ?? 'Timeline',
  description: options.description ?? 'Generic frame-sequence timeline / playback scrubber view template.',
  icon: options.icon ?? 'clock',
  rendererKey: options.rendererKey ?? TIMELINE_VIEW_RENDERER_KEY,
  capability: { ...defaultEditorCapability, allowFloatingWindow: options.allowFloatingWindow ?? true },
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: options.allowedWorkspaceIds },
});

export type EditorRenderContextLike = {
  editor: { id: string; payload?: Record<string, unknown> };
};

type TimelineViewPropsLike = {
  frames: TimelineFrame[];
  currentIndex: number | null;
  totalTicks?: number | null;
  liveLabel?: string;
  loading?: boolean;
  error?: string | null;
  editorInstanceId?: string;
};

/**
 * 创建 main-ui editor renderer 适配器：把 EditorRenderContext 映射为时间轴 Props。
 * `resolveProps` 为宿主适配层扩展点（对接回放帧缓冲与定位索引）；
 * `extraProps` 用于转发事件监听等附加 props（如 onSeek / onScrub / onLive）。
 */
export const createTimelineViewEditorRenderer = (
  resolveProps: (context: EditorRenderContextLike) => Omit<TimelineViewPropsLike, 'editorInstanceId'> = (context) => ({
    frames: (context.editor.payload?.frames as TimelineFrame[] | undefined) ?? [],
    currentIndex: (context.editor.payload?.currentIndex as number | null | undefined) ?? null,
    totalTicks: (context.editor.payload?.totalTicks as number | null | undefined) ?? null,
    loading: Boolean(context.editor.payload?.loading ?? false),
    error: (context.editor.payload?.error as string | undefined) ?? null,
  }),
  extraProps: (context: EditorRenderContextLike) => Record<string, unknown> = () => ({}),
): Component => defineComponent({
  name: 'TimelineViewEditorAdapter',
  props: {
    context: { type: Object as PropType<EditorRenderContextLike>, required: true },
  },
  setup(props) {
    return () => h(TimelineView, { ...resolveProps(props.context), ...extraProps(props.context), editorInstanceId: props.context.editor.id });
  },
});

/** 一键注册：editor descriptor + renderer。 */
export const registerTimelineViewEditor = (
  runtime: TimelineViewRuntimeLike,
  options: TimelineViewEditorOptions,
  resolveProps?: Parameters<typeof createTimelineViewEditorRenderer>[0],
  extraProps?: Parameters<typeof createTimelineViewEditorRenderer>[1],
): EditorDescriptor => {
  const descriptor = createTimelineViewEditorDescriptor(options);
  runtime.core.registerEditor(descriptor);
  runtime.vue.registerEditorRenderer(descriptor.rendererKey, createTimelineViewEditorRenderer(resolveProps, extraProps));
  return descriptor;
};
