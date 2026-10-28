/**
 * interactions —— 框架无关的视口交互控制器（拖拽平移 / 滚轮缩放 / 双指捏合）。
 *
 * 由原 viewport-2d-kit 吸收而来。用于 DOM/CSS 画布或需要自定义交互策略的场景；
 * PixiJS 内核（pixiViewport）已内置等价交互，通常无需再叠加本控制器。
 */
import type { Camera2D, Vec2 } from './camera';
import { panBy, zoomAtScreenPoint } from './camera';
import { readWheel, wheelPanDelta } from '../input/wheel-session';

export type ViewportWheelEventLike = {
  ctrlKey: boolean;
  deltaX: number;
  deltaY: number;
  clientX?: number;
  clientY?: number;
  preventDefault: () => void;
};

/** 滚轮手势语义：缩放 / 平移。 */
export type WheelIntent = 'zoom' | 'pan';

/** 滚轮分流策略：auto=按设备与修饰键自动判定；zoom=一律缩放；pan=一律平移。 */
export type WheelMode = 'zoom' | 'pan' | 'auto';

/**
 * `classifyWheelIntent` 的最小输入：`ctrlKey` 必填，其余字段可选。
 *
 * 给全 `deltaX` / `deltaY` / `deltaMode`（及可选 `intervalMs`）时走
 * {@link readWheel} 的完整设备判定；只给 `ctrlKey` 时退回「有 Ctrl 即缩放」。
 */
export type WheelIntentQuery = {
  ctrlKey: boolean;
  metaKey?: boolean;
  deltaX?: number;
  deltaY?: number;
  deltaMode?: number;
  shiftKey?: boolean;
  intervalMs?: number;
};

/**
 * 按手势语义分类一次 wheel 事件（纯函数，供交互层统一分流）。
 *
 * **判型委托 {@link readWheel}，本函数只负责叠加 `mode` 覆盖。**
 *
 * 历史：此处原为独立实现，只看 `ctrlKey`；它与 `core/input` 的 `classifyWheel`
 * （含事件流密度与设备判定）并存，导致同一个鼠标在 `view-world` 与
 * `view-canvas` 上表现不同（行模式滚轮一个判缩放、一个判平移）。
 *
 * @param event 滚轮事件；只给 `ctrlKey` 时按退化规则判定。
 * @param mode 分流策略，缺省 `auto`。
 * @returns 缩放还是平移。
 * @example
 * classifyWheelIntent({ ctrlKey: true }, 'auto')  // 'zoom'
 * classifyWheelIntent({ ctrlKey: false }, 'auto') // 'pan'（缺 delta 信息时按平移处理）
 * classifyWheelIntent({ ctrlKey: false }, 'zoom') // 'zoom'
 * // 给全字段即为完整判型：鼠标滚轮（整数大刻度）→ 缩放
 * classifyWheelIntent({ ctrlKey: false, deltaX: 0, deltaY: -100, deltaMode: 0 }) // 'zoom'
 */
export function classifyWheelIntent(event: WheelIntentQuery, mode: WheelMode = 'auto'): WheelIntent {
  if (mode === 'zoom') return 'zoom';
  if (mode === 'pan') return 'pan';
  if (!hasDeltaInfo(event)) return event.ctrlKey ? 'zoom' : 'pan';
  return readWheel({
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey ?? false,
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    deltaMode: event.deltaMode,
    shiftKey: event.shiftKey,
    intervalMs: event.intervalMs,
  }).intent;
}

/** 判断输入是否具备完整设备判定所需的 delta 字段。 */
function hasDeltaInfo(
  event: WheelIntentQuery,
): event is WheelIntentQuery & { deltaX: number; deltaY: number; deltaMode: number } {
  return typeof event.deltaX === 'number'
    && typeof event.deltaY === 'number'
    && typeof event.deltaMode === 'number';
}

/**
 * 计算平移型 wheel 的屏幕位移增量（触控板双指滑动 / 离散滚轮）。
 *
 * **这是 `wheelPanDelta` 的唯一实现**（定义在 `input/wheel-session`，此处转出）。
 * 历史上本文件另有一份带 `speed` 参数的版本，与 `input` 的版本并存 ——
 * 同一概念两套定义，正是"多个真相源"的典型来源。
 *
 * @param event 具备 `deltaX` / `deltaY` 的事件。
 * @returns 屏幕位移（已取负：滚轮向上 → 内容上移）。
 * @example
 * wheelPanDelta({ deltaX: 10, deltaY: -5 }) // → { x: -10, y: 5 }
 */
export { wheelPanDelta };

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
      // speed 归一致敏感度：此处是「控制器级」可调项，与设备档（core/input）不同层。
      const base = wheelPanDelta(e);
      apply(panBy(camera.get(), {
        x: base.x * mode.wheelPanSpeed,
        y: base.y * mode.wheelPanSpeed,
      }));
    }
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onWheel };
}
