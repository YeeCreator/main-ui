/**
 * interactions —— 框架无关的视口交互控制器（拖拽平移 / 滚轮缩放 / 双指捏合）。
 *
 * 由原 viewport-2d-kit 吸收而来。用于 DOM/CSS 画布或需要自定义交互策略的场景；
 * PixiJS 内核（pixiViewport）已内置等价交互，通常无需再叠加本控制器。
 */
import type { Camera2D, Vec2 } from './camera';
import { panBy, zoomAtScreenPoint } from './camera';

export type ViewportWheelEventLike = {
  ctrlKey: boolean;
  deltaX: number;
  deltaY: number;
  clientX?: number;
  clientY?: number;
  preventDefault: () => void;
};

export type ViewportPointerEventLike = {
  pointerId: number;
  clientX: number;
  clientY: number;
  preventDefault: () => void;
  currentTarget: { setPointerCapture?: (pointerId: number) => void };
};

export type ViewportRect = { left: number; top: number; width: number; height: number };

export type ViewportInteractionMode = {
  /** 是否启用拖拽平移（单指/鼠标）。默认 true。 */
  dragPan?: boolean;
  /** 可选：本次 pointerDown 是否允许 drag-pan（宿主按自身规则决定）。 */
  dragPanCondition?: (e: ViewportPointerEventLike) => boolean;
  /** 是否启用双指/触控板滚动平移（wheel）。默认 true。 */
  wheelPan?: boolean;
  /** 是否启用 ctrl+wheel 缩放。默认 true。 */
  ctrlWheelZoom?: boolean;
  /** 是否启用触摸 pinch（双指）。默认 true。 */
  pinchZoom?: boolean;
  /** wheel 缩放速度。默认 0.004（指数缩放）。 */
  wheelZoomSpeed?: number;
  /** wheel 平移速度。默认 1.0。 */
  wheelPanSpeed?: number;
  /** zoom anchor 策略：center（默认，稳定）/ cursor（绘图软件常用）。 */
  wheelZoomAnchor?: 'center' | 'cursor';
};

type PointerState = { id: number; pt: Vec2; allowDragPan: boolean };

export type ViewportCameraApi = {
  get: () => Camera2D;
  set: (next: Camera2D) => void;
  /** 可选：对 next camera 进行约束（例如 clamp）。 */
  constrain?: (next: Camera2D) => Camera2D;
};

export type CreateViewportInteractionsOptions = {
  getRect: () => ViewportRect | null;
  toLocal: (clientX: number, clientY: number) => Vec2 | null;
  camera: ViewportCameraApi;
  mode?: ViewportInteractionMode;
  getCursorLocal?: () => Vec2 | null;
  onPanStart?: () => void;
  onPanEnd?: () => void;
  onZoom?: () => void;
};

