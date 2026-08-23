import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import type { EditorRenderContext } from '../../core';
import type { EditorMountAdapter } from '../../adapters';

export const ExternalMountHost = defineComponent({
  name: 'ExternalMountHost',
  props: {
    adapter: {
      type: Object as PropType<EditorMountAdapter>,
      required: true,
    },
    context: {
      type: Object as PropType<EditorRenderContext>,
      required: true,
    },
  },
  setup(props) {
    const container = ref<HTMLElement | null>(null);
    const status = ref<'loading' | 'ready' | 'error'>('loading');
    const errorMessage = ref<string | null>(null);
    let cleanup: void | (() => void);
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const unmount = () => {
      if (timeout) clearTimeout(timeout);
      try { cleanup?.(); } catch { /* isolate adapter cleanup */ }
      try { if (container.value) props.adapter.unmount?.(container.value); } catch { /* isolate adapter cleanup */ }
      cleanup = undefined;
    };
    const mount = () => {
      unmount(); status.value = 'loading'; errorMessage.value = null;
      if (!container.value) return;
      try {
        timeout = setTimeout(() => { if (status.value === 'loading') { status.value = 'error'; errorMessage.value = 'Adapter mount timed out.'; unmount(); } }, props.adapter.timeoutMs ?? 10000);
        const result = props.adapter.mount(container.value, props.context);
        if (result instanceof Promise) {
          void result.then((resolved) => { if (status.value === 'loading') { cleanup = resolved; status.value = 'ready'; if (timeout) clearTimeout(timeout); } }).catch((error: unknown) => { status.value = 'error'; errorMessage.value = error instanceof Error ? error.message : String(error); if (timeout) clearTimeout(timeout); });
        } else {
          cleanup = result;
          status.value = 'ready';
          if (timeout) clearTimeout(timeout);
        }
      } catch (error) { status.value = 'error'; errorMessage.value = error instanceof Error ? error.message : String(error); }
    };

    onMounted(() => {
      if (!container.value) {
        return;
      }
      mount();
    });

    watch(() => props.context, (context) => {
      if (!container.value) {
        return;
      }
      try { props.adapter.update?.(container.value, context); } catch (error) { status.value = 'error'; errorMessage.value = error instanceof Error ? error.message : String(error); }
    });

    onBeforeUnmount(() => {
      unmount();
    });

    return () => h('div', { ref: container, class: ['main-ui-external-mount-host', `is-${status.value}`], role: 'region', 'aria-live': 'polite' }, status.value === 'error' ? [h('p', `Editor failed to load: ${errorMessage.value}`), h('button', { type: 'button', onClick: mount }, 'Retry')] : status.value === 'loading' ? [h('span', 'Loading…')] : []);
  },
});
