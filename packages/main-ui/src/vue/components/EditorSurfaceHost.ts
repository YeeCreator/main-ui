import { computed, defineComponent, h, type PropType } from 'vue';
import type { EditorRenderContext, GroupId, TabId } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';
import { ExternalMountHost } from './ExternalMountHost';
import { EditorErrorBoundary } from './EditorErrorBoundary';
import { EditorSurfaceResizeBoundary } from './EditorSurfaceResizeBoundary';
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
        // 尺寸经统一的包装件下发（content box），视图的 onResize 由 runtime 转发；
        // 未实现 onResize 的视图零影响。
        return h(EditorSurfaceResizeBoundary, { editorInstanceId: context.value.editor.id }, {
          default: () => h('div', { class: 'main-ui-editor-surface', role: 'region', 'aria-label': descriptor.title }, [
            h(EditorErrorBoundary, { content: () => h(renderer, { context: context.value! }) }),
          ]),
        });
      }

      const adapter = runtime.vue.resolveEditorMountAdapter(descriptor.rendererKey);
      if (adapter) {
        const mountContext = context.value;
        return h(EditorSurfaceResizeBoundary, { editorInstanceId: mountContext.editor.id }, {
          default: () => h('div', { class: 'main-ui-editor-surface', role: 'region', 'aria-label': descriptor.title }, [
            h(ExternalMountHost, { adapter, context: mountContext }),
          ]),
        });
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
