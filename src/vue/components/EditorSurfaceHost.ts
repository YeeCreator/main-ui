import { computed, defineComponent, h, type PropType } from 'vue';
import type { EditorRenderContext, GroupId, TabId } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';
import { ExternalMountHost } from './ExternalMountHost';

export const EditorSurfaceHost = defineComponent({
  name: 'EditorSurfaceHost',
  props: {
    groupId: {
      type: String as PropType<GroupId>,
      required: true,
    },
    tabId: {
      type: String as PropType<TabId>,
      required: true,
    },
  },
  setup(props) {
    const { runtime, document } = useWorkbench();
    const context = computed<EditorRenderContext | null>(() => {
      const workspace = document.value.workspaceStates[document.value.activeWorkspaceId];
      const tab = workspace.tabs[props.tabId];
      const editor = tab ? workspace.editors[tab.editorInstanceId] : undefined;
      if (!tab || !editor) {
        return null;
      }
      return {
        editor,
        tab,
        workspaceId: workspace.workspaceId,
      };
    });

    return () => {
      if (!context.value) {
        return h('div', { class: 'main-ui-editor-surface main-ui-editor-surface--missing' }, 'Missing editor');
      }

      const descriptor = runtime.core.editors.get(context.value.editor.kind);
      if (!descriptor) {
        return h('div', { class: 'main-ui-editor-surface main-ui-editor-surface--missing' }, `Unregistered editor: ${context.value.editor.kind}`);
      }

      const renderer = runtime.vue.resolveEditorRenderer(descriptor.rendererKey);
      if (renderer) {
        return h('div', { class: 'main-ui-editor-surface' }, [h(renderer, { context: context.value })]);
      }

      const adapter = runtime.vue.resolveEditorMountAdapter(descriptor.rendererKey);
      if (adapter) {
        return h('div', { class: 'main-ui-editor-surface' }, [h(ExternalMountHost, { adapter, context: context.value })]);
      }

      return h('div', { class: 'main-ui-editor-surface main-ui-editor-surface--missing' }, `Renderer missing: ${descriptor.rendererKey}`);
    };
  },
});
