import { defineComponent, h, type Component, type PropType } from 'vue';
import { defaultEditorCapability, defaultTabPresentation, type EditorDescriptor } from 'main-ui/core';
import { AssetView } from './AssetView';
import type { AssetItem, AssetLayout } from './types';

export const ASSET_VIEW_EDITOR_KIND = 'view-asset';
export const ASSET_VIEW_RENDERER_KEY = 'view-asset-editor';

/** 结构化 runtime 类型（避免模板包耦合 main-ui 内部实现）。 */
export type AssetViewRuntimeLike = {
  core: { registerEditor: (descriptor: EditorDescriptor) => void };
  vue: { registerEditorRenderer: (rendererKey: string, component: Component) => void };
};

export type AssetViewEditorOptions = {
  kind?: string;
  title?: string;
  description?: string;
  icon?: string;
  rendererKey?: string;
  allowedWorkspaceIds: string[];
  allowFloatingWindow?: boolean;
};

export const createAssetViewEditorDescriptor = (options: AssetViewEditorOptions): EditorDescriptor => ({
  kind: options.kind ?? ASSET_VIEW_EDITOR_KIND,
  title: options.title ?? 'Assets',
  description: options.description ?? 'Generic asset grid / list view template with host-provided thumbnails.',
  icon: options.icon ?? 'files',
  rendererKey: options.rendererKey ?? ASSET_VIEW_RENDERER_KEY,
  capability: { ...defaultEditorCapability, allowFloatingWindow: options.allowFloatingWindow ?? true },
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: options.allowedWorkspaceIds },
});

export type EditorRenderContextLike = {
  editor: { id: string; payload?: Record<string, unknown> };
};

type AssetViewPropsLike = {
  items: AssetItem[];
  layout?: AssetLayout;
  selectedIds?: string[] | null;
  multiSelect?: boolean;
  filterable?: boolean;
  layoutSwitchable?: boolean;
  cardHeight?: number;
  loading?: boolean;
  error?: string | null;
  editorInstanceId?: string;
};

/**
 * 创建 main-ui editor renderer 适配器：把 EditorRenderContext 映射为资产 Props。
 *
 * `resolveProps` 是宿主适配层的扩展点（取数 → 转 `AssetItem[]`，含缩略图三态）；
 * `extraProps` 用于转发事件监听（如 `onSelect` / `onOpen` / `onSelection-change`）。
 */
export const createAssetViewEditorRenderer = (
  resolveProps: (context: EditorRenderContextLike) => Omit<AssetViewPropsLike, 'editorInstanceId'> = (context) => ({
    items: (context.editor.payload?.items as AssetItem[] | undefined) ?? [],
    layout: (context.editor.payload?.layout as AssetLayout | undefined) ?? 'grid',
    multiSelect: Boolean(context.editor.payload?.multiSelect ?? false),
    loading: Boolean(context.editor.payload?.loading ?? false),
    error: (context.editor.payload?.error as string | undefined) ?? null,
  }),
  extraProps: (context: EditorRenderContextLike) => Record<string, unknown> = () => ({}),
): Component => defineComponent({
  name: 'AssetViewEditorAdapter',
  props: {
    context: { type: Object as PropType<EditorRenderContextLike>, required: true },
  },
  setup(props) {
    // 展开 props 的静态类型对 Vue 的 h() 重载不够精确（可选项的 undefined 联合），
    // 这里显式断言为 VNode 可接受的 props 形状，避免误改渲染逻辑。
    return () => h(AssetView, {
      ...resolveProps(props.context),
      ...extraProps(props.context),
      editorInstanceId: props.context.editor.id,
    } as never);
  },
});

/** 一键注册：editor descriptor + renderer。 */
export const registerAssetViewEditor = (
  runtime: AssetViewRuntimeLike,
  options: AssetViewEditorOptions,
  resolveProps?: Parameters<typeof createAssetViewEditorRenderer>[0],
  extraProps?: Parameters<typeof createAssetViewEditorRenderer>[1],
): EditorDescriptor => {
  const descriptor = createAssetViewEditorDescriptor(options);
  runtime.core.registerEditor(descriptor);
  runtime.vue.registerEditorRenderer(descriptor.rendererKey, createAssetViewEditorRenderer(resolveProps, extraProps));
  return descriptor;
};
