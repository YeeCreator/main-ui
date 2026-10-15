/**
 * useViewportHostBridge —— 为宿主组件提供最小的 viewport DOM 桥接能力。
 *
 * 适用：宿主自己维护业务状态，但不想重复写 client→world / delta→world 胶水，
 * 或需要把固定 viewBox 渲染成 world 容器样式与 SVG viewBox 字符串。
 *
 * 取代已废弃的 `viewport-2d-kit/vue` 的同名 hook。
 */
import { computed, type Ref } from 'vue';
import type { ViewBox } from '@main-ui/core/rendering';
import type { ViewportHostBridge } from './types';
import { buildHostBridge } from './viewport-state';

export function useViewportHostBridge(hostRef: Ref<HTMLElement | null>, viewBox: ViewBox): ViewportHostBridge {
  const toLocal = (clientX: number, clientY: number) => {
    const el = hostRef.value;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // 依赖 viewBox 变化重算（width/height 可能响应式）
  const viewBoxText = computed(() => `0 0 ${viewBox.width} ${viewBox.height}`);
  const worldStyle = computed(() => ({ width: `${viewBox.width}px`, height: `${viewBox.height}px` }));

  const bridge = buildHostBridge(viewBox, toLocal);

  return {
    get viewBoxText() { return viewBoxText.value; },
    get worldStyle() { return worldStyle.value; },
    clientEventToWorld: bridge.clientEventToWorld,
    screenDeltaToWorld: bridge.screenDeltaToWorld,
  };
}
