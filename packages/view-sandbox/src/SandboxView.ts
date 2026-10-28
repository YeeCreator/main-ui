import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type CSSProperties, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import { cameraToCssTransform, panBy, screenToWorld, zoomAtScreenPoint } from '@main-ui/core/rendering';
import { readWheel, wheelPanDelta, zoomFactorOf } from '@main-ui/core/input';
import { createSandboxKernel, type SandboxKernelInstance } from './sandbox-kernel';
import type {
  SandboxCamera,
  SandboxConnection,
  SandboxDocument,
  SandboxElement,
  SandboxMoveElementIntent,
  SandboxRemoveElementIntent,
  SandboxViewState,
  SandboxAddElementIntent,
  SandboxConnectIntent,
  SandboxSelectionIntent,
} from './types';
import { DEFAULT_SANDBOX_CAMERA } from './types';

/** 相机缩放上下限（防止缩到不可见或无限放大）。 */
const MIN_SCALE = 0.05;
const MAX_SCALE = 8;

/**
 * SandboxView —— L3 旗舰复合视图（实现 MainUiViewLifecycle 四成员契约）。
 *
 * 整合 shape / image / embed-view 异构元素 + 连线，
 * 嵌入子 View 一律经 EmbeddedViewHost 托管。
 */
export const SandboxView = defineComponent({
  name: 'SandboxView',
  props: {
    document: { type: Object as PropType<SandboxDocument>, required: true },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    editable: { type: Boolean, default: true },
    maxNestingDepth: { type: Number, default: 8 },
    editorInstanceId: { type: String, default: null },
  },
  emits: [
    'element-move-intent', 'element-remove-intent', 'element-add-intent',
    'connect-intent', 'selection',
  ],
  setup(props, { emit }) {
    const kernel = ref<SandboxKernelInstance | null>(null);
    const selectedIds = ref<string[]>([]);
    const cameraState = ref<SandboxCamera>(DEFAULT_SANDBOX_CAMERA);
    let destroyed = false;

    // 初始化内核
    onMounted(() => {
      const k = createSandboxKernel(props.document, undefined, { maxNestingDepth: props.maxNestingDepth });
      k.onChange((event) => {
        if (event.type === 'camera' || event.type === 'full') {
          cameraState.value = k.camera;
        }
      });
      kernel.value = k;
    });

    // 文档变更同步
    watch(() => props.document, (newDoc) => {
      kernel.value?.fromJSON({ document: newDoc });
    }, { deep: true });

    // ---------- 视图生命周期契约 ----------
    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-sandbox',
      getViewState: (): SandboxViewState => {
        // F-3 fix：cameraState.value 是 Vue 响应式 Proxy，structuredClone 会抛 DataCloneError；
        // 用 {...} 展开为普通对象，规避内核 captureViewStates → cloneDocument 崩溃。
        const cam = cameraState.value;
        return {
          // 纯值复制：内核会把快照喂给 structuredClone，绝不能带响应式 Proxy。
          camera: { scale: cam.scale, pan: { x: cam.pan.x, y: cam.pan.y } },
          selectedElementIds: [...selectedIds.value],
          embeddedRefs: kernel.value?.document.elements
            .filter((e) => e.type === 'embed-view')
            .map((e) => e.id) ?? [],
        };
      },
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<SandboxViewState>;
        if (snapshot.camera) kernel.value?.setCamera(snapshot.camera);
        if (Array.isArray(snapshot.selectedElementIds)) selectedIds.value = snapshot.selectedElementIds;
      },
      onDestroy: () => {
        destroyed = true;
        kernel.value?.destroy();
        kernel.value = null;
      },
    };
    if (props.editorInstanceId) {
      useViewLifecycle(props.editorInstanceId, () => lifecycle);
    }

    onBeforeUnmount(() => {
      kernel.value?.destroy();
      kernel.value = null;
    });

    // ---------- 交互 ----------
    const rootRef = ref<HTMLElement | null>(null);
    const panState = { pointerId: -1, lastX: 0, lastY: 0, active: false };

    /** 屏幕坐标（相对容器左上角）。 */
    const toLocal = (clientX: number, clientY: number): { x: number; y: number } | null => {
      const el = rootRef.value;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    /** 约束缩放区间（相机其余字段原样保留）。 */
    const constrain = (camera: SandboxCamera): SandboxCamera => ({
      scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, camera.scale)),
      pan: { x: camera.pan.x, y: camera.pan.y },
      ...(camera.rotation === undefined ? {} : { rotation: camera.rotation }),
    });

    const applyCamera = (next: SandboxCamera): void => {
      kernel.value?.setCamera(constrain(next));
    };

    /** 空白处左键拖拽平移（元素自身的 mousedown 会 stopPropagation）。 */
    const onRootPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      panState.pointerId = event.pointerId;
      panState.lastX = event.clientX;
      panState.lastY = event.clientY;
      panState.active = true;
      rootRef.value?.setPointerCapture?.(event.pointerId);
    };

    const onRootPointerMove = (event: PointerEvent): void => {
      if (!panState.active || panState.pointerId !== event.pointerId) return;
      const dx = event.clientX - panState.lastX;
      const dy = event.clientY - panState.lastY;
      panState.lastX = event.clientX;
      panState.lastY = event.clientY;
      applyCamera(panBy(cameraState.value, { x: dx, y: dy }));
    };

    const endPan = (event: PointerEvent): void => {
      if (panState.pointerId !== event.pointerId) return;
      rootRef.value?.releasePointerCapture?.(event.pointerId);
      panState.pointerId = -1;
      panState.active = false;
    };

    /** 滚轮：判型与灵敏度全部取自 core/input，不在此重算系数。 */
    const onRootWheel = (event: WheelEvent): void => {
      const anchor = toLocal(event.clientX, event.clientY);
      if (!anchor) return;
      event.preventDefault();
      const query = {
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        shiftKey: event.shiftKey,
      };
      const reading = readWheel(query);
      if (reading.intent === 'pan') {
        applyCamera(panBy(cameraState.value, wheelPanDelta(query)));
        return;
      }
      applyCamera(zoomAtScreenPoint(cameraState.value, {
        factor: zoomFactorOf(reading, event.deltaY),
        anchorScreen: anchor,
      }));
    };

    const onElementMouseDown = (elementId: string, event: MouseEvent) => {
      // 元素上的按下不得冒泡成画布平移。
      event.stopPropagation();
      if (!props.editable) return;
      selectedIds.value = [elementId];
      emit('selection', { elementIds: [elementId] } satisfies SandboxSelectionIntent);
    };

    const onRemoveSelected = () => {
      if (selectedIds.value.length === 0) return;
      emit('element-remove-intent', { elementIds: [...selectedIds.value] } satisfies SandboxRemoveElementIntent);
    };

    // ---------- 渲染 ----------
    const rootStyle: CSSProperties = {
      width: '100%', height: '100%', overflow: 'hidden', position: 'relative',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
      touchAction: 'none',
    };

    /**
     * 世界层样式：**唯一一次相机变换**。
     *
     * 必须用 `cameraToCssTransform`（带 `px`）而非手工拼串 —— 无单位串在
     * CSS 里是非法值，浏览器会静默丢弃整条声明。
     */
    const worldStyle = computed<CSSProperties>(() => ({
      position: 'absolute', top: 0, left: 0,
      transformOrigin: '0 0',
      transform: cameraToCssTransform(cameraState.value),
    }));

    const elementStyle = (el: SandboxElement): CSSProperties => ({
      position: 'absolute',
      left: `${el.x}px`, top: `${el.y}px`,
      width: `${el.width}px`, height: `${el.height}px`,
      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
      border: '1px solid var(--mui-color-border)',
      borderRadius: 'var(--mui-radius)',
      background: el.shape?.fill ?? 'var(--mui-color-panel-raised, var(--mui-color-panel))',
      cursor: props.editable ? 'move' : 'default',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px',
    });

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-sandbox', style: { ...rootStyle, display: 'grid', placeItems: 'center' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-sandbox', style: { ...rootStyle, display: 'grid', placeItems: 'center', color: 'var(--mui-color-danger)' } }, props.error);
      }

      const elements = kernel.value?.document.elements ?? props.document.elements;
      const connections = kernel.value?.document.connections ?? props.document.connections;

      /**
       * 世界层内容：元素**按世界坐标**绝对定位，相机变换由**外层唯一一次**施加。
       *
       * 连线放在世界层内的 SVG 里，其 `viewBox` 用世界范围 —— 与元素同一坐标系，
       * 因此连线不需要单独换算屏幕坐标（旧实现直算屏幕坐标，相机一动就错位）。
       */
      const worldContent = h('div', { class: 'main-ui-view-sandbox__world', style: worldStyle.value }, [
        h('svg', {
          style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' },
        }, connections.map((conn) => {
          const src = elements.find((e) => e.id === conn.source.elementId);
          const tgt = elements.find((e) => e.id === conn.target.elementId);
          if (!src || !tgt) return null;
          return h('line', {
            key: conn.id,
            x1: src.x + src.width / 2, y1: src.y + src.height / 2,
            x2: tgt.x + tgt.width / 2, y2: tgt.y + tgt.height / 2,
            stroke: conn.style?.stroke ?? 'var(--mui-color-border)',
            'stroke-width': 1.5,
            'stroke-dasharray': conn.style?.dash ? '4 4' : undefined,
          });
        })),
        ...elements.map((el) => {
          const selected = selectedIds.value.includes(el.id);
          return h('div', {
            key: el.id,
            class: ['main-ui-view-sandbox__element', selected ? 'is-selected' : ''],
            style: {
              ...elementStyle(el),
              borderColor: selected ? 'var(--mui-color-accent)' : undefined,
              boxShadow: selected ? '0 0 0 1px var(--mui-color-accent)' : undefined,
            },
            onMousedown: (event: MouseEvent) => onElementMouseDown(el.id, event),
          }, el.type === 'embed-view'
            ? h('div', { style: { fontSize: '10px', color: 'var(--mui-color-text-muted)', textAlign: 'center', padding: '4px' } }, `[${el.embedViewRef?.viewType ?? 'embed'}]`)
            : el.type === 'image'
              ? h('div', { style: { fontSize: '10px', color: 'var(--mui-color-text-muted)' } }, el.image?.alt ?? 'image')
              : h('span', {}, el.shape?.label ?? el.id),
          );
        }),
      ]);

      return h('div', {
        ref: rootRef,
        class: 'main-ui-view-sandbox',
        style: rootStyle,
        onPointerdown: onRootPointerDown,
        onPointermove: onRootPointerMove,
        onPointerup: endPan,
        onPointercancel: endPan,
        onWheel: onRootWheel,
      }, [worldContent]);
    };
  },
});
