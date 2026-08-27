import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type CSSProperties, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import type { ExternalEngineApi, HostEngineViewState } from './types';

/**
 * HostEngineView —— L3 外部引擎桥接视图（ExternalEngineHostView）。
 *
 * 提供纯净 DOM 挂载点 + 尺寸回调联动 + 生命周期对齐。
 * 模板零渲染零业务：不画任何内容，只做容器与通知。
 */
export const HostEngineView = defineComponent({
  name: 'HostEngineView',
  props: {
    engine: { type: Object as PropType<ExternalEngineApi | null>, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    editorInstanceId: { type: String, default: null },
  },
  setup(props) {
    const containerRef = ref<HTMLElement | null>(null);
    const containerWidth = ref(0);
    const containerHeight = ref(0);
    let resizeObserver: ResizeObserver | null = null;
    let destroyed = false;
    let mounted_engine: ExternalEngineApi | null = null;

    const mountEngine = () => {
      if (!containerRef.value || !props.engine) return;
      mounted_engine = props.engine;
      mounted_engine.mount(containerRef.value);
      containerWidth.value = containerRef.value.clientWidth;
      containerHeight.value = containerRef.value.clientHeight;
    };

    const unmountEngine = () => {
      mounted_engine?.destroy();
      mounted_engine = null;
    };

    onMounted(() => {
      mountEngine();
      if (containerRef.value && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            containerWidth.value = width;
            containerHeight.value = height;
            mounted_engine?.onResize(width, height);
          }
        });
        resizeObserver.observe(containerRef.value);
      }
    });

    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      unmountEngine();
    });

    // engine prop 变更：卸载旧引擎，挂载新引擎
    watch(() => props.engine, (newEngine, oldEngine) => {
      if (oldEngine) unmountEngine();
      if (newEngine && containerRef.value) mountEngine();
    });

    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-host-engine',
      getViewState: (): HostEngineViewState => ({
        containerWidth: containerWidth.value,
        containerHeight: containerHeight.value,
      }),
      restoreViewState: () => { /* 容器尺寸由 DOM 决定，无需恢复 */ },
      onDestroy: () => {
        destroyed = true;
        resizeObserver?.disconnect();
        resizeObserver = null;
        unmountEngine();
      },
    };
    if (props.editorInstanceId) {
      useViewLifecycle(props.editorInstanceId, () => lifecycle);
    }

    const rootStyle: CSSProperties = {
      width: '100%', height: '100%', overflow: 'hidden',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
    };

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-host-engine', style: { ...rootStyle, display: 'grid', placeItems: 'center' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-host-engine', style: { ...rootStyle, display: 'grid', placeItems: 'center', color: 'var(--mui-color-danger)' } }, props.error);
      }
      return h('div', {
        ref: containerRef,
        class: 'main-ui-view-host-engine',
        style: rootStyle,
      });
    };
  },
});
