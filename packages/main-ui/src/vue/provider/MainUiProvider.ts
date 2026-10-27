import { defineComponent, h, onBeforeUnmount, onMounted, provide, shallowRef, type PropType } from 'vue';
import { createDomInputSource } from '@main-ui/core/input';
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
    let disposeThemeMediaListener: (() => void) | undefined;
    let disposeInputSource: (() => void) | undefined;

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
      // system 主题模式：以 matchMedia 为唯一解析来源，随系统外观变化同步 resolvedMode。
      if (typeof window.matchMedia === 'function') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const syncSystemMode = () => {
          const snapshot = props.runtime.core.getSnapshot();
          if (snapshot.theme.mode !== 'system') return;
          const resolved = mediaQuery.matches ? 'dark' : 'light';
          if (snapshot.theme.resolvedMode !== resolved) {
            void dispatch({ type: 'theme/setMode', mode: 'system', resolvedMode: resolved });
          }
        };
        syncSystemMode();
        mediaQuery.addEventListener('change', syncSystemMode);
        disposeThemeMediaListener = () => mediaQuery.removeEventListener('change', syncSystemMode);
      }
      const onKeydown = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement | null;
        const scope =
          target?.closest('[data-main-ui-scope]')?.getAttribute('data-main-ui-scope') ??
          (target?.matches('input,textarea,select,[contenteditable="true"]') ? 'input' : 'workbench');
        props.runtime.core.setFocusScope(scope);
        // 输入框内是否仍匹配绑定，由绑定自己的 allowInInput 决定
        props.runtime.core.input.setInInput(
          Boolean(target?.matches('input,textarea,select,[contenteditable="true"]')),
        );
      };
      window.addEventListener('keydown', onKeydown, true);
      disposeKeyboardListener = () => window.removeEventListener('keydown', onKeydown, true);

      // DOM 输入源：按键 / 指针 / 滚轮 / Safari 手势统一归一为信号。
      // 挂载点选 window：绑定可声明 scope 收窄生效范围，
      // 因此不必在这里做元素级筛选。
      disposeInputSource = createDomInputSource({ target: window }).start((signal) => {
        props.runtime.core.feedInput(signal);
      });
    });

    onBeforeUnmount(() => {
      unsubscribe?.();
      disposeKeyboardListener?.();
      disposeThemeMediaListener?.();
      disposeInputSource?.();
    });

    return () => h('div', { class: 'main-ui-provider' }, slots.default?.());
  },
});
