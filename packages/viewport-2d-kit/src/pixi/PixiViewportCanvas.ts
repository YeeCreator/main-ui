/**
 * PixiViewportCanvas —— pixi 内核的 Vue 视口组件（方案 B）。
 *
 * 与 Viewport2DCanvas（CSS transform + slot）不同，本组件内部挂载 PIXI.Application，
 * 通过 `@ready` 事件把 PixiViewport 交给调用方；调用方拿到 `world` 容器后往里加
 * 世界坐标的 Graphics/Sprite，相机由本组件唯一管理。
 */
import { defineComponent, h, onMounted, onUnmounted, ref, watch, type PropType } from 'vue';
import type { Camera2D, Vec2, ViewBox } from '../core/index';
import { PixiViewport } from './PixiViewport';

export type PixiViewportCanvasExpose = {
  getViewport: () => PixiViewport | null;
  getWorld: () => PixiViewport['world'] | null;
  getCamera: () => Camera2D | null;
  getSize: () => { width: number; height: number } | null;
  fitToBounds: () => void;
  setViewBox: (viewBox: ViewBox) => void;
  screenToWorld: (point: Vec2) => Vec2;
  worldToScreen: (point: Vec2) => Vec2;
  panBy: (deltaScreen: Vec2) => void;
  zoomAtScreenPoint: (factor: number, anchorScreen: Vec2) => void;
  isInteracting: () => boolean;
};

export const PixiViewportCanvas = defineComponent({
  name: 'PixiViewportCanvas',
  props: {
    viewBox: {
      type: Object as PropType<ViewBox>,
      required: true,
    },
    minScale: {
      type: Number,
      default: 0.2,
    },
    maxScale: {
      type: Number,
      default: 8,
    },
    paddingPx: {
      type: Number,
      default: 40,
    },
    background: {
      type: Number,
      default: 0xf5f2e9,
    },
    antialias: {
      type: Boolean,
      default: false,
    },
    resolution: {
      type: Number,
      default: undefined,
    },
    preserveDrawingBuffer: {
      type: Boolean,
      default: false,
    },
    disablePan: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    ready: (viewport: PixiViewport) => viewport instanceof PixiViewport,
    cameraChange: (camera: Camera2D) =>
      Number.isFinite(camera.scale) && Number.isFinite(camera.pan.x) && Number.isFinite(camera.pan.y),
    zoomPercentChange: (value: number) => Number.isFinite(value),
    interactingChange: (value: boolean) => typeof value === 'boolean',
  },
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLElement | null>(null);
    let viewport: PixiViewport | null = null;

    onMounted(async () => {
      const el = containerRef.value;
      if (!el) return;

      viewport = new PixiViewport(el, {
        viewBox: props.viewBox,
        minScale: props.minScale,
        maxScale: props.maxScale,
        paddingPx: props.paddingPx,
        background: props.background,
        antialias: props.antialias,
        resolution: props.resolution,
        preserveDrawingBuffer: props.preserveDrawingBuffer,
        disablePan: props.disablePan,
      });

      viewport.onCameraChange((camera) => {
        emit('cameraChange', camera);
        emit('zoomPercentChange', Math.round(camera.scale * 100));
      });
      viewport.onInteractingChange((value) => {
        emit('interactingChange', value);
      });

      await viewport.init();
      emit('ready', viewport);
    });

    onUnmounted(() => {
      viewport?.destroy();
      viewport = null;
    });

    // viewBox 响应式：外部切换世界范围时自动重新 fit。
    watch(
      () => props.viewBox,
      (next) => {
        viewport?.setViewBox(next);
      },
      { deep: true },
    );

    expose<PixiViewportCanvasExpose>({
      getViewport: () => viewport,
      getWorld: () => viewport?.world ?? null,
      getCamera: () => viewport?.getCamera() ?? null,
      getSize: () => viewport?.getSize() ?? null,
      fitToBounds: () => viewport?.fitToBounds(),
      setViewBox: (viewBox: ViewBox) => viewport?.setViewBox(viewBox),
      screenToWorld: (point: Vec2) => (viewport ? viewport.screenToWorld(point) : point),
      worldToScreen: (point: Vec2) => (viewport ? viewport.worldToScreen(point) : point),
      panBy: (deltaScreen: Vec2) => viewport?.panBy(deltaScreen),
      zoomAtScreenPoint: (factor: number, anchorScreen: Vec2) => viewport?.zoomAtScreenPoint(factor, anchorScreen),
      isInteracting: () => viewport?.isInteracting() ?? false,
    });

    return () => h('div', { ref: containerRef, class: 'viewport-2d-pixi-surface' });
  },
});
