import { computed, defineComponent, h, type PropType } from 'vue';
import type { EditorRenderContext, GroupId, TabId } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';
import { ExternalMountHost } from './ExternalMountHost';
import { EditorErrorBoundary } from './EditorErrorBoundary';
import { MissingViewSurface } from './MissingViewSurface';

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

      // Slot 查找：未注册的 viewType 返回显式缺失结果，渲染快照降级占位而非丢弃节点。
      const slotLookup = runtime.core.slots.resolve(context.value.editor.kind);
      const descriptor = runtime.core.editors.get(context.value.editor.kind);
      if (!descriptor || slotLookup.status === 'missing') {
        return h(MissingViewSurface, {
          groupId: props.groupId,
          tabId: props.tabId,
          viewType: context.value.editor.kind,
          reason: 'unregistered-view',
        });
      }

      const renderer = runtime.vue.resolveEditorRenderer(descriptor.rendererKey);
      if (renderer) {
        return h('div', { class: 'main-ui-editor-surface', role: 'region', 'aria-label': descriptor.title }, [h(EditorErrorBoundary, { content: () => h(renderer, { context: context.value! }) })]);
      }

      const adapter = runtime.vue.resolveEditorMountAdapter(descriptor.rendererKey);
      if (adapter) {
        return h('div', { class: 'main-ui-editor-surface', role: 'region', 'aria-label': descriptor.title }, [h(ExternalMountHost, { adapter, context: context.value })]);
      }

      return h(MissingViewSurface, {
        groupId: props.groupId,
        tabId: props.tabId,
        viewType: descriptor.rendererKey,
        reason: 'missing-renderer',
      });
    };
  },
});
