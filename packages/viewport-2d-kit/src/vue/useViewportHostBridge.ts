import { computed, type Ref } from 'vue';
import {
  clientEventToWorldPoint,
  screenDeltaToWorldDelta,
  type Vec2,
  type ViewBox,
  type Viewport2DCamera,
} from '../core/index';

export type ViewportHostBridge = {
  viewBoxText: Readonly<Ref<string>>;
  worldStyle: Readonly<Ref<{ width: string; height: string }>>;
  clientEventToWorld: (camera: Viewport2DCamera, event: Pick<MouseEvent | PointerEvent, 'clientX' | 'clientY'>) => Vec2;
  screenDeltaToWorld: (camera: Viewport2DCamera, deltaScreen: Vec2) => Vec2;
};

/**
 * 为宿主组件提供最小的 viewport DOM 桥接能力。
 *
 * 适用场景：
 * - 宿主自己维护业务状态，但不想重复写 client->world / delta->world 胶水。
 * - 宿主需要把固定 viewBox 渲染成 world 容器样式与 SVG viewBox 字符串。
 */
export function useViewportHostBridge(
  hostRef: Ref<HTMLDivElement | null>,
  viewBox: ViewBox,
): ViewportHostBridge {
  const viewBoxText = computed(() => `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
  const worldStyle = computed(() => ({
    width: `${viewBox.width}px`,
    height: `${viewBox.height}px`,
  }));

  const clientEventToWorld = (
    camera: Viewport2DCamera,
    event: Pick<MouseEvent | PointerEvent, 'clientX' | 'clientY'>,
  ): Vec2 => {
    const host = hostRef.value;
    if (!host) {
      return { x: 0, y: 0 };
    }
    return clientEventToWorldPoint(host, camera, event);
  };

  const screenDeltaToWorld = (camera: Viewport2DCamera, deltaScreen: Vec2): Vec2 => {
    return screenDeltaToWorldDelta(camera, deltaScreen);
  };

  return {
    viewBoxText,
    worldStyle,
    clientEventToWorld,
    screenDeltaToWorld,
  };
}
