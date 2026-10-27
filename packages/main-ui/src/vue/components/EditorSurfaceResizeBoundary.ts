import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import type { EditorInstanceId } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';

/**
 * 尺寸下发包装件。
 *
 * ## 为什么集中在这里，而不是每个模板自挂 `ResizeObserver`
 *
 * 尺寸是**布局层的已知事实**。让 N 个视图各自观察会带来三个具体问题：
 *
 * 1. **N 个观察器**：一个工作台同时挂十几个视图，就有十几个 `ResizeObserver`；
 * 2. **竞态**：首次尺寸与布局计算并行，视图可能先收到 0×0 再收到真实尺寸，
 *    表现为「图表先画成一像素再跳」；
 * 3. **口径不一**：有的视图观察内容盒、有的观察边框盒，减去 padding 与否各写各的。
 *
 * 因此由本组件统一观察、统一口径（content box），再经
 * `runtime.core.notifyViewResize()` 下发到视图的 `onResize`。
 *
 * ## 未实现 `onResize` 的视图
 *
 * 完全无影响 —— `notifyViewResize` 内部对未实现的句柄静默跳过。
 * 不实现 `onResize` 是合法选择，不该因此报警或降级。
 */
export const EditorSurfaceResizeBoundary = defineComponent({
  name: 'EditorSurfaceResizeBoundary',
  props: {
    editorInstanceId: {
      type: String as PropType<EditorInstanceId>,
      required: true,
    },
  },
  setup(props, { slots }) {
    const { runtime } = useWorkbench();
    const root = ref<HTMLElement | null>(null);
    let observer: ResizeObserver | null = null;
    let lastWidth = -1;
    let lastHeight = -1;

    /**
     * 下发尺寸。只在尺寸真正变化时发送，避免观察器的抖动触发无意义回调 ——
     * 视图可能在 `onResize` 里重排或重建纹理，重复调用是真实成本。
     */
    const emitSize = (width: number, height: number): void => {
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;
      runtime.core.notifyViewResize(props.editorInstanceId, width, height);
    };

    const measure = (): void => {
      const element = root.value;
      if (!element) return;
      emitSize(element.clientWidth, element.clientHeight);
    };

    onMounted(() => {
      measure();
      if (typeof ResizeObserver === 'undefined' || !root.value) return;
      observer = new ResizeObserver(() => measure());
      observer.observe(root.value);
    });

    // 实例切换（同一插槽换了视图）时重置基线，让新视图拿到首帧尺寸
    watch(() => props.editorInstanceId, () => {
      lastWidth = -1;
      lastHeight = -1;
      measure();
    });

    onBeforeUnmount(() => {
      observer?.disconnect();
      observer = null;
    });

    return () => h('div', {
      ref: root,
      class: 'main-ui-editor-surface__sizer',
      style: { width: '100%', height: '100%', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' },
    }, slots.default?.());
  },
});
