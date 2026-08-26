import type { Component } from 'vue';
import { createMainUiCoreRuntime, type CoreRuntimeOptions, type MainUiCoreRuntime } from '../core/runtime';
import type { EditorRenderContext } from '../core/editor/types';
import type { EditorMountAdapter } from '../adapters';

export type MainUiRuntime = {
  core: MainUiCoreRuntime;
  vue: {
    registerEditorRenderer: (rendererKey: string, component: Component) => void;
    registerEditorMountAdapter: (rendererKey: string, adapter: EditorMountAdapter) => void;
    resolveEditorRenderer: (rendererKey: string) => Component | undefined;
    resolveEditorMountAdapter: (rendererKey: string) => EditorMountAdapter | undefined;
    renderers: ReadonlyMap<string, Component>;
    mountAdapters: ReadonlyMap<string, EditorMountAdapter>;
  };
};

export type CreateMainUiRuntimeOptions = CoreRuntimeOptions;

export const createMainUiRuntime = (options: CreateMainUiRuntimeOptions = {}): MainUiRuntime => {
  const core = createMainUiCoreRuntime(options);
  const renderers = new Map<string, Component>();
  const mountAdapters = new Map<string, EditorMountAdapter>();

  return {
    core,
    vue: {
      registerEditorRenderer(rendererKey, component) {
        renderers.set(rendererKey, component);
      },
      registerEditorMountAdapter(rendererKey, adapter) {
        mountAdapters.set(rendererKey, adapter);
      },
      resolveEditorRenderer(rendererKey) {
        return renderers.get(rendererKey);
      },
      resolveEditorMountAdapter(rendererKey) {
        return mountAdapters.get(rendererKey);
      },
      renderers,
      mountAdapters,
    },
  };
};

export type EditorMountAdapterContext = EditorRenderContext;
