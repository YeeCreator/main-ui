import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted } from 'vue';
import { draftFromText } from '@main-ui/core/input';
import type { EditorRenderContext } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';
import { ExternalMountHost } from './ExternalMountHost';
import { renderIconToken } from './IconToken';

export const OverlayLayer = defineComponent({
  name: 'OverlayLayer',
  setup() {
    const { runtime, document, dispatch } = useWorkbench();
    const workspace = computed(() => document.value.workspaceStates[document.value.activeWorkspaceId]);

    /**
     * 叠加层关闭命令：`Escape` 曾是硬编码键名，改为命令 + 默认绑定后
     * 用户可在快捷键面板里改它，也与菜单入口一致。
     *
     * `Tab` 焦点陷阱保留为原生行为：它是可访问性保障（键盘用户离开模态无法操作），
     * 不应成为可改绑的对象。
     */
    const DISMISS_ID = 'main-ui.overlay.dismiss';
    if (!runtime.core.commands.get(DISMISS_ID)) {
      runtime.core.registerCommand({
        id: DISMISS_ID,
        title: '关闭叠加层',
        category: '视图',
        when: 'overlayActive',
        run: () => {
          const overlays = Object.values(workspace.value.overlays);
          const active = overlays.at(-1);
          if (!active) return;
          void dispatch({ type: 'overlay/dismiss', overlayId: active.id, reason: 'escape' });
        },
      });
      runtime.core.input.registerDefault({
        commandId: DISMISS_ID,
        id: `default:${DISMISS_ID}:0`,
        origin: 'default',
        ...draftFromText('press:Escape'),
        allowInInput: true,
        swallow: false,
      });
    }

    const onKeydown = (event: KeyboardEvent) => {
      const overlays = Object.values(workspace.value.overlays); const active = overlays.at(-1);
      if (active && event.key === 'Tab') { const target = event.target as HTMLElement; const frame = target.closest('.main-ui-overlay'); const focusable = frame ? Array.from(frame.querySelectorAll<HTMLElement>('button,input,select,textarea,[tabindex]:not([tabindex="-1"])')) : []; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (first && last && (event.shiftKey ? target === first : target === last)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); } }
    };
    onMounted(() => window.addEventListener('keydown', onKeydown));
    onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

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

      void nextTick(() => globalThis.document.querySelector<HTMLElement>('.main-ui-overlay input, .main-ui-overlay button')?.focus());
      return h('div', { class: 'main-ui-overlay-layer', role: 'presentation' }, overlays.map((overlay) => {
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
            role: 'dialog', 'aria-modal': 'true', 'aria-label': runtime.core.editors.get(editor.kind)?.title ?? editor.kind,
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
