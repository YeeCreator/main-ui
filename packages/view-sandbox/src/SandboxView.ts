import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type CSSProperties, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
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
      getViewState: (): SandboxViewState => ({
        camera: cameraState.value,
        selectedElementIds: [...selectedIds.value],
        embeddedRefs: kernel.value?.document.elements
          .filter((e) => e.type === 'embed-view')
          .map((e) => e.id) ?? [],
      }),
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
    const onElementMouseDown = (elementId: string, event: MouseEvent) => {
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
    };

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

      return h('div', { class: 'main-ui-view-sandbox', style: rootStyle }, [
        // 连线层（简化为 SVG 直线）
        h('svg', {
          style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' },
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
        // 元素层
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
    };
  },
});
