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
    let disposeKeyboardListener: (() => void) | undefined;

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
      const onKeydown = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement | null;
        props.runtime.core.setFocusScope(target?.closest('[data-main-ui-scope]')?.getAttribute('data-main-ui-scope') ?? (target?.matches('input,textarea,select,[contenteditable="true"]') ? 'input' : 'workbench'));
        void props.runtime.core.handleKeydown(event);
      };
      window.addEventListener('keydown', onKeydown);
      disposeKeyboardListener = () => window.removeEventListener('keydown', onKeydown);
    });

    onBeforeUnmount(() => {
      unsubscribe?.();
      disposeKeyboardListener?.();
    });

    return () => h('div', { class: 'main-ui-provider' }, slots.default?.());
  },
});