export function createViewportInteractions(opts: CreateViewportInteractionsOptions) {
  const { getRect, toLocal, camera, getCursorLocal, onPanStart, onPanEnd, onZoom } = opts;

  const mode: Required<Omit<ViewportInteractionMode, 'dragPanCondition'>> & {
    dragPanCondition?: (e: ViewportPointerEventLike) => boolean;
  } = {
    dragPan: true,
    wheelPan: true,
    ctrlWheelZoom: true,
    pinchZoom: true,
    wheelZoomSpeed: 0.004,
    wheelPanSpeed: 1.0,
    wheelZoomAnchor: 'center',
    ...opts.mode,
  };

  const pointers = new Map<number, PointerState>();
  let lastPinchDistance: number | null = null;

  const apply = (next: Camera2D) => {
    const constrained = camera.constrain ? camera.constrain(next) : next;
    camera.set(constrained);
  };

  const onPointerDown = (e: ViewportPointerEventLike) => {
    if (!mode.dragPan && !mode.pinchZoom) return;
    const allowDragPan = mode.dragPan && (mode.dragPanCondition ? mode.dragPanCondition(e) : true);
    if (!allowDragPan && !mode.pinchZoom) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const pt = toLocal(e.clientX, e.clientY);
    if (!pt) return;

    pointers.set(e.pointerId, { id: e.pointerId, pt, allowDragPan });

    if (pointers.size < 2) {
      lastPinchDistance = null;
    } else {
      const pts = Array.from(pointers.values()).map((p) => p.pt);
      lastPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }

    if (pointers.size === 1 && allowDragPan) onPanStart?.();
  };

  const endPointer = (pointerId: number) => {
    pointers.delete(pointerId);
    if (pointers.size < 2) lastPinchDistance = null;
    if (pointers.size === 0) onPanEnd?.();
  };

  const onPointerUp = (e: ViewportPointerEventLike) => {
    if (!mode.dragPan && !mode.pinchZoom) return;
    e.preventDefault();
    endPointer(e.pointerId);
  };

  const onPointerCancel = (e: ViewportPointerEventLike) => {
    if (!mode.dragPan && !mode.pinchZoom) return;
    e.preventDefault();
    endPointer(e.pointerId);
  };

  const onPointerMove = (e: ViewportPointerEventLike) => {
    if (!mode.dragPan && !mode.pinchZoom) return;

    e.preventDefault();

    const prev = pointers.get(e.pointerId);
    if (!prev) return;

    const pt = toLocal(e.clientX, e.clientY);
    if (!pt) return;

    pointers.set(e.pointerId, { id: e.pointerId, pt, allowDragPan: prev.allowDragPan });

    const all = Array.from(pointers.values());
    const pts = all.map((p) => p.pt);

    if (pts.length === 1 && prev.allowDragPan) {
      const dx = pt.x - prev.pt.x;
      const dy = pt.y - prev.pt.y;
      if (dx === 0 && dy === 0) return;
      apply(panBy(camera.get(), { x: dx, y: dy }));
      return;
    }

    if (pts.length >= 2 && mode.pinchZoom) {
      const a = pts[0];
      const b = pts[1];

      const other = all.find((p) => p.id !== e.pointerId);
      const otherPrev = other?.pt ?? b;
      const midPrev = { x: (prev.pt.x + otherPrev.x) / 2, y: (prev.pt.y + otherPrev.y) / 2 };
      const midNow = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

      const dxMid = midNow.x - midPrev.x;
      const dyMid = midNow.y - midPrev.y;

      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const last = lastPinchDistance;
      lastPinchDistance = dist;

      if (!last || last <= 0) {
        if (dxMid !== 0 || dyMid !== 0) apply(panBy(camera.get(), { x: dxMid, y: dyMid }));
        return;
      }

      const factor = dist / last;
      if (!Number.isFinite(factor) || factor === 0) {
        if (dxMid !== 0 || dyMid !== 0) apply(panBy(camera.get(), { x: dxMid, y: dyMid }));
        return;
      }

      const current = camera.get();
      const panned = dxMid === 0 && dyMid === 0 ? current : panBy(current, { x: dxMid, y: dyMid });
      apply(zoomAtScreenPoint(panned, { factor, anchorScreen: midNow }));
      onZoom?.();
    }
  };

  const onWheel = (e: ViewportWheelEventLike) => {
    const rect = getRect();
    if (!rect) return;

    const centerAnchor: Vec2 = { x: rect.width / 2, y: rect.height / 2 };

    const pickCursorAnchor = (): Vec2 | null => {
      const local = getCursorLocal?.();
      if (local) return local;
      if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
        const local2 = toLocal(e.clientX, e.clientY);
        if (local2) return local2;
      }
      return null;
    };

    const anchor: Vec2 = mode.wheelZoomAnchor === 'cursor' ? pickCursorAnchor() ?? centerAnchor : centerAnchor;

    if (e.ctrlKey && mode.ctrlWheelZoom) {
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = Math.exp(delta * mode.wheelZoomSpeed);
      if (!Number.isFinite(factor) || factor === 0) return;
      apply(zoomAtScreenPoint(camera.get(), { factor, anchorScreen: anchor }));
      onZoom?.();
      return;
    }

    if (mode.wheelPan && (e.deltaX !== 0 || e.deltaY !== 0)) {
      e.preventDefault();
      const dx = -e.deltaX * mode.wheelPanSpeed;
      const dy = -e.deltaY * mode.wheelPanSpeed;
      apply(panBy(camera.get(), { x: dx, y: dy }));
    }
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onWheel };
}
