import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Camera2D, Vec2, ViewBox } from './viewportMath';
import { clamp, fitCameraToViewBox } from './viewportMath';
import type { CameraConstraints } from './constraints';
import { constrainCamera } from './constraints';
import { createViewportInteractions } from './interactions';
import type { ViewportInteractionMode } from './interactions';

type PointerState = {
  id: number;
  pt: Vec2; // in container-local pixels
};

export type UseViewportCameraOptions = {
  /** DOM element that receives pointer/wheel events and defines screen coords */
  containerRef: React.RefObject<HTMLElement | null>;
  viewBox: ViewBox;
  /** Optional padding (px) when auto-fitting */
  paddingPx?: number;
  /** Zoom clamp relative to fit scale */
  minScaleFactor?: number;
  maxScaleFactor?: number;
  /** Zoom sensitivity for ctrl+wheel pinch (larger = faster). Default 0.004. */
  wheelZoomSpeed?: number;
  /** Pan sensitivity for trackpad two-finger scroll (larger = faster). Default 1.0. */
  wheelPanSpeed?: number;
  /**
   * Latest known cursor position in container-local pixels.
   * Useful on some trackpads where ctrl+wheel events don't carry meaningful clientX/clientY.
   */
  getCursorLocal?: () => Vec2 | null;

  /** 可选：额外的相机约束（例如世界边界夹紧）。 */
  constraints?: CameraConstraints;

  /** 可选：交互模式（开关/参数）。 */
  interactionMode?: ViewportInteractionMode;
};

export function useViewportCamera(opts: UseViewportCameraOptions) {
  const {
    containerRef,
    viewBox,
    paddingPx = 0,
    minScaleFactor = 0.75,
    maxScaleFactor = 6,
    wheelZoomSpeed = 0.004,
    wheelPanSpeed = 1.0,
    constraints,
    interactionMode,
  } = opts;

  const [camera, setCamera] = useState<Camera2D>(() => ({ scale: 1, pan: { x: 0, y: 0 } }));
  const fitScaleRef = useRef<number>(1);

  const getContainerRect = useCallback(() => {
    const el = containerRef.current;
    if (!el) return null;
    return el.getBoundingClientRect();
  }, [containerRef]);

  const toLocal = useCallback(
    (clientX: number, clientY: number): Vec2 | null => {
      const rect = getContainerRect();
      if (!rect) return null;
      return { x: clientX - rect.left, y: clientY - rect.top };
    },
    [getContainerRect]
  );

  const clampCamera = useCallback(
    (c: Camera2D): Camera2D => {
      const fitScale = fitScaleRef.current || 1;
      const minScale = fitScale * minScaleFactor;
      const maxScale = fitScale * maxScaleFactor;

      let next: Camera2D = c;
      const scale = clamp(next.scale, minScale, maxScale);
      if (scale !== next.scale) next = { ...next, scale };

      // 附加约束（例如世界边界）
      if (constraints) {
        const rect = getContainerRect();
        if (rect && constraints.panBounds) {
          next = constrainCamera(next, {
            ...constraints,
            panBounds: {
              ...constraints.panBounds,
              viewportPx: { width: rect.width, height: rect.height },
            },
          });
        } else {
          next = constrainCamera(next, constraints);
        }
      }

      return next;
    },
    [constraints, getContainerRect, maxScaleFactor, minScaleFactor]
  );

  const fitToCenter = useCallback(() => {
    const rect = getContainerRect();
    if (!rect) return;
    const fit = fitCameraToViewBox({ containerPx: { width: rect.width, height: rect.height }, viewBox, paddingPx });
    fitScaleRef.current = fit.scale;
    setCamera(clampCamera(fit));
  }, [clampCamera, getContainerRect, paddingPx, viewBox]);

  // Fit on mount & when viewBox changes
  useEffect(() => {
    fitToCenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewBox.x, viewBox.y, viewBox.width, viewBox.height]);

  // Prevent Safari/iOS gesture zoom (if any) while interacting with the viewport.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const prevent = (ev: Event) => {
      // Only prevent when the event is targeting our container.
      if (ev.target && el.contains(ev.target as Node)) ev.preventDefault();
    };

    // Some browsers emit gesture events; harmless elsewhere.
    el.addEventListener('gesturestart', prevent, { passive: false } as AddEventListenerOptions);
    el.addEventListener('gesturechange', prevent, { passive: false } as AddEventListenerOptions);
    el.addEventListener('gestureend', prevent, { passive: false } as AddEventListenerOptions);

    return () => {
      el.removeEventListener('gesturestart', prevent as EventListener);
      el.removeEventListener('gesturechange', prevent as EventListener);
      el.removeEventListener('gestureend', prevent as EventListener);
    };
  }, [containerRef]);

  // Wrap setCamera so external callers also go through constraints.
  const setCameraConstrained = useCallback(
    (next: Camera2D) => {
      setCamera(clampCamera(next));
    },
    [clampCamera]
  );

  const interactions = useMemo(() => {
    return createViewportInteractions({
      getRect: () => getContainerRect(),
      toLocal,
      getCursorLocal: opts.getCursorLocal,
      camera: {
        get: () => camera,
        set: (next) => setCameraConstrained(next),
        constrain: (next) => clampCamera(next),
      },
      mode: {
        dragPan: true,
        wheelPan: true,
        ctrlWheelZoom: true,
        pinchZoom: true,
        wheelZoomSpeed,
        wheelPanSpeed,
        wheelZoomAnchor: 'center',
        ...interactionMode,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampCamera, getContainerRect, interactionMode, setCameraConstrained, toLocal, wheelPanSpeed, wheelZoomSpeed]);

  const handlers = useMemo(
    () => ({
      onPointerDown: interactions.onPointerDown,
      onPointerMove: interactions.onPointerMove,
      onPointerUp: interactions.onPointerUp,
      onPointerCancel: interactions.onPointerCancel,
      onWheel: interactions.onWheel,
    }),
    [interactions]
  );

  return { camera, setCamera: setCameraConstrained, fitToCenter, handlers };
}
