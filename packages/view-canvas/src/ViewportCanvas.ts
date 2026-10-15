/**
 * ViewportCanvas —— DOM/SVG 2D 画布视口（view-canvas 主组件）。
 *
 * 职责：管理相机（fit / 指针拖拽平移 / 滚轮以光标为锚点缩放）与容器尺寸，
 * 默认插槽向宿主暴露 `{ width, height, cameraTransform, scale, camera }`，
 * 宿主在插槽内自绘 SVG/DOM 世界内容（用 `cameraTransform` 施加相机变换）。
 *
 * 取代已废弃的 `viewport-2d-kit/vue` 的 `Viewport2DCanvas`；相机数学基于
 * `@main-ui/core/rendering`（原 viewport-2d-kit 吸收后的官方基座）。
 */
import { computed, defineComponent, h, onBeforeUnmount, onMounted, reactive, ref, type CSSProperties, type PropType, type VNode } from 'vue';
import {
  screenToWorld,
  worldToScreen,
  type Camera2D,
  type Vec2,
  type ViewBox,
} from '@main-ui/core/rendering';
import type { ViewportCanvasExpose, ViewportContainerSize } from './types';
import { ZOOM_STEP, cameraTransformOf, fitCamera, panCamera, zoomByFactor, wheelZoomFactor } from './viewport-state';

export const ViewportCanvas = defineComponent({
  name: 'ViewportCanvas',
  props: {
    /** 世界范围（相机 fit 目标）。 */
    viewBox: { type: Object as PropType<ViewBox>, required: true },
    minScale: { type: Number, default: 0.2 },
    maxScale: { type: Number, default: 4 },
    paddingPx: { type: Number, default: 40 },
    /** 禁止左键拖拽平移（宿主用左键做框选等时置 true）。 */
    disablePan: { type: Boolean, default: false },
    /** 是否启用滚轮缩放。默认 true。 */
    zoomOnWheel: { type: Boolean, default: true },
  },
  emits: {
    zoomPercentChange: (value: number) => Number.isFinite(value),
    interactingChange: (value: boolean) => typeof value === 'boolean',
    cameraChange: (value: Camera2D, size: ViewportContainerSize) =>
      Number.isFinite(value.scale) && Number.isFinite(value.pan.x) && Number.isFinite(value.pan.y)
      && Number.isFinite(size.width) && Number.isFinite(size.height),
  },
  setup(props, { emit, expose, slots }) {
    const containerRef = ref<HTMLElement | null>(null);
    const containerSize = reactive<ViewportContainerSize>({ width: 0, height: 0 });
    const camera = ref<Camera2D>({ scale: 1, pan: { x: 0, y: 0 } });

    const pointerState = reactive({ pointerId: -1, lastX: 0, lastY: 0, active: false });
    let resizeObserver: ResizeObserver | null = null;

    const cameraTransform = computed(() => cameraTransformOf(camera.value));

    /** 对外发布相机快照（纯值复制，避免把响应式 Proxy 交给宿主）。 */
    const snapshotCamera = (): Camera2D => ({ ...camera.value, pan: { ...camera.value.pan } });

    const publishCamera = (): void => {
      emit('zoomPercentChange', Math.round(camera.value.scale * 100));
      emit('cameraChange', snapshotCamera(), { width: containerSize.width, height: containerSize.height });
    };

    const applyCamera = (next: Camera2D, publish = true): void => {
      camera.value = next;
      if (publish) publishCamera();
    };

    const fitToBounds = (): void => {
      const next = fitCamera(containerSize, props.viewBox, props.paddingPx, props.minScale, props.maxScale);
      if (next) applyCamera(next);
    };

    const zoomIn = (): void => applyCamera(zoomByFactor(camera.value, containerSize, ZOOM_STEP, null, props.minScale, props.maxScale));
    const zoomOut = (): void => applyCamera(zoomByFactor(camera.value, containerSize, 1 / ZOOM_STEP, null, props.minScale, props.maxScale));

    const toLocalPoint = (event: PointerEvent | WheelEvent): Vec2 | null => {
      const el = containerRef.value;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 || props.disablePan) return;
      pointerState.pointerId = event.pointerId;
      pointerState.lastX = event.clientX;
      pointerState.lastY = event.clientY;
      pointerState.active = true;
      emit('interactingChange', true);
      containerRef.value?.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!pointerState.active || pointerState.pointerId !== event.pointerId || props.disablePan) return;
      const dx = event.clientX - pointerState.lastX;
      const dy = event.clientY - pointerState.lastY;
      pointerState.lastX = event.clientX;
      pointerState.lastY = event.clientY;
      applyCamera(panCamera(camera.value, { x: dx, y: dy }));
    };

    const finishPointer = (event: PointerEvent): void => {
      if (pointerState.pointerId !== event.pointerId) return;
      pointerState.pointerId = -1;
      pointerState.active = false;
      emit('interactingChange', false);
    };

    const onWheel = (event: WheelEvent): void => {
      if (!props.zoomOnWheel || !containerRef.value) return;
      event.preventDefault();
      const anchor = toLocalPoint(event);
      applyCamera(zoomByFactor(camera.value, containerSize, wheelZoomFactor(event.deltaY), anchor, props.minScale, props.maxScale));
    };

    const updateContainerSize = (): void => {
      const el = containerRef.value;
      if (!el) return;
      containerSize.width = el.clientWidth;
      containerSize.height = el.clientHeight;
    };

    onMounted(() => {
      updateContainerSize();
      fitToBounds();
      const el = containerRef.value;
      if (!el) return;
      resizeObserver = new ResizeObserver(() => {
        updateContainerSize();
        fitToBounds();
      });
      resizeObserver.observe(el);
      el.addEventListener('pointerdown', onPointerDown);
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', finishPointer);
      el.addEventListener('pointercancel', finishPointer);
      el.addEventListener('wheel', onWheel, { passive: false });
    });

    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      const el = containerRef.value;
      if (!el) return;
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', finishPointer);
      el.removeEventListener('pointercancel', finishPointer);
      el.removeEventListener('wheel', onWheel);
    });

    expose<ViewportCanvasExpose>({
      fitToBounds,
      zoomIn,
      zoomOut,
      getCamera: snapshotCamera,
      setCamera: (next) => {
        const constrained = zoomByFactor(next, containerSize, 1, { x: 0, y: 0 }, props.minScale, props.maxScale);
        // factor=1 保持锚点等价于保持 pan 语义；直接约束 scale 后再回填 pan 更直观
        applyCamera({ scale: constrained.scale, pan: { x: next.pan.x, y: next.pan.y } });
      },
      screenToWorld: (point) => screenToWorld(camera.value, point),
      worldToScreen: (point) => worldToScreen(camera.value, point),
      getSize: () => ({ width: containerSize.width, height: containerSize.height }),
    });

    const surfaceStyle: CSSProperties = { position: 'relative', width: '100%', height: '100%', overflow: 'hidden' };

    return () => {
      const children: VNode[] = slots.default
        ? slots.default({
            width: containerSize.width,
            height: containerSize.height,
            cameraTransform: cameraTransform.value,
            scale: camera.value.scale,
            camera: snapshotCamera(),
          })
        : [];
      return h('div', { ref: containerRef, class: 'viewport-2d-surface', style: surfaceStyle }, children);
    };
  },
});
