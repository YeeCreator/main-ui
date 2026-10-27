/**
 * pointer-gesture —— 指针「轻点 / 拖拽」判别的**唯一真相源**（框架无关）。
 *
 * 背景：MUI 的画布类模板此前各自维护一份 `drag.moved` 记账
 * （`pixiViewport` 内置、`view-world` InteractionLayer、`view-canvas` ViewportCanvas），
 * 三份实现的容差、捕获时机与「松手算不算点击」判定互不一致，导致同一类缺陷反复出现：
 *
 * - 拖拽结束后仍抛出「点击」，宿主在松手点重算命中为 null 而清空刚选中的对象；
 * - 或反之，轻点时位移被误判为拖拽，触摸端的落子/选中被吞掉。
 *
 * 本模块把该判定收敛为一处：调用方只负责喂坐标与「是否捕获、是否平移」等宿主策略，
 * 判别本身不再各写一份。
 *
 * 容差按**每次调用**传入（缺省取构造参数），因此宿主的 prop 可以响应式变化，
 * 而无需重建跟踪器。
 */

/** 默认轻点容差（CSS 像素）：位移不超过该值仍视为轻点。 */
export const DEFAULT_TAP_TOLERANCE_PX = 4;

export type PointerGestureKind = 'tap' | 'drag';

export type PointerPoint = { x: number; y: number };

export type PointerGestureTrackerOptions = {
  /** 缺省容差（CSS 像素）。缺省 {@link DEFAULT_TAP_TOLERANCE_PX}。 */
  tolerancePx?: number | null;
};

export type PointerGestureTracker = {
  /** 记录按下点。重复调用视为新手势。 */
  down: (point: PointerPoint) => void;
  /** 喂入移动点；返回「是否已越过容差」。未按下时返回 false。 */
  move: (point: PointerPoint, tolerancePx?: number | null) => boolean;
  /** 结束手势并给出判定（未按下时为 'tap'）。 */
  up: (point?: PointerPoint, tolerancePx?: number | null) => PointerGestureKind;
  /** 是否已越过容差。 */
  hasMoved: (tolerancePx?: number | null) => boolean;
  /** 按下点起算的位移（未按下时为 0）。 */
  delta: () => PointerPoint;
  /** 按下点起算的欧氏距离（CSS 像素）。 */
  distance: () => number;
  /** 丢弃当前状态。 */
  reset: () => void;
};

/**
 * 解析容差。`null` / `undefined` / 非有限值 = **不参与判别**（位移再大也算轻点）。
 *
 * 「不参与判别」必须可表达：棋类等「轻点落子」宿主在触摸端的位移抖动常达 5–10px，
 * 若强行要求位移参与判定，落子会被吞掉。
 */
export function normalizeTolerance(tolerancePx: number | null | undefined): number {
  if (typeof tolerancePx !== 'number' || !Number.isFinite(tolerancePx)) return Number.POSITIVE_INFINITY;
  return Math.max(0, tolerancePx);
}

/**
 * 判定一次指针交互的语义（纯函数，等价于跟踪器 `up()` 的结果）。
 *
 * @param start 按下点。
 * @param end 松手点。
 * @param tolerancePx 容差；`null`/`undefined` = 不参与判别（恒为轻点）。
 */
export function classifyPointerGesture(
  start: PointerPoint,
  end: PointerPoint,
  tolerancePx?: number | null,
): PointerGestureKind {
  return Math.hypot(end.x - start.x, end.y - start.y) > normalizeTolerance(tolerancePx) ? 'drag' : 'tap';
}

/**
 * 解析模板层「轻点容差」的默认值。
 *
 * 这是**默认行为等价性**的落点，必须显式可测：
 *
 * - 显式数值 → 原样返回（编辑器传 4，触摸端棋盘可传 10–12）；
 * - 缺省 + `panOnDrag=true` → {@link DEFAULT_TAP_TOLERANCE_PX}（拖的是相机，位移即意图）；
 * - 缺省 + `panOnDrag=false` → `null`，即**不参与判别** ——
 *   棋类「轻点落子」的既有语义，不能被「拖拽 ≠ 点击」的正确性顺手改掉。
 *
 * @param options `panOnDrag` 与宿主显式容差。
 * @returns 参与判别的容差，或 `null`（不参与判别）。
 */
export function resolveTapTolerance(options: {
  panOnDrag: boolean;
  tapTolerancePx?: number | null;
}): number | null {
  const explicit = options.tapTolerancePx;
  if (typeof explicit === 'number' && Number.isFinite(explicit)) return Math.max(0, explicit);
  return options.panOnDrag ? DEFAULT_TAP_TOLERANCE_PX : null;
}

/**
 * 创建指针手势跟踪器。
 *
 * @param options 缺省容差。
 * @returns 跟踪器；`up()` 给出 `'tap'` 或 `'drag'`。
 *
 * @example
 * const tracker = createPointerGestureTracker()
 * tracker.down({ x: e.clientX, y: e.clientY })
 * // 只在越过容差后启用指针捕获：轻点保留原生 click，拖拽则把它重定向到容器
 * if (tracker.move(point) && !captured) { el.setPointerCapture(e.pointerId); captured = true }
 * const kind = tracker.up(point) // 'tap' | 'drag'
 */
export function createPointerGestureTracker(options: PointerGestureTrackerOptions = {}): PointerGestureTracker {
  const fallback = options.tolerancePx;
  let start: PointerPoint | null = null;
  let current: PointerPoint | null = null;

  const distance = (): number => {
    if (!start || !current) return 0;
    return Math.hypot(current.x - start.x, current.y - start.y);
  };

  const resolve = (tolerancePx?: number | null): number =>
    normalizeTolerance(tolerancePx === undefined ? fallback : tolerancePx);

  const exceeded = (tolerancePx?: number | null): boolean => Boolean(start) && distance() > resolve(tolerancePx);

  return {
    down(point) {
      start = point;
      current = point;
    },
    move(point, tolerancePx) {
      if (!start) return false;
      current = point;
      return exceeded(tolerancePx);
    },
    up(point, tolerancePx) {
      if (point && start) current = point;
      return exceeded(tolerancePx) ? 'drag' : 'tap';
    },
    hasMoved: (tolerancePx) => exceeded(tolerancePx),
    delta() {
      if (!start || !current) return { x: 0, y: 0 };
      return { x: current.x - start.x, y: current.y - start.y };
    },
    distance,
    reset() {
      start = null;
      current = null;
    },
  };
}
