/**
 * PixiViewportReact —— pixi 渲染内核的 React 薄封装（方案 B）。
 *
 * 设计原则与 Vue 版 `PixiViewportCanvas` 一致：组件只负责
 * “容器生命周期 + 内核挂载 + 事件透传”，不承载任何业务渲染。
 * 调用方在 `onReady` 拿到 `PixiViewport` 后，向 `world` 容器
 * 添加世界坐标的 Graphics/Sprite，相机由内核唯一管理。
 *
 * ```tsx
 * <PixiViewportReact
 *   viewBox={{ x: 0, y: 0, width: 900, height: 620 }}
 *   onReady={(vp) => {
 *     const g = new Graphics().rect(0, 0, 100, 100).fill(0xdcfce7);
 *     vp.world.addChild(g);
 *   }}
 * />
 * ```
 */
import { useEffect, useRef, type CSSProperties, type MutableRefObject } from 'react';
import type { Camera2D, ViewBox } from '../core/index';
import { PixiViewport, type PixiViewportOptions } from '../pixi/PixiViewport';

export type PixiViewportReactProps = Omit<PixiViewportOptions, 'viewBox'> & {
  /** 世界范围（必填）。 */
  viewBox: ViewBox;
  /** 容器样式。 */
  style?: CSSProperties;
  /** 容器类名。 */
  className?: string;
  /** 内核就绪回调：在此向 world 容器添加业务内容。 */
  onReady?: (viewport: PixiViewport) => void;
  /** 相机变化回调。 */
  onCameraChange?: (camera: Camera2D) => void;
  /** 缩放百分比变化回调（0-100）。 */
  onZoomPercentChange?: (value: number) => void;
  /** 拖拽交互状态回调。 */
  onInteractingChange?: (value: boolean) => void;
};

const SURFACE_STYLE: CSSProperties = {
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

/**
 * 创建 pixi 视口内核实例的辅助函数，供受控场景复用。
 * 返回 `{ viewport, hostRef }`；调用方负责 `viewport.destroy()`。
 */
export function createPixiViewportReact(
  hostRef: MutableRefObject<HTMLDivElement | null>,
  options: PixiViewportOptions,
): PixiViewport {
  const host = hostRef.current;
  if (!host) {
    throw new Error('PixiViewportReact: host element is not mounted yet.');
  }
  return new PixiViewport(host, options);
}

export function PixiViewportReact(props: PixiViewportReactProps): React.JSX.Element {
  const {
    viewBox,
    style,
    className,
    onReady,
    onCameraChange,
    onZoomPercentChange,
    onInteractingChange,
    ...kernelOptions
  } = props;

  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<PixiViewport | null>(null);
  const callbacksRef = useRef({ onReady, onCameraChange, onZoomPercentChange, onInteractingChange });
  callbacksRef.current = { onReady, onCameraChange, onZoomPercentChange, onInteractingChange };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const viewport = new PixiViewport(host, {
      ...kernelOptions,
      viewBox,
    });

    viewport.onCameraChange((camera) => {
      callbacksRef.current.onCameraChange?.(camera);
      callbacksRef.current.onZoomPercentChange?.(Math.round(camera.scale * 100));
    });
    viewport.onInteractingChange((value) => {
      callbacksRef.current.onInteractingChange?.(value);
    });

    let cancelled = false;
    viewport.init().then(() => {
      if (cancelled) {
        viewport.destroy();
        return;
      }
      viewportRef.current = viewport;
      callbacksRef.current.onReady?.(viewport);
    });

    return () => {
      cancelled = true;
      if (viewportRef.current === viewport) {
        viewportRef.current = null;
      }
      viewport.destroy();
    };
  }, [viewBox]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={style ? { ...SURFACE_STYLE, ...style } : SURFACE_STYLE}
    />
  );
}
