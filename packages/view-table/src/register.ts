import { defineComponent, h, type Component, type PropType } from 'vue';
import { defaultEditorCapability, defaultTabPresentation, type EditorDescriptor } from 'main-ui/core';
import { TableView } from './TableView';
import type { TableColumn, TableRow, TableSort } from './types';

export const TABLE_VIEW_EDITOR_KIND = 'view-table';
export const TABLE_VIEW_RENDERER_KEY = 'view-table-editor';

/** 结构化 runtime 类型（避免模板包耦合 main-ui 内部实现）。 */
export type TableViewRuntimeLike = {
  core: { registerEditor: (descriptor: EditorDescriptor) => void };
  vue: { registerEditorRenderer: (rendererKey: string, component: Component) => void };
};

export type TableViewEditorOptions = {
  kind?: string;
  title?: string;
  description?: string;
  icon?: string;
  rendererKey?: string;
  allowedWorkspaceIds: string[];
  allowFloatingWindow?: boolean;
};

export const createTableViewEditorDescriptor = (options: TableViewEditorOptions): EditorDescriptor => ({
  kind: options.kind ?? TABLE_VIEW_EDITOR_KIND,
  title: options.title ?? 'Table',
  description: options.description ?? 'Virtual scrolling table view template.',
  icon: options.icon ?? 'table',
  rendererKey: options.rendererKey ?? TABLE_VIEW_RENDERER_KEY,
  capability: { ...defaultEditorCapability, allowFloatingWindow: options.allowFloatingWindow ?? true },
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: options.allowedWorkspaceIds },
});

export type EditorRenderContextLike = {
  editor: { id: string; payload?: Record<string, unknown> };
};

type TableViewPropsLike = {
  columns: TableColumn[];
  rows: TableRow[];
  rowKey?: string;
  sort?: TableSort;
  editable?: boolean;
  loading?: boolean;
  error?: string | null;
  editorInstanceId?: string;
};

/**
 * 创建 main-ui editor renderer 适配器：把 EditorRenderContext 映射为表格 Props。
 * `resolveProps` 为宿主适配层扩展点（取数、结构转换都在宿主侧完成）；
 * `extraProps` 用于转发事件监听等附加 props（如 onCellEditIntent）。
 */
export const createTableViewEditorRenderer = (
  resolveProps: (context: EditorRenderContextLike) => Omit<TableViewPropsLike, 'editorInstanceId'> = (context) => ({
    columns: (context.editor.payload?.columns as TableColumn[] | undefined) ?? [],
    rows: (context.editor.payload?.rows as TableRow[] | undefined) ?? [],
    rowKey: (context.editor.payload?.rowKey as string | undefined) ?? 'id',
    loading: Boolean(context.editor.payload?.loading ?? false),
    error: (context.editor.payload?.error as string | undefined) ?? null,
  }),
  extraProps: (context: EditorRenderContextLike) => Record<string, unknown> = () => ({}),
): Component => defineComponent({
  name: 'TableViewEditorAdapter',
  props: {
    context: { type: Object as PropType<EditorRenderContextLike>, required: true },
  },
  setup(props) {
    return () => h(TableView, { ...resolveProps(props.context), ...extraProps(props.context), editorInstanceId: props.context.editor.id });
  },
});

/** 一键注册：editor descriptor + renderer。 */
export const registerTableViewEditor = (
  runtime: TableViewRuntimeLike,
  options: TableViewEditorOptions,
  resolveProps?: Parameters<typeof createTableViewEditorRenderer>[0],
  extraProps?: Parameters<typeof createTableViewEditorRenderer>[1],
): EditorDescriptor => {
  const descriptor = createTableViewEditorDescriptor(options);
  runtime.core.registerEditor(descriptor);
  runtime.vue.registerEditorRenderer(descriptor.rendererKey, createTableViewEditorRenderer(resolveProps, extraProps));
  return descriptor;
};
