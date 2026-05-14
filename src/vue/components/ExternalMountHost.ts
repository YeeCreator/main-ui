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
    let cleanup: void | (() => void);

    onMounted(() => {
      if (!container.value) {
        return;
      }
      cleanup = props.adapter.mount(container.value, props.context);
    });

    watch(() => props.context, (context) => {
      if (!container.value) {
        return;
      }
      props.adapter.update?.(container.value, context);
    });

    onBeforeUnmount(() => {
      cleanup?.();
      if (container.value) {
        props.adapter.unmount?.(container.value);
      }
    });

    return () => h('div', { ref: container, class: 'main-ui-external-mount-host' });
  },
});
