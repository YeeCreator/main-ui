import { computed, defineComponent, h, ref, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import { PixiViewportCanvas, type PixiViewport, type PixiViewportCanvasExpose } from '@main-ui/viewport-2d-kit/pixi';
import type { Camera2D } from '@main-ui/viewport-2d-kit/core';
import { parseCssColorToNumber, sanitizeCameraState } from './view2d';
import { DEFAULT_VIEW_2D_VIEWBOX, type View2dCameraState, type View2dState, type View2dViewBox } from './types';

/**
 * View2dCanvas —— 2D 画布模板（2d-kit pixi 入口的 docking-ready 封装）。
 * 相机状态进 `getViewState`；世界绘制由宿主在 `ready` 事件拿到 viewport 后完成。
 * 根元素 100% × 100% + overflow hidden；DOM 颜色消费 --mui-* 变量。
 */
export const View2dCanvas = defineComponent({
  name: 'View2dCanvas',
  props: {
    viewBox: { type: Object as PropType<View2dViewBox>, default: () => ({ ...DEFAULT_VIEW_2D_VIEWBOX }) },
    minScale: { type: Number, default: 0.25 },
    maxScale: { type: Number, default: 4 },
    paddingPx: { type: Number, default: 56 },
    /** pixi 数值色；省略时读取 --mui-color-panel 计算（保持主题跟随） */
    background: { type: Number, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    editorInstanceId: { type: String, default: null },
  },
  emits: ['ready', 'camera-change'],
  setup(props, { emit }) {
    const canvasRef = ref<PixiViewportCanvasExpose | null>(null);
    const pendingCamera = ref<View2dCameraState | null>(null);
    let viewport: PixiViewport | null = null;
    let destroyed = false;

    // ---------- 背景色：未显式指定时消费主题变量 ----------
    const resolvedBackground = computed(() => {
      if (typeof props.background === 'number') return props.background;
      if (typeof document !== 'undefined') {
        const css = getComputedStyle(document.documentElement).getPropertyValue('--mui-color-panel');
        return parseCssColorToNumber(css) ?? 0xffffff;
      }
      return 0xffffff;
    });

    // ---------- pixi 就绪：回放待应用相机 + 抛出意图 ----------
    const onReady = (instance: PixiViewport) => {
      if (destroyed) return;
      viewport = instance;
      if (pendingCamera.value) {
        instance.setCamera(toCamera2D(pendingCamera.value));
        pendingCamera.value = null;
      }
      emit('ready', instance);
    };

    const onCameraChange = (camera: Camera2D) => {
      const state: View2dCameraState = { scale: camera.scale, pan: { x: camera.pan.x, y: camera.pan.y } };
      emit('camera-change', state);
    };

    const toCamera2D = (state: View2dCameraState): Camera2D => ({
      scale: state.scale,
      pan: { x: state.pan.x, y: state.pan.y },
    });

    // ---------- 视图生命周期契约（四成员，onDestroy 幂等；相机进快照） ----------
    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-2d',
      getViewState: (): View2dState => {
        const live = viewport?.getCamera();
        const camera = live
          ? { scale: live.scale, pan: { x: live.pan.x, y: live.pan.y } }
          : pendingCamera.value ?? { scale: 1, pan: { x: 0, y: 0 } };
        return { camera };
      },
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<View2dState>;
        const camera = sanitizeCameraState(snapshot.camera);
        if (!camera) return;
        if (viewport) {
          viewport.setCamera(toCamera2D(camera));
        } else {
          pendingCamera.value = camera; // pixi 异步初始化，就绪后回放
        }
      },
      onDestroy: () => {
        destroyed = true;
        viewport = null;
        pendingCamera.value = null;
      },
    };
    if (props.editorInstanceId) {
      useViewLifecycle(props.editorInstanceId, () => lifecycle);
    }

    const rootStyle = {
      width: '100%', height: '100%', overflow: 'hidden',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
    } as const;

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-2d', style: { ...rootStyle, display: 'grid', placeItems: 'center' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-2d', style: { ...rootStyle, display: 'grid', placeItems: 'center', color: 'var(--mui-color-danger)' } }, props.error);
      }
      return h('div', { class: 'main-ui-view-2d', style: rootStyle }, [
        h(PixiViewportCanvas, {
          ref: canvasRef,
          viewBox: props.viewBox,
          minScale: props.minScale,
          maxScale: props.maxScale,
          paddingPx: props.paddingPx,
          background: resolvedBackground.value,
          onReady: onReady,
          onCameraChange: onCameraChange,
        }),
      ]);
    };
  },
});
