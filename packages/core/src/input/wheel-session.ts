/**
 * input/wheel-session —— 滚轮类事件的判型与会话累积（唯一真相源）。
 *
 * 本模块承载两条既有的、已在真机验证过的知识：
 *
 * 1. **三分判型**：鼠标滚轮 / 触控板双指平移 / 触控板捏合。
 *    此前该判定写在 `view-canvas`，只有单一模板能用；上移后
 *    `view-world`、宿主自有画布与输入引擎共用同一套口径。
 * 2. **会话累积**：`wheel` 是高频碎事件，一次「上滚一格」可能产生多个事件。
 *    识别器需要一个把碎事件归并成「一格」的层，否则 `wheel:up` 会连发。
 *
 * 判型顺序不可调换，理由见 {@link classifyWheel}。
 */

/** 滚轮类手势的三种语义。 */
export type WheelGesture = 'pinch' | 'pan' | 'zoom';

/** `classifyWheel` 的输入：只取判定所需字段，便于纯函数单测。 */
export type WheelLike = {
  ctrlKey: boolean;
  metaKey: boolean;
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  /**
   * 与上一滚轮事件的间隔（毫秒）。**可选**：提供时启用「事件流密度」判据；
   * 缺失时退回按单次 delta 大小判（见 {@link classifyWheel}）。
   */
  intervalMs?: number;
};

/** 触控板平移判定阈值：像素模式下纵向滚轮小于此值视为触控板。 */
export const TRACKPAD_PAN_MAX_DELTA_Y = 40;

/**
 * 触控板事件流密度阈值（毫秒）。
 *
 * **为什么需要第二个判据**：单看 `|deltaY|` 无法区分「触控板快扫」与「鼠标滚轮」——
 * 触控板快速轻扫可以产生 `|deltaY| ≥ 40` 的整数事件，于是被判成鼠标滚轮
 * → 表现为「一快扫就变成缩放」（2026-10-24 起一直记为「阈值 40 待真机判读」）。
 *
 * 但**事件流形态**是可区分的：触控板是连续的 60/120Hz 流（间隔通常 < 16ms），
 * 鼠标滚轮是离散的「一格一个事件」（人手极限约 10 格/秒，间隔 ≥ 100ms）。
 * 故当 `intervalMs` 可用时，**密集流优先按触控板处理**，不再依赖单次 delta 大小。
 *
 * 取值 24ms：120Hz 一帧约 8.3ms、60Hz 约 16.7ms，24ms 留一帧余量；
 * 既不会把 60Hz 流误判成鼠标，也不会把快速连拨滚轮误判成触控板。
 */
export const TRACKPAD_STREAM_MAX_INTERVAL_MS = 24;

/** 鼠标滚轮缩放灵敏度（指数底数系数）。 */
export const WHEEL_ZOOM_SPEED = 0.0016;

/**
 * 触控板捏合缩放灵敏度。
 *
 * 为何与鼠标滚轮分开：macOS 触控板捏合产生的 `wheel` 事件 `deltaY` 通常只有
 * ±1..±30（远小于鼠标滚轮的 ±100），套用 `WHEEL_ZOOM_SPEED` 时
 * `exp(-4 × 0.0016) ≈ 0.9936`，每次只缩放 0.6% —— 表现为「捏合几乎没反应」。
 */
export const PINCH_ZOOM_SPEED = 0.01;

/**
 * 判定一次 `wheel` 事件属于哪种手势。
 *
 * 判定顺序不可调换：
 *
 * 1. `ctrlKey`/`metaKey` → **捏合**。这是浏览器对触控板捏合的既定约定
 *    （Safari/Chrome 都置 `ctrlKey=true`），也是 Cmd+滚轮的语义，均属缩放。
 * 2. `deltaMode !== 0`（行/页模式）→ 老式鼠标滚轮 → 缩放。
 * 3. `deltaX !== 0` → 触控板横向平移。鼠标滚轮**不产生**横向分量，故这是可靠的触控板特征。
 * 4. `|deltaY|` 非整数 → 触控板（其上报为浮点）；鼠标滚轮上报整数刻度。
 * 5. `intervalMs` 可用且 ≤ {@link TRACKPAD_STREAM_MAX_INTERVAL_MS} → **触控板流** → 平移。
 *    **这条在 `|deltaY|` 判据之前**，专治「触控板快扫被当成鼠标滚轮」。
 * 6. `|deltaY| < TRACKPAD_PAN_MAX_DELTA_Y` → 小幅滚动，按触控板平移处理。
 * 7. 其余 → 鼠标滚轮 → 缩放。
 *
 * ## 关于流首事件（`intervalMs === undefined`）
 *
 * 一次手势的**第一个事件天然没有前驱**，故它只能走 6/7 的 delta 判据。
 * 对触控板快扫而言，首个事件的大整数 delta 会被判成 `zoom` —— 表现为
 * 「快扫的第一下会轻微缩放，随后才平移」。
 *
 * 这是**已知残余**，不是遗漏：要修它必须让首个事件延迟一个窗口等后续
 * （约 24ms），而滚轮在滚动界面下**每一个格都是新突发的首事件**，
 * 全局加延迟会伤到最常见场景。取舍需使用者在真机上手后裁决，
 * 不由实现方单方面决定。真机若确认「首下跳一下」不可接受，再加突发分类器。
 *
 * @param event 具备 `ctrlKey` / `metaKey` / `deltaX` / `deltaY` / `deltaMode`，
 *   可选 `intervalMs` 的事件。
 * @returns 手势语义。
 * @example
 * classifyWheel({ ctrlKey: true, metaKey: false, deltaX: 0, deltaY: 4, deltaMode: 0 }) // 'pinch'
 * classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 12, deltaY: -3, deltaMode: 0 }) // 'pan'
 * classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -100, deltaMode: 0 }) // 'zoom'
 * // 触控板快扫（流中间的事件）：大整数 delta，但间隔仅 8ms → 平移
 * classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -55, deltaMode: 0, intervalMs: 8 }) // 'pan'
 * // 鼠标滚轮：一格，间隔 120ms → 缩放
 * classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -100, deltaMode: 0, intervalMs: 120 }) // 'zoom'
 */
