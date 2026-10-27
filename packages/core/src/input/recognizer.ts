/**
 * input/recognizer —— 信号 → 手势。
 *
 * 三层分离中的第二层：它不认识命令，也不认识绑定；只回答
 * 「刚才这串信号，构成了什么手势」。
 *
 * 输出的手势带 `phase` 语义（仅连续手势有 `update` 与 `end`），
 * 因此拖拽、捏合、平移这类连续操作可以被流式绑定消费。
 */
import type {
  GesturePattern,
  InputSignal,
  InputTimings,
  KeyRef,
  PinchSignal,
  PointerButtonSignal,
  PointerMoveSignal,
  Vec2,
  WheelSignal,
} from './types';
import { DEFAULT_INPUT_TIMINGS, isModifierCode, NO_MODIFIERS } from './types';
import type { InputSession } from './session';
import { createWheelAccumulator, type WheelAccumulator, type WheelDirection } from './wheel-session';

/** 识别结果：一个手势 + 触发阶段 + 增量。 */
export type RecognizedGesture = {
  gesture: GesturePattern;
  phase: 'begin' | 'update' | 'end';
  /** 增量：拖拽/捏合/平移用。 */
  delta?: { dx: number; dy: number; scale?: number; rotation?: number };
  /** 该手势是否来自被吞掉的输入（供路由层决定是否 `preventDefault`）。 */
  signal: InputSignal;
};

/** 识别器选项。 */
export type RecognizerOptions = {
  timings?: Partial<InputTimings>;
  session: InputSession;
};

/** 识别器。 */
export type Recognizer = {
  /** 喂入一个信号，返回本次可确认的手势（可能为空）。 */
  feed: (signal: InputSignal) => RecognizedGesture[];
  /** 清空内部状态（不清空外部 session）。 */
  reset: () => void;
};

/** 把按键引用归一为物理键位字符串（用于 chord 比对）。 */
export function keyRefCode(target: KeyRef): string {
  return 'code' in target ? target.code : target.key;
}

/** 鼠标键 → `PointerEvent.buttons` 位掩码。 */
export function buttonToMask(button: number): number {
  switch (button) {
    case 0:
      return 1;
    case 1:
      return 4;
    case 2:
      return 2;
    case 3:
      return 8;
    case 4:
      return 16;
    default:
      return 0;
  }
}

/** 判断 `buttons` 掩码中是否含某键。 */
export function maskHas(buttons: number, button: number): boolean {
  const mask = buttonToMask(button);
  return mask !== 0 && (buttons & mask) !== 0;
}

/** 由水平/垂直位移确定甩动方向（取绝对值较大的一轴）。 */
export function swipeDirection(totalX: number, totalY: number): 'left' | 'right' | 'up' | 'down' {
  if (Math.abs(totalX) >= Math.abs(totalY)) return totalX > 0 ? 'right' : 'left';
  return totalY > 0 ? 'down' : 'up';
}

/** 拖拽方向（分轴时只看该轴）。 */
export function dragAxisDelta(totalDx: number, totalDy: number, axis?: 'x' | 'y'): Vec2 {
  if (axis === 'x') return { x: totalDx, y: 0 };
  if (axis === 'y') return { x: 0, y: totalDy };
  return { x: totalDx, y: totalDy };
}

/** 判断位移是否越过阈值。 */
export function exceedsThreshold(dx: number, dy: number, axis: 'x' | 'y' | undefined, minPx: number): boolean {
  if (axis === 'x') return Math.abs(dx) >= minPx;
  if (axis === 'y') return Math.abs(dy) >= minPx;
  return Math.hypot(dx, dy) >= minPx;
}

/**
 * 创建识别器。
 *
 * @param options 时序阈值与会话。
 * @returns 识别器。
 * @example
 * const recognizer = createRecognizer({ session: createInputSession() })
 * const gestures = recognizer.feed({ phase: 'down', source: 'keyboard', code: 'KeyG', key: 'g', mods: NO_MODIFIERS, repeat: false, t: 0 })
 */
