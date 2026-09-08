import { defineComponent, h, type Component, type PropType } from 'vue';
import { defaultEditorCapability, defaultTabPresentation, type EditorDescriptor } from 'main-ui/core';
import { RunControlView } from './RunControlView';
import type { RunControlAvailability } from './types';

export const RUN_CONTROL_VIEW_EDITOR_KIND = 'view-run-control';
export const RUN_CONTROL_VIEW_RENDERER_KEY = 'view-run-control-editor';

/** 结构化 runtime 类型（避免模板包耦合 main-ui 内部实现）。 */
export type RunControlViewRuntimeLike = {
  core: { registerEditor: (descriptor: EditorDescriptor) => void };
  vue: { registerEditorRenderer: (rendererKey: string, component: Component) => void };
};

export type RunControlViewEditorOptions = {
  kind?: string;
  title?: string;
  description?: string;
  icon?: string;
  rendererKey?: string;
  allowedWorkspaceIds: string[];
  allowFloatingWindow?: boolean;
};

export const createRunControlViewEditorDescriptor = (options: RunControlViewEditorOptions): EditorDescriptor => ({
  kind: options.kind ?? RUN_CONTROL_VIEW_EDITOR_KIND,
  title: options.title ?? 'Run Control',
  description: options.description ?? 'Generic run/pause/step/reset/rate control view template.',
  icon: options.icon ?? 'play',
  rendererKey: options.rendererKey ?? RUN_CONTROL_VIEW_RENDERER_KEY,
  capability: { ...defaultEditorCapability, allowFloatingWindow: options.allowFloatingWindow ?? true },
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: options.allowedWorkspaceIds },
});

export type EditorRenderContextLike = {
  editor: { id: string; payload?: Record<string, unknown> };
};

type RunControlViewPropsLike = {
  status: string;
  rate: number;
  tick: number;
  connected?: boolean;
  canReset?: boolean;
  rateEditable?: boolean;
  availability?: RunControlAvailability | null;
  loading?: boolean;
  error?: string | null;
  editorInstanceId?: string;
};

/**
 * 创建 main-ui editor renderer 适配器：把 EditorRenderContext 映射为运行控制 Props。
 * `resolveProps` 为宿主适配层扩展点（对接仿真后端的 status/rate/tick）；
 * `extraProps` 用于转发事件监听等附加 props（如 onPlay / onPause / onRateChange）。
 */
export const createRunControlViewEditorRenderer = (
  resolveProps: (context: EditorRenderContextLike) => Omit<RunControlViewPropsLike, 'editorInstanceId'> = (context) => ({
    status: (context.editor.payload?.status as string | undefined) ?? 'idle',
    rate: (context.editor.payload?.rate as number | undefined) ?? 1,
    tick: (context.editor.payload?.tick as number | undefined) ?? 0,
    connected: Boolean(context.editor.payload?.connected ?? true),
    canReset: Boolean(context.editor.payload?.canReset ?? true),
    rateEditable: Boolean(context.editor.payload?.rateEditable ?? true),
    availability: (context.editor.payload?.availability as RunControlAvailability | undefined) ?? null,
    loading: Boolean(context.editor.payload?.loading ?? false),
    error: (context.editor.payload?.error as string | undefined) ?? null,
  }),
  extraProps: (context: EditorRenderContextLike) => Record<string, unknown> = () => ({}),
): Component => defineComponent({
  name: 'RunControlViewEditorAdapter',
  props: {
    context: { type: Object as PropType<EditorRenderContextLike>, required: true },
  },
  setup(props) {
    return () => h(RunControlView, { ...resolveProps(props.context), ...extraProps(props.context), editorInstanceId: props.context.editor.id });
  },
});

/** 一键注册：editor descriptor + renderer。 */
export const registerRunControlViewEditor = (
  runtime: RunControlViewRuntimeLike,
  options: RunControlViewEditorOptions,
  resolveProps?: Parameters<typeof createRunControlViewEditorRenderer>[0],
  extraProps?: Parameters<typeof createRunControlViewEditorRenderer>[1],
): EditorDescriptor => {
  const descriptor = createRunControlViewEditorDescriptor(options);
  runtime.core.registerEditor(descriptor);
  runtime.vue.registerEditorRenderer(descriptor.rendererKey, createRunControlViewEditorRenderer(resolveProps, extraProps));
  return descriptor;
};
