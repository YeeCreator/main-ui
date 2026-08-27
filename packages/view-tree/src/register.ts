import { defineComponent, h, type Component, type PropType } from 'vue';
import { defaultEditorCapability, defaultTabPresentation, type EditorDescriptor } from 'main-ui/core';
import { TreeView } from './TreeView';
import type { TreeViewProps, ViewTreeNode } from './types';

export const TREE_VIEW_EDITOR_KIND = 'view-tree';
export const TREE_VIEW_RENDERER_KEY = 'view-tree-editor';

/** 结构化 runtime 类型（避免模板包耦合 main-ui 内部实现）。 */
export type TreeViewRuntimeLike = {
  core: { registerEditor: (descriptor: EditorDescriptor) => void };
  vue: { registerEditorRenderer: (rendererKey: string, component: Component) => void };
};

export type TreeViewEditorOptions = {
  kind?: string;
  title?: string;
  description?: string;
  icon?: string;
  rendererKey?: string;
  allowedWorkspaceIds: string[];
  allowFloatingWindow?: boolean;
};

export const createTreeViewEditorDescriptor = (options: TreeViewEditorOptions): EditorDescriptor => ({
  kind: options.kind ?? TREE_VIEW_EDITOR_KIND,
  title: options.title ?? 'Tree',
  description: options.description ?? 'Virtual scrolling tree view template.',
  icon: options.icon ?? 'tree',
  rendererKey: options.rendererKey ?? TREE_VIEW_RENDERER_KEY,
  capability: { ...defaultEditorCapability, allowFloatingWindow: options.allowFloatingWindow ?? true },
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: options.allowedWorkspaceIds },
});

export type EditorRenderContextLike = {
  editor: { id: string; payload?: Record<string, unknown> };
};

/**
 * 创建 main-ui editor renderer 适配器：把 EditorRenderContext 映射为树视图 Props。
 * `resolveProps` 为宿主适配层扩展点（取数、结构转换都在宿主侧完成）；
 * `extraProps` 用于转发事件监听等附加 props（如 onSelect / onToggle）。
 */
export const createTreeViewEditorRenderer = (
  resolveProps: (context: EditorRenderContextLike) => Omit<TreeViewProps, 'editorInstanceId'> = (context) => ({
    items: (context.editor.payload?.items as ViewTreeNode[] | undefined) ?? [],
    loading: Boolean(context.editor.payload?.loading ?? false),
    error: (context.editor.payload?.error as string | undefined) ?? null,
    expandedIds: context.editor.payload?.expandedIds as string[] | undefined,
  }),
  extraProps: (context: EditorRenderContextLike) => Record<string, unknown> = () => ({}),
): Component => defineComponent({
  name: 'TreeViewEditorAdapter',
  props: {
    context: { type: Object as PropType<EditorRenderContextLike>, required: true },
  },
  setup(props) {
    return () => h(TreeView, { ...resolveProps(props.context), ...extraProps(props.context), editorInstanceId: props.context.editor.id });
  },
});

/** 一键注册：editor descriptor + renderer。 */
export const registerTreeViewEditor = (
  runtime: TreeViewRuntimeLike,
  options: TreeViewEditorOptions,
  resolveProps?: Parameters<typeof createTreeViewEditorRenderer>[0],
  extraProps?: Parameters<typeof createTreeViewEditorRenderer>[1],
): EditorDescriptor => {
  const descriptor = createTreeViewEditorDescriptor(options);
  runtime.core.registerEditor(descriptor);
  runtime.vue.registerEditorRenderer(descriptor.rendererKey, createTreeViewEditorRenderer(resolveProps, extraProps));
  return descriptor;
};