export function createRecognizer(options: RecognizerOptions): Recognizer {
  const timings: InputTimings = { ...DEFAULT_INPUT_TIMINGS, ...options.timings };
  const session = options.session;
  const wheel: WheelAccumulator = createWheelAccumulator({
    stepDelta: timings.wheelStepDelta,
    idleMs: timings.wheelSessionIdleMs,
  });

  const results: RecognizedGesture[] = [];

  const push = (
    gesture: GesturePattern,
    phase: RecognizedGesture['phase'],
    signal: InputSignal,
    delta?: RecognizedGesture['delta'],
  ): void => {
    const entry: RecognizedGesture = { gesture, phase, signal };
    if (delta) entry.delta = delta;
    results.push(entry);
  };

  const handleKeyboard = (signal: Extract<InputSignal, { source: 'keyboard' }>) => {
    session.mods = signal.mods;
    const target: KeyRef = { code: signal.code };

    if (signal.phase === 'down') {
      if (!signal.repeat) {
        session.pressedKeys.add(signal.code);
        session.keyDownAt.set(signal.code, signal.t);
      }
      // 纯修饰键不产 press/hold/repeat：浏览器给不出「按住」的独立语义，
      // 允许它们触发会让组合键永远无法按下（见设计第十一节 §6）。
      if (isModifierCode(signal.code)) return;
      // 按住某修饰键期间触发过组合键 → 该修饰键抬起时不再触发 release/tap
      markConsumedModifiers();
      push({ kind: signal.repeat ? 'repeat' : 'press', target }, 'begin', signal);
      return;
    }

    // phase === 'up'
    session.pressedKeys.delete(signal.code);
    const startedAt = session.keyDownAt.get(signal.code);
    session.keyDownAt.delete(signal.code);
    if (isModifierCode(signal.code)) {
      session.consumedModifiers.delete(signal.code);
      return;
    }
    const heldMs = signal.heldMs ?? (startedAt !== undefined ? signal.t - startedAt : 0);
    push({ kind: 'release', target, heldMs: { min: 0 } }, 'end', signal);
    void heldMs;
  };

  /**
   * 记录「本次按键发生时按住了修饰键」，供修饰键抬起时判断是否已被消费。
   *
   * 判据：非修饰键的按下事件若带任一修饰键，则这些修饰键被标记为已消费。
   */
  const markConsumedModifiers = () => {
    // 由 handleKeyboard 在 down 分支调用；修饰键状态取自 session.mods
    const mods = session.mods;
    if (mods.shift) mark('ShiftLeft', 'ShiftRight');
    if (mods.ctrl) mark('ControlLeft', 'ControlRight');
    if (mods.alt) mark('AltLeft', 'AltRight');
    if (mods.meta) mark('MetaLeft', 'MetaRight');
  };

  const mark = (...codes: string[]) => {
    for (const code of codes) {
      if (session.pressedKeys.has(code)) session.consumedModifiers.add(code);
    }
  };

  const handlePointerButton = (signal: PointerButtonSignal) => {
    session.mods = signal.mods;

    if (signal.phase === 'down') {
      session.pressedButtons.add(signal.button);
      session.drag = {
        button: signal.button,
        start: { ...signal.pos },
        current: { ...signal.pos },
        active: false,
        totalDx: 0,
        totalDy: 0,
      };
      return;
    }

    // up：先结算拖拽，再结算点击
    session.pressedButtons.delete(signal.button);
    const drag = session.drag;
    session.drag = null;

    if (drag && drag.button === signal.button) {
      const totalDx = signal.pos.x - drag.start.x;
      const totalDy = signal.pos.y - drag.start.y;
      if (drag.active) {
        push(
          { kind: 'drag', button: signal.button, minPx: timings.dragMinPx },
          'end',
          signal,
          { dx: totalDx, dy: totalDy },
        );
        session.lastClick = null;
        return;
      }
    }

    // 双击合成：同键 + 间隔 ≤ doubleClickMs
    const previous = session.lastClick;
    if (previous && previous.button === signal.button && signal.t - previous.at <= timings.doubleClickMs) {
      session.lastClick = null;
      push({ kind: 'click', button: signal.button, count: 2 }, 'begin', signal);
      return;
    }
    session.lastClick = { button: signal.button, at: signal.t, count: 1 };
    push({ kind: 'click', button: signal.button, count: 1 }, 'begin', signal);
  };

  const handlePointerMove = (signal: PointerMoveSignal) => {
    const drag = session.drag;
    if (drag && maskHas(signal.buttons, drag.button)) {
      drag.current = { ...signal.pos };
      drag.totalDx += signal.dx;
      drag.totalDy += signal.dy;
      if (!drag.active) {
        const distance = Math.hypot(signal.pos.x - drag.start.x, signal.pos.y - drag.start.y);
        if (distance >= timings.dragMinPx) {
          drag.active = true;
          push({ kind: 'drag', button: drag.button, minPx: timings.dragMinPx }, 'begin', signal, {
            dx: drag.totalDx,
            dy: drag.totalDy,
          });
          return;
        }
      }
      if (drag.active) {
        push({ kind: 'drag', button: drag.button, minPx: timings.dragMinPx }, 'update', signal, {
          dx: drag.totalDx,
          dy: drag.totalDy,
        });
      }
    }

    if (signal.buttons === 0) return;
    // 触控板平移会话在 wheel 事件里维护；此处仅用于「按住某键拖拽」的手势路径
  };

  const handleWheel = (signal: WheelSignal) => {
    session.mods = signal.mods;

    if (signal.kind === 'pan') {
      const pan = session.pan;
      if (!pan || signal.t - pan.lastAt > timings.wheelSessionIdleMs) {
        session.pan = { startedAt: signal.t, lastAt: signal.t, totalX: signal.dx, totalY: signal.dy };
        return;
      }
      pan.lastAt = signal.t;
      pan.totalX += signal.dx;
      pan.totalY += signal.dy;
      // 会话结束时（空闲超时由 flush 阶段处理）才判定甩动；此处不发
      return;
    }

    // notch：按格累积
    for (const step of wheel.feed(signal.dx, signal.dy, signal.t)) {
      push({ kind: 'wheel', dir: step.dir, minDelta: timings.wheelStepDelta }, 'begin', signal);
    }
  };

  const handlePinch = (signal: PinchSignal) => {
    session.mods = signal.mods;
    const pinch = session.pinch;
    if (!pinch || signal.t - pinch.lastAt > timings.wheelSessionIdleMs) {
      session.pinch = { total: signal.scale, steps: 0, lastAt: signal.t };
      if (Math.abs(signal.scale) >= timings.pinchMinScale) {
        session.pinch.steps = signal.scale > 0 ? 1 : -1;
        push({ kind: 'pinch', dir: signal.scale > 0 ? 'out' : 'in', minScale: timings.pinchMinScale }, 'begin', signal, {
          dx: 0,
          dy: 0,
          scale: signal.scale,
        });
      }
      return;
    }
    pinch.lastAt = signal.t;
    pinch.total += signal.scale;
    const nextSteps = Math.trunc(pinch.total / timings.pinchMinScale);
    if (nextSteps !== pinch.steps) {
      const dir = nextSteps > pinch.steps ? 'out' : 'in';
      pinch.steps = nextSteps;
      push({ kind: 'pinch', dir, minScale: timings.pinchMinScale }, 'update', signal, {
        dx: 0,
        dy: 0,
        scale: pinch.total,
      });
    }
  };

  const handleNativeGesture = (signal: Extract<InputSignal, { source: 'native' | 'safari' }>) => {
    if (signal.kind === 'rotate' && typeof signal.rotation === 'number') {
      push({ kind: 'rotate', dir: signal.rotation >= 0 ? 'cw' : 'ccw', minDeg: 15 }, 'update', signal, {
        dx: 0,
        dy: 0,
        rotation: signal.rotation,
      });
      return;
    }
    if (signal.kind === 'pinch' && typeof signal.scale === 'number') {
      const scale = signal.scale - 1;
      push({ kind: 'pinch', dir: scale >= 0 ? 'out' : 'in', minScale: timings.pinchMinScale }, 'update', signal, {
        dx: 0,
        dy: 0,
        scale,
      });
    }
  };

  return {
    feed(signal) {
      results.length = 0;
      switch (signal.source) {
        case 'keyboard':
          handleKeyboard(signal);
          break;
        case 'pointer':
          if (signal.phase === 'move') handlePointerMove(signal);
          else handlePointerButton(signal);
          break;
        case 'wheel':
          if (signal.phase === 'pinch') handlePinch(signal);
          else handleWheel(signal);
          break;
        default:
          handleNativeGesture(signal);
          break;
      }
      return [...results];
    },
    reset() {
      results.length = 0;
      wheel.reset();
    },
  };
}

