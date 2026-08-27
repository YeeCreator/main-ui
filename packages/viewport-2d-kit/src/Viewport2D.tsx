import React, { useMemo, useRef } from 'react';
import type { Viewport2DController, Viewport2DCamera } from './types';
import type { ViewBox } from './viewportMath';
import { cameraToCssTransform } from './viewportMath';
import { useViewportCamera } from './useViewportCamera';
import type { ViewportInteractionMode, ViewportWheelEventLike } from './interactions';

export type Viewport2DChildrenArgs = {
  /** Camera state. `pan` is in screen pixels; `scale` is world->screen. */
  camera: Viewport2DCamera;
  /** Reset camera to fit & center. */
  fitToCenter: () => void;
};

export type Viewport2DProps = {
  /** Fixed-size viewport. If omitted, the component will fill parent. */
  width?: number | string;
  height?: number | string;

  /** World bounds (e.g. SVG viewBox) used for fit & center. */
  viewBox: ViewBox;

  /** Optional background color for the viewport area. */
  background?: string;

  /** Auto fit on mount/viewBox change. Default true (handled by hook). */
  paddingPx?: number;

  minScaleFactor?: number;
  maxScaleFactor?: number;

  /** Trackpad pinch zoom speed (ctrl+wheel). */
  wheelZoomSpeed?: number;
  /** Trackpad two-finger pan speed (wheel). */
  wheelPanSpeed?: number;

  /** Extra styles applied to the outer viewport container. */
  style?: React.CSSProperties;

  /**
   * If false, disables single-pointer drag-to-pan so the content can handle left-drag gestures (e.g. board interactions).
   * Default true.
   */
  allowDragPan?: boolean;

  /**
   * If false, Viewport2D will not attach pointer event handlers to the container.
   * This guarantees that mouse/touch gestures are handled by the content layer.
   *
   * Default true.
   */
  allowPointerPan?: boolean;

  /**
   * Render function. The returned nodes will be placed inside the transformed content layer.
   *
   * Important: Children should be written in world coordinates (e.g. SVG viewBox coords).
   */
  children: React.ReactNode | ((args: Viewport2DChildrenArgs) => React.ReactNode);

  /**
   * Optional overlay UI fixed to viewport (not transformed).
   *
   * - If you pass a ReactNode, it renders as-is.
   * - If you pass a function, it receives `{ camera, fitToCenter }`.
   */
  overlay?: React.ReactNode | ((args: Viewport2DChildrenArgs) => React.ReactNode);

  /** Optional callback whenever camera changes (useful for external toolbars/status). */
  onCamera?: (camera: Viewport2DChildrenArgs['camera']) => void;

  /** Optional imperative controller for external toolbars. */
  controllerRef?: React.RefObject<Viewport2DController | null>;

  /** 交互配置（平移/缩放等）。不传则使用默认交互。 */
  interactions?: ViewportInteractionMode;

  /**
   * Hold-to-pan behavior: when enabled, drag-to-pan only works while the user is holding Space.
   * This keeps left-click gestures available for the content (board interactions) by default.
   *
   * - Wheel pan/zoom is unaffected.
   * - Default: 'space' (enabled).
   * - Set to 'none' to use classic "always drag-pan".
   */
  holdToPanKey?: 'space' | 'none';
};

/**
 * Viewport2D
 *
 * A reusable "infinite canvas" style 2D viewport:
 * - Pan: drag or trackpad two-finger scroll
 * - Zoom: ctrl+wheel (anchored at viewport center) or touch pinch
 * - Fit/reset: via `fitToCenter`
 */
export function Viewport2D(props: Viewport2DProps) {
  const {
    width = '100%',
    height = '100%',
    viewBox,
    background = '#fff',
    paddingPx = 12,
    minScaleFactor = 0.6,
    maxScaleFactor = 10,
    wheelZoomSpeed = 0.006,
    wheelPanSpeed = 1.1,
    style,
    children,
    overlay,
    interactions,
    allowDragPan = true,
    allowPointerPan = true,
    holdToPanKey = 'space',
  } = props;

  const viewportRef = useRef<HTMLDivElement | null>(null);

  const spaceDownRef = useRef(false);
  React.useEffect(() => {
    if (holdToPanKey !== 'space') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = false;
    };
    const onBlur = () => {
      spaceDownRef.current = false;
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [holdToPanKey]);

  const navModeActive = holdToPanKey === 'none' ? true : spaceDownRef.current;
  const effectiveAllowDragPan = allowDragPan && navModeActive;

  // Important: If we still attach pointer handlers while dragPan is "off",
  // `createViewportInteractions` can still call preventDefault/setPointerCapture for pinchZoom,
  // hijacking clicks from the underlying content.
  //
  // So in hold-to-pan mode, we only attach pointer handlers while nav mode is active.
  const effectiveAllowPointerHandlers = allowPointerPan && navModeActive;

  const { camera, fitToCenter, handlers, setCamera } = useViewportCamera({
    containerRef: viewportRef,
    viewBox,
    paddingPx,
    minScaleFactor,
    maxScaleFactor,
    wheelZoomSpeed,
    wheelPanSpeed,
    interactionMode: {
      ...interactions,
      dragPan: effectiveAllowDragPan && (interactions?.dragPan ?? true),
    },
  });

  // Expose imperative controller.
  React.useEffect(() => {
    const ref = props.controllerRef;
    if (!ref) return;

    if (ref.current) {
      ref.current.fitToCenter = fitToCenter;
      ref.current.getCamera = () => camera;
      ref.current.setCamera = (next) => setCamera(next);
    } else {
      ref.current = {
        fitToCenter,
        getCamera: () => camera,
        setCamera: (next) => setCamera(next),
      };
    }

    return () => {
      if (ref.current) ref.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.controllerRef, fitToCenter, setCamera, camera.pan.x, camera.pan.y, camera.scale]);

  // Notify external observers.
  React.useEffect(() => {
    props.onCamera?.(camera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.pan.x, camera.pan.y, camera.scale]);

  const content = useMemo(() => {
    if (typeof children === 'function') return children({ camera, fitToCenter });
    return children;
  }, [camera, children, fitToCenter]);

  const overlayNode = useMemo(() => {
    if (!overlay) return null;
    if (typeof overlay === 'function') return overlay({ camera, fitToCenter });
    return overlay;
  }, [camera, fitToCenter, overlay]);

  return (
    <div
      ref={viewportRef}
      style={{
        width,
        height,
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none',
        background,
        ...style,
      }}
      onPointerDown={effectiveAllowPointerHandlers ? handlers.onPointerDown : undefined}
      onPointerMove={effectiveAllowPointerHandlers ? handlers.onPointerMove : undefined}
      onPointerUp={effectiveAllowPointerHandlers ? handlers.onPointerUp : undefined}
      onPointerCancel={effectiveAllowPointerHandlers ? handlers.onPointerCancel : undefined}
      onWheelCapture={(e) => {
        const like: ViewportWheelEventLike = {
          ctrlKey: e.ctrlKey,
          deltaX: e.deltaX,
          deltaY: e.deltaY,
          clientX: e.clientX,
          clientY: e.clientY,
          preventDefault: () => e.preventDefault(),
        };
        handlers.onWheel(like);
      }}
    >
      {/* transformed content (world space) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: '0 0',
          transform: cameraToCssTransform(camera),
        }}
      >
        {content}
      </div>

      {/* fixed overlay (screen space) */}
      {overlayNode ? <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{overlayNode}</div> : null}
    </div>
  );
}