export function classifyWheel(event: WheelLike): WheelGesture {
  if (event.ctrlKey || event.metaKey) return 'pinch';
  if (event.deltaMode !== 0) return 'zoom';
  if (event.deltaX !== 0) return 'pan';
  if (!Number.isInteger(event.deltaY)) return 'pan';
  // 事件流密度：密集流必是触控板（鼠标滚轮不会 24ms 内连发）
  if (
    typeof event.intervalMs === 'number'
    && Number.isFinite(event.intervalMs)
    && event.intervalMs >= 0
    && event.intervalMs <= TRACKPAD_STREAM_MAX_INTERVAL_MS
  ) {
    return 'pan';
  }
  if (Math.abs(event.deltaY) < TRACKPAD_PAN_MAX_DELTA_Y) return 'pan';
  return 'zoom';
}

/**
 * 触控板平移的**屏幕**位移。
 *
 * 取负号：滚轮向上（`deltaY < 0`）应使内容上移，
 * 与 Figma/Excalidraw 的「双指推内容」一致。
 *
 * @param event 具备 `deltaX` / `deltaY` 的事件。
 * @returns 屏幕位移。
 */
export function wheelPanDelta(event: { deltaX: number; deltaY: number }): { x: number; y: number } {
  return { x: -event.deltaX, y: -event.deltaY };
}

/** 由鼠标滚轮 deltaY 计算缩放倍率。 */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * WHEEL_ZOOM_SPEED);
}

/** 由捏合 deltaY 计算缩放倍率（灵敏度高于鼠标滚轮）。 */
export function pinchZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * PINCH_ZOOM_SPEED);
}

/** 滚轮方向。 */
export type WheelDirection = 'up' | 'down' | 'left' | 'right';

/** 一格累积结果的语义。 */
export type WheelStep = {
  dir: WheelDirection;
  /** 该格累计的原始增量（带符号）。 */
  delta: number;
};

/** 会话累积器。 */
export type WheelAccumulator = {
  /**
   * 喂入一次增量，返回已达成的格数（0 表示尚不足一格）。
   *
   * @param dx 横向增量。
   * @param dy 纵向增量。
   * @param t 事件时间戳（毫秒）。
   */
  feed: (dx: number, dy: number, t: number) => WheelStep[];
  /** 当前累计量（供诊断）。 */
  peek: () => { dx: number; dy: number };
  /** 清空累积。 */
  reset: () => void;
};

/** 累积器选项。 */
export type WheelAccumulatorOptions = {
  /** 一格阈值。 */
  stepDelta: number;
  /** 会话空闲切分（毫秒）；超时则清空累积，避免跨会话合并。 */
  idleMs: number;
};

/**
 * 创建滚轮会话累积器。
 *
 * 为何需要：`wheel` 高频且量值不整（触控板平移是连续的浮点流）。
 * 若每个事件都判定一次方向，`wheel:up` 会在一次手势内连发几十次。
 *
 * @param options 阈值与空闲切分。
 * @returns 累积器；`feed` 返回本事件**新达成**的格。
 * @example
 * const acc = createWheelAccumulator({ stepDelta: 40, idleMs: 120 })
 * acc.feed(0, -20, 0)  // []
 * acc.feed(0, -25, 16) // [{ dir: 'up', delta: -45 }]
 */
export function createWheelAccumulator(options: WheelAccumulatorOptions): WheelAccumulator {
  let dx = 0;
  let dy = 0;
  let lastT = Number.NEGATIVE_INFINITY;

  const reset = () => {
    dx = 0;
    dy = 0;
  };

  return {
    feed(nextDx, nextDy, t) {
      if (t - lastT > options.idleMs) reset();
      lastT = t;
      dx += nextDx;
      dy += nextDy;

      const steps: WheelStep[] = [];
      const threshold = Math.max(1, options.stepDelta);
      // 每格上报的 `delta` 固定为 ±threshold：它表示「本格消耗量」，
      // 余量留在累积器里等下一次。若上报累计值，调用方无法区分
      // 「一格」与「一格后又累积一半」。
      // 纵向优先：滚轮的主要语义是纵向；横向只在纵向未达阈值时才考虑
      while (Math.abs(dy) >= threshold) {
        const dir: WheelDirection = dy > 0 ? 'down' : 'up';
        steps.push({ dir, delta: dir === 'down' ? threshold : -threshold });
        dy += dir === 'down' ? -threshold : threshold;
      }
      while (Math.abs(dx) >= threshold) {
        const dir: WheelDirection = dx > 0 ? 'right' : 'left';
        steps.push({ dir, delta: dir === 'right' ? threshold : -threshold });
        dx += dir === 'right' ? -threshold : threshold;
      }
      return steps;
    },
    peek: () => ({ dx, dy }),
    reset,
  };
}
