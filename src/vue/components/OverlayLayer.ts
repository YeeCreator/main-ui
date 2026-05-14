import { computed, defineComponent, h } from 'vue';
import type { EditorRenderContext } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';
import { ExternalMountHost } from './ExternalMountHost';
import { renderIconToken } from './IconToken';

export const OverlayLayer = defineComponent({
  name: 'OverlayLayer',
  setup() {
    const { runtime, document, dispatch } = useWorkbench();
    const workspace = computed(() => document.value.workspaceStates[document.value.activeWorkspaceId]);

    const renderOverlayContent = (context: EditorRenderContext) => {
      const descriptor = runtime.core.editors.get(context.editor.kind);
      if (!descriptor) {
        return h('div', { class: 'main-ui-overlay__missing' }, 'Missing overlay descriptor');
      }

      const renderer = runtime.vue.resolveEditorRenderer(descriptor.rendererKey);
      if (renderer) {
        return h(renderer, { context });
      }

      const adapter = runtime.vue.resolveEditorMountAdapter(descriptor.rendererKey);
      if (adapter) {
        return h(ExternalMountHost, { adapter, context });
      }

      return h('div', { class: 'main-ui-overlay__missing' }, `Renderer missing: ${descriptor.rendererKey}`);
    };

    return () => {
      const overlays = Object.values(workspace.value.overlays);
      if (overlays.length === 0) {
        return null;
      }

      return h('div', { class: 'main-ui-overlay-layer' }, overlays.map((overlay) => {
        const editor = workspace.value.editors[overlay.editorInstanceId];
        if (!editor) {
          return null;
        }

        const context: EditorRenderContext = {
          editor,
          workspaceId: workspace.value.workspaceId,
        };

        return h('div', { class: 'main-ui-overlay-frame', key: overlay.id }, [
          overlay.showBackdrop ? h('button', {
            class: 'main-ui-overlay-backdrop',
            type: 'button',
            onClick: () => overlay.dismissOnOutsidePointerDown && void dispatch({ type: 'overlay/dismiss', overlayId: overlay.id, reason: 'outside-pointer' }),
          }) : null,
          h('section', {
            class: ['main-ui-overlay', `is-${overlay.presentation}`],
            style: {
              width: overlay.width ? `${overlay.width}px` : undefined,
              minHeight: overlay.height ? `${overlay.height}px` : undefined,
            },
          }, [
            h('div', { class: 'main-ui-overlay__bar' }, [
              h('strong', runtime.core.editors.get(editor.kind)?.title ?? editor.kind),
              h('div', { class: 'main-ui-overlay__actions' }, [
                overlay.canPromoteToTab ? h('button', {
                  class: 'main-ui-mini-button',
                  type: 'button',
                  title: 'Promote to tab',
                  onClick: () => void dispatch({ type: 'overlay/promoteToTab', overlayId: overlay.id }),
                }, [renderIconToken('tab')]) : null,
                h('button', {
                  class: 'main-ui-mini-button',
                  type: 'button',
                  title: 'Close overlay',
                  onClick: () => void dispatch({ type: 'overlay/dismiss', overlayId: overlay.id, reason: 'close-button' }),
                }, [renderIconToken('close')]),
              ]),
            ]),
            h('div', { class: 'main-ui-overlay__body' }, [renderOverlayContent(context)]),
          ]),
        ]);
      }));
    };
  },
});
