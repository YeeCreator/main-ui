import type { Camera2D, Vec2 } from './viewportMath';
import { panBy, zoomAtScreenPoint } from './viewportMath';

export type ViewportWheelEventLike = {
  ctrlKey: boolean;
  deltaX: number;
  deltaY: number;
  /** 可选：用于 cursor anchor 的坐标 */
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
  /**
   * 可选：是否允许本次 pointerDown 触发 drag-pan。
   *
   * 设计目的：
   * - 库本身不应该理解业务（例如“空格+左键才允许平移”这类规则）；
   * - 但库需要提供一个通用钩子，让宿主按自己的规则决定是否把本次指针交互用于平移。
   *
   * 用法示例（Matheshop）：
   * - 中键拖拽 => 返回 true
   * - 空格按住 + 左键拖拽 => 返回 true
   * - 普通左键拖拽（用于拖动节点/框选）=> 返回 false
   */
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

  /**
   * zoom anchor 策略：
   * - center：以 viewport 中心为锚点（默认，稳定）
   * - cursor：以光标所在点为锚点（绘图软件更常用）
   */
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

  /** 可选：用于某些设备上 ctrl+wheel 无 clientX/clientY 的情况。 */
  getCursorLocal?: () => Vec2 | null;

  onPanStart?: () => void;
  onPanEnd?: () => void;
  onZoom?: () => void;
};

export function createViewportInteractions(opts: CreateViewportInteractionsOptions) {
  const {
    getRect,
    toLocal,
    camera,
    getCursorLocal,
    onPanStart,
    onPanEnd,
    onZoom,
  } = opts;

  const mode: Required<Omit<ViewportInteractionMode, 'dragPanCondition'>> & {
    dragPanCondition?: (e: ViewportPointerEventLike) => boolean
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
    // If drag-pan is disabled, don't hijack pointer events.
    // Let the game/content handle taps/clicks/drags.
    if (!mode.dragPan && !mode.pinchZoom) return;

    // 如果宿主提供了条件，则本次是否允许 drag-pan 由宿主决定。
    // 注意：pinchZoom 仍允许记录 pointers，以便触屏双指缩放。
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

      // midpoint pan
      const other = all.find((p) => p.id !== e.pointerId);
      const otherPrev = other?.pt ?? b;
      const midPrev = { x: (prev.pt.x + otherPrev.x) / 2, y: (prev.pt.y + otherPrev.y) / 2 };
      const midNow = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

      const dxMid = midNow.x - midPrev.x;
      const dyMid = midNow.y - midPrev.y;

      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const last = lastPinchDistance;
      lastPinchDistance = dist;

      // first frame
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
      // 1) 使用外部提供的 “最新光标位置（local px）”
      const local = getCursorLocal?.();
      if (local) return local;

      // 2) 使用 wheel event 自带的 clientX/clientY
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

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onWheel,
  };
}
