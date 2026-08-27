import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import { clampFloatingGeometry, floatingWindowDefaults, type FloatingWindowState } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';
import { LayoutNodeRenderer } from './LayoutNodeRenderer';
import { renderIconToken } from './IconToken';

/**
 * 单个浮动窗口表面：纯浏览器环境实现为「窗内浮动层」——
 * 绝对定位的可拖动（标题栏）、可缩放（右下角把手）容器。
 * 拖动/缩放过程中使用本地偏移渲染，指针抬起后才 dispatch 一次（持久化只写最终几何）。
 */
const FloatingWindowSurface = defineComponent({
  name: 'FloatingWindowSurface',
  props: {
    floatingWindow: {
      type: Object as PropType<FloatingWindowState>,
      required: true,
    },
  },
  setup(props) {
    const { document, dispatch } = useWorkbench();
    const dragOffset = ref<{ x: number; y: number } | null>(null);
    const resizeDelta = ref<{ w: number; h: number } | null>(null);

    const title = computed(() => {
      const workspace = document.value.workspaceStates[document.value.activeWorkspaceId];
      const layout = props.floatingWindow.layout;
      const group = (layout.activeGroupId ? layout.groups[layout.activeGroupId] : undefined) ?? Object.values(layout.groups)[0];
      const tab = group?.activeTabId ? workspace.tabs[group.activeTabId] : undefined;
      return tab?.title ?? 'Floating window';
    });

    const startDrag = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest('button')) return;
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const origin = props.floatingWindow.position;
      dragOffset.value = { x: 0, y: 0 };
      const onPointerMove = (moveEvent: PointerEvent) => {
        dragOffset.value = { x: moveEvent.clientX - startX, y: moveEvent.clientY - startY };
      };
      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        const finalOffset = dragOffset.value ?? { x: 0, y: 0 };
        dragOffset.value = null;
        if (finalOffset.x !== 0 || finalOffset.y !== 0) {
          void dispatch({
            type: 'floatingWindow/updateGeometry',
            windowId: props.floatingWindow.id,
            position: { x: origin.x + finalOffset.x, y: origin.y + finalOffset.y },
          });
        }
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp, { once: true });
    };

    const startResize = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startY = event.clientY;
      const origin = props.floatingWindow.size;
      resizeDelta.value = { w: 0, h: 0 };
      const onPointerMove = (moveEvent: PointerEvent) => {
        resizeDelta.value = { w: moveEvent.clientX - startX, h: moveEvent.clientY - startY };
      };
      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        const finalDelta = resizeDelta.value ?? { w: 0, h: 0 };
        resizeDelta.value = null;
        if (finalDelta.w !== 0 || finalDelta.h !== 0) {
          void dispatch({
            type: 'floatingWindow/updateGeometry',
            windowId: props.floatingWindow.id,
            size: {
              width: Math.max(floatingWindowDefaults.minWidth, origin.width + finalDelta.w),
              height: Math.max(floatingWindowDefaults.minHeight, origin.height + finalDelta.h),
            },
          });
        }
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp, { once: true });
    };

    return () => {
      const floatingWindow = props.floatingWindow;
      const offset = dragOffset.value ?? { x: 0, y: 0 };
      const delta = resizeDelta.value ?? { w: 0, h: 0 };
      const width = Math.max(floatingWindowDefaults.minWidth, floatingWindow.size.width + delta.w);
      const height = Math.max(floatingWindowDefaults.minHeight, floatingWindow.size.height + delta.h);
      const interacting = Boolean(dragOffset.value || resizeDelta.value);

      return h('section', {
        class: ['main-ui-floating-window', interacting ? 'is-interacting' : ''],
        style: {
          left: `${floatingWindow.position.x + offset.x}px`,
          top: `${floatingWindow.position.y + offset.y}px`,
          width: `${width}px`,
          height: `${height}px`,
        },
        role: 'dialog',
        'aria-label': `Floating window: ${title.value}`,
        'data-floating-window-id': floatingWindow.id,
      }, [
        h('header', { class: 'main-ui-floating-window__titlebar', onPointerdown: startDrag }, [
          h('span', { class: 'main-ui-floating-window__title' }, title.value),
          h('div', { class: 'main-ui-floating-window__actions' }, [
            h('button', {
              class: 'main-ui-floating-window__action',
              type: 'button',
              title: 'Dock back to workbench',
              onClick: () => void dispatch({ type: 'floatingWindow/dockBack', windowId: floatingWindow.id }),
            }, [renderIconToken('dock')]),
            h('button', {
              class: 'main-ui-floating-window__action',
              type: 'button',
              title: 'Close floating window',
              onClick: () => void dispatch({ type: 'floatingWindow/close', windowId: floatingWindow.id }),
            }, [renderIconToken('close')]),
          ]),
        ]),
        h('div', { class: 'main-ui-floating-window__body' }, [
          h(LayoutNodeRenderer, { layout: floatingWindow.layout, nodeId: floatingWindow.layout.rootNodeId, floatingWindowId: floatingWindow.id }),
        ]),
        h('div', { class: 'main-ui-floating-window__resize', title: 'Resize window', onPointerdown: startResize }),
      ]);
    };
  },
});

/**
 * 浮动窗口层（Window 层）：渲染当前工作区全部浮动窗口。
 * 挂载与视口变化时对越界窗口自动归位（多显示器坑：外接屏断开等场景）。
 */
export const FloatingWindowLayer = defineComponent({
  name: 'FloatingWindowLayer',
  setup() {
    const { document, dispatch } = useWorkbench();
    const layerEl = ref<HTMLElement | null>(null);
    const workspace = computed(() => document.value.workspaceStates[document.value.activeWorkspaceId]);
    const floatingWindows = computed(() => Object.values(workspace.value.floatingWindows ?? {}));

    const clampAll = () => {
      const viewport = layerEl.value && layerEl.value.clientWidth > 0 && layerEl.value.clientHeight > 0
        ? { width: layerEl.value.clientWidth, height: layerEl.value.clientHeight }
        : { width: window.innerWidth, height: window.innerHeight };
      for (const floatingWindow of floatingWindows.value) {
        const clamped = clampFloatingGeometry(floatingWindow, viewport);
        if (clamped.changed) {
          void dispatch({
            type: 'floatingWindow/updateGeometry',
            windowId: floatingWindow.id,
            position: clamped.position,
            size: clamped.size,
          });
        }
      }
    };

    onMounted(() => {
      clampAll();
      window.addEventListener('resize', clampAll);
    });
    onBeforeUnmount(() => window.removeEventListener('resize', clampAll));
    // 快照异步加载/窗口新增后补一次归位；clamp 幂等，无变化不再 dispatch。
    watch(() => floatingWindows.value, () => clampAll(), { flush: 'post' });

    return () => h('div', { class: 'main-ui-floating-layer', ref: layerEl }, floatingWindows.value.map((floatingWindow) => h(FloatingWindowSurface, {
      key: floatingWindow.id,
      floatingWindow,
    })));
  },
});