/**
 * 结算触控板平移会话：在空闲阈值后调用，把已累积的位移判为甩动。
 *
 * 之所以需要显式结算：甩动是「一段连续平移」的整体属性，
 * 只有等会话静下来才能知道速度与总距离。
 *
 * @param session 输入会话。
 * @param timings 时序阈值。
 * @param now 当前时间。
 * @returns 是否构成甩动及其方向。
 */
export function settleSwipe(
  session: InputSession,
  timings: Partial<InputTimings>,
  now: number,
): { dir: 'left' | 'right' | 'up' | 'down' } | null {
  const merged = { ...DEFAULT_INPUT_TIMINGS, ...timings };
  const pan = session.pan;
  if (!pan) return null;
  if (now - pan.lastAt <= merged.wheelSessionIdleMs) return null;
  session.pan = null;
  const duration = pan.lastAt - pan.startedAt;
  const distance = Math.hypot(pan.totalX, pan.totalY);
  if (distance < merged.swipeMinPx) return null;
  if (duration > merged.swipeMaxMs) return null;
  return { dir: swipeDirection(pan.totalX, pan.totalY) };
}

/** 导出供外部复用的空修饰键（避免调用方各自构造）。 */
export const EMPTY_MODIFIERS = NO_MODIFIERS;

/** 供测试与诊断：把方向常量集中导出。 */
export type { WheelDirection };