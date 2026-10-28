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

/** 滚轮事件的**设备**来源。决定灵敏度档（两者 delta 量级差约两个数量级）。 */
export type WheelDevice = 'trackpad' | 'mouse';

/** 滚轮事件的**修饰键**状态。只作语义记录，不参与设备判定。 */
export type WheelModifier = 'none' | 'ctrl' | 'meta' | 'shift';

/**
 * 一次滚轮事件的**三维读数**。
 *
 * 三个维度互不推导：设备决定灵敏度，意图决定动作，修饰键记录语义覆盖。
 */
export type WheelReading = {
  /** 事件来自哪种设备（决定用哪个缩放灵敏度）。 */
  device: WheelDevice;
  /** 该事件应触发缩放还是平移。 */
  intent: 'zoom' | 'pan';
  /** 按下的修饰键（`shift` 仅记录，不改变 `intent`）。 */
  modifier: WheelModifier;
};

/**
 * `readWheel` / `classifyWheel` 的输入：只取判定所需字段，便于纯函数单测。
 */
export type WheelLike = {
  ctrlKey: boolean;
  metaKey: boolean;
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  /** 是否按下 Shift（可选；仅记录进 `modifier`，不影响 `intent`）。 */
  shiftKey?: boolean;
  /**
   * 与上一滚轮事件的间隔（毫秒）。**可选**：提供时启用「事件流密度」判据；
   * 缺失时退回按单次 delta 大小判（见 {@link readWheel}）。
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
 * 读取一次 `wheel` 事件的**三维读数**（设备 · 意图 · 修饰键）。
 *
 * 这是滚轮判型的**唯一真相源**。此前该判定分散在三处：本模块的一维
 * `classifyWheel`、`rendering/interactions` 的仅看 `ctrlKey` 的
 * `classifyWheelIntent`、以及 Pixi 内核里完全没有判型的一律缩放 ——
 * 导致同一个鼠标在不同模板上表现不同。
 *
 * ## 设备判定顺序不可调换
 *
 * 1. `deltaMode !== 0`（行/页模式）→ **鼠标**。触控板从不上报非像素模式。
 * 2. `deltaX !== 0` → **触控板**横向平移。鼠标滚轮不产生横向分量。
 * 3. `|deltaY|` 非整数 → **触控板**（其上报为浮点）；鼠标上报整数刻度。
 * 4. `intervalMs` ≤ {@link TRACKPAD_STREAM_MAX_INTERVAL_MS} → **触控板流**。
 *    **这条在 `|deltaY|` 判据之前**，专治「触控板快扫被当成鼠标滚轮」。
 * 5. `|deltaY| < {@link TRACKPAD_PAN_MAX_DELTA_Y}` → **触控板**小幅滚动。
 * 6. 其余 → **鼠标**。
 *
 * ## 意图判定
 *
 * - `Ctrl` / `Meta` → **缩放**。浏览器把「触控板捏合」与「Ctrl/⌘+滚轮」都上报为
 *   带 `ctrlKey` 的 wheel；视口内一律解释为画布缩放（页面缩放已被②拦截），
 *   语义归属为既定事实。
 * - 否则：**触控板 → 平移**（双指推内容）；**鼠标 → 缩放**。
 *
 * **设备与意图分离的收益**：`Ctrl + 鼠标滚轮` 现在得到
 * `{ device: 'mouse', intent: 'zoom' }` ⇒ 走鼠标灵敏度；而触控板捏合得到
 * `{ device: 'trackpad', intent: 'zoom' }` ⇒ 走捏合灵敏度。两者不再共用系数。
 *
 * ## 关于流首事件（`intervalMs === undefined`）
 *
 * 一次手势的**第一个事件天然没有前驱**，故只能走 2–5 / 6 的 delta 判据。
 * 对触控板快扫而言，首个事件的大整数 delta 会被判成鼠标 → 缩放，表现为
 * 「快扫的第一下会轻微缩放，随后才平移」。
 *
 * 这是**已知残余**，不是遗漏：要修它必须让首个事件延迟一个窗口等后续
 * （约 24ms），而滚轮在滚动界面下**每一个格都是新突发的首事件**，
 * 全局加延迟会伤到最常见场景。取舍需使用者在真机上手后裁决，
 * 不由实现方单方面决定。真机若确认「首下跳一下」不可接受，再加突发分类器。
 *
 * @param event 具备 `ctrlKey` / `metaKey` / `deltaX` / `deltaY` / `deltaMode`，
 *   可选 `shiftKey` / `intervalMs` 的事件。
 * @returns 三维读数。
 * @example
 * // 触控板捏合：小 delta + 带 ctrlKey
 * readWheel({ ctrlKey: true, metaKey: false, deltaX: 0, deltaY: 4, deltaMode: 0 })
 * // → { device: 'trackpad', intent: 'zoom', modifier: 'ctrl' }
 *
 * // Ctrl + 鼠标滚轮：大整数 delta + 带 ctrlKey → 走鼠标灵敏度，不再爆倍率
 * readWheel({ ctrlKey: true, metaKey: false, deltaX: 0, deltaY: -100, deltaMode: 0 })
 * // → { device: 'mouse', intent: 'zoom', modifier: 'ctrl' }
 *
 * // 触控板双指平移
 * readWheel({ ctrlKey: false, metaKey: false, deltaX: 12, deltaY: -3, deltaMode: 0 })
 * // → { device: 'trackpad', intent: 'pan', modifier: 'none' }
 *
 * // 鼠标滚轮
 * readWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -100, deltaMode: 0 })
 * // → { device: 'mouse', intent: 'zoom', modifier: 'none' }
 */
export function readWheel(event: WheelLike): WheelReading {
  const modifier: WheelModifier = event.ctrlKey
    ? 'ctrl'
    : event.metaKey
      ? 'meta'
      : event.shiftKey
        ? 'shift'
        : 'none';

  const device = detectWheelDevice(event);
  const wantsZoom = modifier === 'ctrl' || modifier === 'meta';
  const intent: WheelReading['intent'] = wantsZoom ? 'zoom' : (device === 'trackpad' ? 'pan' : 'zoom');

  return { device, intent, modifier };
}

/**
 * 判定滚轮事件的**设备**来源（`readWheel` 的设备维度，单独导出便于单测）。
 *
 * @param event 具备 `deltaX` / `deltaY` / `deltaMode`，可选 `intervalMs` 的事件。
 * @returns 设备来源。
 */
export function detectWheelDevice(event: WheelLike): WheelDevice {
  // 行/页模式：只有老式鼠标滚轮会上报（触控板恒为像素模式）
  if (event.deltaMode !== 0) return 'mouse';
  // 横向分量：鼠标滚轮不产生，是可靠的触控板特征
  if (event.deltaX !== 0) return 'trackpad';
  // 浮点 delta：触控板连续流；鼠标上报整数刻度
  if (!Number.isInteger(event.deltaY)) return 'trackpad';
  // 事件流密度：密集流必是触控板（鼠标滚轮人手极限约 10 格/秒）
  if (
    typeof event.intervalMs === 'number'
    && Number.isFinite(event.intervalMs)
    && event.intervalMs >= 0
    && event.intervalMs <= TRACKPAD_STREAM_MAX_INTERVAL_MS
  ) {
    return 'trackpad';
  }
  if (Math.abs(event.deltaY) < TRACKPAD_PAN_MAX_DELTA_Y) return 'trackpad';
  return 'mouse';
}

/**
 * 判定一次 `wheel` 事件属于哪种手势（`readWheel` 的一维投影，保留作兼容面）。
 *
 * 新代码应优先用 {@link readWheel} —— 三维读数能让调用方对
 * `Ctrl/⌘ + 鼠标滚轮` 与「触控板捏合」选用不同灵敏度；本函数把两者
 * 都压成 `'pinch'` 以外的一维语义时已尽量区分（见下）。
 *
 * 映射规则：
 *
 * | 读数 | 结果 |
 * | --- | --- |
 * | `ctrl`/`meta` + 触控板 | `'pinch'` |
 * | `ctrl`/`meta` + 鼠标 | `'zoom'` ← **与旧行为的差异点** |
 * | 触控板、无修饰键 | `'pan'` |
 * | 鼠标、无修饰键 | `'zoom'` |
 *
 * **与旧行为的差异（有意修复）**：旧实现把 `Ctrl + 鼠标滚轮` 也判成 `'pinch'`，
 * 于是套用为触控板小 delta 设计的 `PINCH_ZOOM_SPEED`；鼠标 deltaY 是 ±100 量级，
 * 每次事件倍率 `exp(100 × 0.01) ≈ 2.718`，连拨两次即撞上 `maxScale`。
 * 这是语义耦合，不是参数调错。
 *
 * @param event 具备 `ctrlKey` / `metaKey` / `deltaX` / `deltaY` / `deltaMode`，
 *   可选 `shiftKey` / `intervalMs` 的事件。
 * @returns 手势语义。
 * @example
 * classifyWheel({ ctrlKey: true, metaKey: false, deltaX: 0, deltaY: 4, deltaMode: 0 }) // 'pinch'
 * classifyWheel({ ctrlKey: true, metaKey: false, deltaX: 0, deltaY: -100, deltaMode: 0 }) // 'zoom'
 * classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 12, deltaY: -3, deltaMode: 0 }) // 'pan'
 * classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -100, deltaMode: 0 }) // 'zoom'
 * // 触控板快扫（流中间的事件）：大整数 delta，但间隔仅 8ms → 平移
 * classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -55, deltaMode: 0, intervalMs: 8 }) // 'pan'
 */
export function classifyWheel(event: WheelLike): WheelGesture {
  const { device, intent, modifier } = readWheel(event);
  if (intent === 'pan') return 'pan';
  return modifier === 'ctrl' || modifier === 'meta'
    ? (device === 'trackpad' ? 'pinch' : 'zoom')
    : 'zoom';
}

/**
 * 按三维读数选取缩放倍率。
 *
 * **这是缩放灵敏度的唯一选取点**：调用方不再自己判断该用哪个系数。
 *
 * @param reading `readWheel` 的读数。
 * @param deltaY 该事件的纵向增量。
 * @returns 缩放倍率。
 * @example
 * const r = readWheel(event)
 * const factor = zoomFactorOf(r, event.deltaY)
 */
export function zoomFactorOf(reading: WheelReading, deltaY: number): number {
  const speed = reading.device === 'trackpad' ? PINCH_ZOOM_SPEED : WHEEL_ZOOM_SPEED;
  return Math.exp(-deltaY * speed);
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
