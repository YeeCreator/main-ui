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
  DEFAULT_TAP_TOLERANCE_PX,
  createPointerGestureTracker,
  screenToWorld,
  worldToScreen,
  type Camera2D,
  type Vec2,
  type ViewBox,
} from '@main-ui/core/rendering';
import { detectEnvironment, resolveShellPolicy } from '@main-ui/core/environment';
import type { ViewportCanvasExpose, ViewportContainerSize } from './types';
import {
  ZOOM_STEP,
  cameraTransformOf,
  classifyWheel,
  fitCamera,
  panCamera,
  pinchZoomFactor,
  wheelPanDelta,
  wheelZoomFactor,
  zoomByFactor,
} from './viewport-state';

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
    /**
     * 轻点容差（CSS 像素）：位移不超过该值才算「轻点」，此时不建立指针捕获，
     * 宿主在画布子元素上的原生 `click` 照常命中；越过容差即拖拽，捕获接管，
     * 原生 `click` 被重定向到容器（因此「拖动平移」不会误触发宿主的背景 click）。
     */
    tapTolerancePx: { type: Number, default: DEFAULT_TAP_TOLERANCE_PX },
    /** 是否启用滚轮缩放。默认 true。 */
    zoomOnWheel: { type: Boolean, default: true },
    /** 是否启用内置原生手势隔离（user-select / preventDefault）。缺省取环境 ShellPolicy。 */
    nativeGestureGuard: { type: Boolean as PropType<boolean | null>, default: null },
    /** 是否右键抑制原生菜单（缺省取 ShellPolicy.suppressContextMenu）。 */
    suppressContextMenu: { type: Boolean as PropType<boolean | null>, default: null },
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

    /** 环境策略（单一真相源）：浏览器/Electron 差异由此统一解析，无需下游各自判断。 */
    const shellPolicy = resolveShellPolicy(detectEnvironment());
    const gestureGuard = computed(() => props.nativeGestureGuard ?? shellPolicy.canvasGestureGuard);
    const contextMenuGuard = computed(() => props.suppressContextMenu ?? shellPolicy.suppressContextMenu);

    const pointerState = reactive({ pointerId: -1, lastX: 0, lastY: 0, active: false, captured: false });
    const gesture = createPointerGestureTracker({ tolerancePx: props.tapTolerancePx });
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
      if (gestureGuard.value) event.preventDefault();
      pointerState.pointerId = event.pointerId;
      pointerState.lastX = event.clientX;
      pointerState.lastY = event.clientY;
      pointerState.active = true;
      pointerState.captured = false;
      gesture.down({ x: event.clientX, y: event.clientY });
      emit('interactingChange', true);
      // 注意：**不在此处**建立指针捕获。捕获会把原生 click 重定向到容器，
      // 使宿主在画布子元素（如背景 rect、节点）上的 @click 全部失效。
      // 捕获改在「越过轻点容差」时建立，见 onPointerMove。
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!pointerState.active || pointerState.pointerId !== event.pointerId) return;
      const dx = event.clientX - pointerState.lastX;
      const dy = event.clientY - pointerState.lastY;
      pointerState.lastX = event.clientX;
      pointerState.lastY = event.clientY;

      if (props.disablePan) return;

      // 越过容差才算拖拽：此刻建立捕获，使拖出容器仍能续上平移，
      // 同时把随后的原生 click 重定向到容器（不误触背景 click）。
      if (!pointerState.captured && gesture.move({ x: event.clientX, y: event.clientY })) {
        pointerState.captured = true;
        containerRef.value?.setPointerCapture(event.pointerId);
      }

      applyCamera(panCamera(camera.value, { x: dx, y: dy }));
    };

    const finishPointer = (event: PointerEvent): void => {
      if (pointerState.pointerId !== event.pointerId) return;
      const el = containerRef.value;
      if (pointerState.captured && el?.hasPointerCapture?.(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
      pointerState.pointerId = -1;
      pointerState.active = false;
      pointerState.captured = false;
      gesture.reset();
      emit('interactingChange', false);
    };

    const onWheel = (event: WheelEvent): void => {
      if (!containerRef.value) return;
      const gesture = classifyWheel(event);
      // 触控板双指平移：不缩放，改为平移视口（鼠标滚轮永远不会走到这里）。
      if (gesture === 'pan') {
        event.preventDefault();
        applyCamera(panCamera(camera.value, wheelPanDelta({ deltaX: event.deltaX, deltaY: event.deltaY })));
        return;
      }
      if (!props.zoomOnWheel) return;
      event.preventDefault();
      const anchor = toLocalPoint(event);
      // 捏合与鼠标滚轮用不同灵敏度：捏合 deltaY 只有 ±1..±30，套滚轮系数会「几乎没反应」。
      const factor = gesture === 'pinch' ? pinchZoomFactor(event.deltaY) : wheelZoomFactor(event.deltaY);
      applyCamera(zoomByFactor(camera.value, containerSize, factor, anchor, props.minScale, props.maxScale));
    };

    const onContextMenu = (event: MouseEvent): void => {
      if (contextMenuGuard.value) event.preventDefault();
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
      // 兜底：未越过容差时不建捕获，指针可能在元素外抬起（pointerup 到不了 el）。
      // 窗口级监听保证交互状态一定归零，避免 active 卡在 true 后「悬停即平移」。
      window.addEventListener('pointerup', finishPointer);
      window.addEventListener('pointercancel', finishPointer);
      el.addEventListener('wheel', onWheel, { passive: false });
      el.addEventListener('contextmenu', onContextMenu);
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
      window.removeEventListener('pointerup', finishPointer);
      window.removeEventListener('pointercancel', finishPointer);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContextMenu);
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

    const surfaceStyle = computed<CSSProperties>(() => ({
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      touchAction: gestureGuard.value ? 'none' : 'auto',
      userSelect: gestureGuard.value ? 'none' : 'auto',
      WebkitUserSelect: gestureGuard.value ? 'none' : 'auto',
    }) as CSSProperties);

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
      return h('div', { ref: containerRef, class: 'viewport-2d-surface', style: surfaceStyle.value }, children);
    };
  },
});
