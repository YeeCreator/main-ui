import { defineComponent, h, type Component, type PropType } from 'vue';
import { defaultEditorCapability, defaultTabPresentation, type EditorDescriptor } from 'main-ui/core';
import { ConsoleView } from './ConsoleView';
import type { ConsoleEntry } from './types';

export const CONSOLE_VIEW_EDITOR_KIND = 'view-console';
export const CONSOLE_VIEW_RENDERER_KEY = 'view-console-editor';

/** 结构化 runtime 类型（避免模板包耦合 main-ui 内部实现）。 */
export type ConsoleViewRuntimeLike = {
  core: { registerEditor: (descriptor: EditorDescriptor) => void };
  vue: { registerEditorRenderer: (rendererKey: string, component: Component) => void };
};

export type ConsoleViewEditorOptions = {
  kind?: string;
  title?: string;
  description?: string;
  icon?: string;
  rendererKey?: string;
  allowedWorkspaceIds: string[];
  allowFloatingWindow?: boolean;
};

export const createConsoleViewEditorDescriptor = (options: ConsoleViewEditorOptions): EditorDescriptor => ({
  kind: options.kind ?? CONSOLE_VIEW_EDITOR_KIND,
  title: options.title ?? 'Console',
  description: options.description ?? 'Virtual-scroll console/log stream view template.',
  icon: options.icon ?? 'terminal',
  rendererKey: options.rendererKey ?? CONSOLE_VIEW_RENDERER_KEY,
  capability: { ...defaultEditorCapability, allowFloatingWindow: options.allowFloatingWindow ?? true },
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: options.allowedWorkspaceIds },
});

export type EditorRenderContextLike = {
  editor: { id: string; payload?: Record<string, unknown> };
};

type ConsoleViewPropsLike = {
  entries: ConsoleEntry[];
  loading?: boolean;
  error?: string | null;
  clearEnabled?: boolean;
  editorInstanceId?: string;
};

/**
 * 创建 main-ui editor renderer 适配器：把 EditorRenderContext 映射为控制台 Props。
 * `resolveProps` 为宿主适配层扩展点（取数/订阅日志流都在宿主侧完成）；
 * `extraProps` 用于转发事件监听等附加 props（如 onClearIntent）。
 */
export const createConsoleViewEditorRenderer = (
  resolveProps: (context: EditorRenderContextLike) => Omit<ConsoleViewPropsLike, 'editorInstanceId'> = (context) => ({
    entries: (context.editor.payload?.entries as ConsoleEntry[] | undefined) ?? [],
    loading: Boolean(context.editor.payload?.loading ?? false),
    error: (context.editor.payload?.error as string | undefined) ?? null,
    clearEnabled: Boolean(context.editor.payload?.clearEnabled ?? true),
  }),
  extraProps: (context: EditorRenderContextLike) => Record<string, unknown> = () => ({}),
): Component => defineComponent({
  name: 'ConsoleViewEditorAdapter',
  props: {
    context: { type: Object as PropType<EditorRenderContextLike>, required: true },
  },
  setup(props) {
    return () => h(ConsoleView, { ...resolveProps(props.context), ...extraProps(props.context), editorInstanceId: props.context.editor.id });
  },
});

/** 一键注册：editor descriptor + renderer。 */
export const registerConsoleViewEditor = (
  runtime: ConsoleViewRuntimeLike,
  options: ConsoleViewEditorOptions,
  resolveProps?: Parameters<typeof createConsoleViewEditorRenderer>[0],
  extraProps?: Parameters<typeof createConsoleViewEditorRenderer>[1],
): EditorDescriptor => {
  const descriptor = createConsoleViewEditorDescriptor(options);
  runtime.core.registerEditor(descriptor);
  runtime.vue.registerEditorRenderer(descriptor.rendererKey, createConsoleViewEditorRenderer(resolveProps, extraProps));
  return descriptor;
};
