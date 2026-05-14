import { defineComponent, h, onBeforeUnmount, onMounted, provide, shallowRef, type PropType } from 'vue';
import type { WorkbenchDocument } from '../../core';
import { MainUiContextKey } from './context';
import type { MainUiRuntime } from '../runtime';

export const MainUiProvider = defineComponent({
  name: 'MainUiProvider',
  props: {
    runtime: {
      type: Object as PropType<MainUiRuntime>,
      required: true,
    },
  },
  setup(props, { slots }) {
    const document = shallowRef<WorkbenchDocument>(props.runtime.core.getSnapshot());
    let unsubscribe: (() => void) | undefined;

    const dispatch = async (action: Parameters<MainUiRuntime['core']['dispatch']>[0]) => {
      const result = await props.runtime.core.dispatch(action);
      if (result.ok) {
        document.value = result.value;
      }
      return result;
    };

    provide(MainUiContextKey, {
      runtime: props.runtime,
      document,
      dispatch,
    });

    onMounted(() => {
      unsubscribe = props.runtime.core.subscribe((snapshot) => {
        document.value = snapshot;
      });
      void props.runtime.core.boot();
    });

    onBeforeUnmount(() => {
      unsubscribe?.();
    });

    return () => h('div', { class: 'main-ui-provider' }, slots.default?.());
  },
});
