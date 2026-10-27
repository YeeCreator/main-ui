/**
 * input/dom —— DOM 事件 → 归一化信号的输入源。
 *
 * 职责边界：**只做归一，不做识别**。本层产出 {@link InputSignal}，
 * 不判断「这算不算长按」「这算不算双击」——那是识别层的事。
 *
 * 三条关键处理：
 *
 * 1. **滚轮判型在归一阶段完成**（`kind: 'notch' | 'pan'`），
 *    下游不再各自判 `deltaX` / `ctrlKey`。
 * 2. **`ctrlKey` 的 wheel 直接转成 `pinch` 信号**，不再下发 `wheel`，
 *    避免捏合被当成滚轮误触发。
 * 3. **`pointermove` / `wheel` 按帧合并**：高频输入只在每帧产出一个信号，
 *    避免识别器被无意义的中间态淹没。
 */
import type { InputSignal, InputModifiers, Vec2 } from '../types';
import { classifyWheel, type WheelLike } from '../wheel-session';

/** 输入源统一的启停契约。 */
export type InputSource = {
  /** 启动监听；返回卸载函数（必须幂等）。 */
  start: (emit: (signal: InputSignal) => void) => () => void;
  /** 源标识（诊断用）。 */
  readonly id: string;
};

/** DOM 输入源选项。 */
export type DomInputSourceOptions = {
  /** 事件目标（缺省 `window`）。 */
  target?: EventTarget;
  /** 时钟（缺省 `performance.now`）。 */
  now?: () => number;
  /** 按帧合并的调度器（缺省 `requestAnimationFrame`，Node 下退化为直通）。 */
  schedule?: (handler: () => void) => void;
  /**
   * 是否在 `wheel` 上调用 `preventDefault`。
   *
   * 默认 **false**：是否吞掉滚动是宿主的策略，输入源不应替宿主决定。
   */
  preventWheelDefault?: boolean;
};

/** 读取修饰键快照。 */
export function modifiersOf(event: KeyboardEvent | PointerEvent | WheelEvent): InputModifiers {
  return {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };
}

/** 读取视口坐标。 */
function positionOf(event: PointerEvent | WheelEvent): Vec2 {
  return { x: event.clientX, y: event.clientY };
}

/** 创建按帧合并的调度器。 */
function defaultSchedule(handler: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => handler());
    return;
  }
  handler();
}

/**
 * 创建 DOM 输入源。
 *
 * @param options 选项。
 * @returns 输入源；`start` 返回卸载函数。
 * @example
 * const source = createDomInputSource(window)
 * const stop = source.start((signal) => router.feed(signal))
 */
export function createDomInputSource(options: DomInputSourceOptions = {}): InputSource {
  const target = options.target ?? (typeof window !== 'undefined' ? window : undefined);
  const now = options.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const schedule = options.schedule ?? defaultSchedule;
  const preventWheelDefault = options.preventWheelDefault ?? false;

  return {
    id: 'dom',
    start(emit) {
      if (!target) return () => undefined;

      /** 按键按下时间（用于 `up` 时计算按住时长）。 */
      const downAt = new Map<string, number>();

      const onKeyDown = (event: Event) => {
        const keyboard = event as KeyboardEvent;
        // 输入法组字期间的 keydown 不可靠，交由宿主或输入框自行处理
        if (keyboard.isComposing) return;
        const t = now();
        if (!keyboard.repeat) downAt.set(keyboard.code, t);
        emit({
          phase: 'down',
          source: 'keyboard',
          code: keyboard.code,
          key: keyboard.key,
          mods: modifiersOf(keyboard),
          repeat: keyboard.repeat,
          t,
        });
      };

      const onKeyUp = (event: Event) => {
        const keyboard = event as KeyboardEvent;
        const t = now();
        const startedAt = downAt.get(keyboard.code);
        downAt.delete(keyboard.code);
        const signal: InputSignal = {
          phase: 'up',
          source: 'keyboard',
          code: keyboard.code,
          key: keyboard.key,
          mods: modifiersOf(keyboard),
          repeat: false,
          t,
        };
        if (startedAt !== undefined) signal.heldMs = t - startedAt;
        emit(signal);
      };

      const onPointerDown = (event: Event) => {
        const pointer = event as PointerEvent;
        emit({
          phase: 'down',
          source: 'pointer',
          button: pointer.button,
          mods: modifiersOf(pointer),
          pos: positionOf(pointer),
          t: now(),
        });
      };

      const onPointerUp = (event: Event) => {
        const pointer = event as PointerEvent;
        emit({
          phase: 'up',
          source: 'pointer',
          button: pointer.button,
          mods: modifiersOf(pointer),
          pos: positionOf(pointer),
          t: now(),
        });
      };

      // ---- move 按帧合并 ----
      let pendingMove: { dx: number; dy: number; buttons: number; pos: Vec2 } | null = null;
      let moveScheduled = false;
      const flushMove = () => {
        moveScheduled = false;
        if (!pendingMove) return;
        const merged = pendingMove;
        pendingMove = null;
        emit({
          phase: 'move',
          source: 'pointer',
          dx: merged.dx,
          dy: merged.dy,
          buttons: merged.buttons,
          pos: merged.pos,
          t: now(),
        });
      };

      const onPointerMove = (event: Event) => {
        const pointer = event as PointerEvent;
        const dx = pointer.movementX ?? 0;
        const dy = pointer.movementY ?? 0;
        pendingMove = {
          dx: (pendingMove?.dx ?? 0) + dx,
          dy: (pendingMove?.dy ?? 0) + dy,
          buttons: pointer.buttons,
          pos: positionOf(pointer),
        };
        if (!moveScheduled) {
          moveScheduled = true;
          schedule(flushMove);
        }
      };

      // ---- wheel 按帧合并 + 判型 ----
      let pendingWheel: { kind: 'notch' | 'pan'; dx: number; dy: number; mods: InputModifiers; pos: Vec2 } | null = null;
      let wheelScheduled = false;

      const flushWheel = () => {
        wheelScheduled = false;
        if (!pendingWheel) return;
        const merged = pendingWheel;
        pendingWheel = null;
        emit({
          phase: 'wheel',
          source: 'wheel',
          kind: merged.kind,
          dx: merged.dx,
          dy: merged.dy,
          mods: merged.mods,
          pos: merged.pos,
          t: now(),
        });
      };

      const onWheel = (event: Event) => {
        const wheel = event as WheelEvent;
        const like: WheelLike = {
          ctrlKey: wheel.ctrlKey,
          metaKey: wheel.metaKey,
          deltaX: wheel.deltaX,
          deltaY: wheel.deltaY,
          deltaMode: wheel.deltaMode,
        };
        const kind = classifyWheel(like);
        if (preventWheelDefault) wheel.preventDefault();

        // 捏合直接产出 pinch 信号：不并入 wheel 累积，避免两种语义互相污染
        if (kind === 'pinch') {
          emit({
            phase: 'pinch',
            source: 'wheel',
            scale: -wheel.deltaY,
            mods: modifiersOf(wheel),
            pos: positionOf(wheel),
            t: now(),
          });
          return;
        }

        const mergedKind = kind === 'zoom' ? 'notch' : 'pan';
        if (pendingWheel && pendingWheel.kind !== mergedKind) flushWheel();
        pendingWheel = {
          kind: mergedKind,
          dx: (pendingWheel?.dx ?? 0) + wheel.deltaX,
          dy: (pendingWheel?.dy ?? 0) + wheel.deltaY,
          mods: modifiersOf(wheel),
          pos: positionOf(wheel),
        };
        if (!wheelScheduled) {
          wheelScheduled = true;
          schedule(flushWheel);
        }
      };

      // ---- Safari 触控板旋转 ----
      const onGestureStart = (event: Event) => {
        const gesture = event as Event & { scale?: number; rotation?: number };
        emit({
          phase: 'gesture',
          source: 'safari',
          kind: 'pinch',
          scale: gesture.scale ?? 1,
          t: now(),
        });
      };

      const onGestureChange = (event: Event) => {
        const gesture = event as Event & { scale?: number; rotation?: number };
        const rotation = gesture.rotation;
        if (typeof rotation === 'number') {
          emit({
            phase: 'gesture',
            source: 'safari',
            kind: 'rotate',
            rotation,
            scale: gesture.scale ?? 1,
            t: now(),
          });
          return;
        }
        emit({
          phase: 'gesture',
          source: 'safari',
          kind: 'pinch',
          scale: gesture.scale ?? 1,
          t: now(),
        });
      };

      target.addEventListener('keydown', onKeyDown);
      target.addEventListener('keyup', onKeyUp);
      target.addEventListener('pointerdown', onPointerDown);
      target.addEventListener('pointerup', onPointerUp);
      target.addEventListener('pointermove', onPointerMove);
      target.addEventListener('wheel', onWheel, { passive: !preventWheelDefault });
      // 特性检测：Chromium 无 gesture* 事件，注册了也只会空跑
      const supportsSafariGesture = typeof (globalThis as { GestureEvent?: unknown }).GestureEvent !== 'undefined';
      if (supportsSafariGesture) {
        target.addEventListener('gesturestart', onGestureStart);
        target.addEventListener('gesturechange', onGestureChange);
      }

      return () => {
        target.removeEventListener('keydown', onKeyDown);
        target.removeEventListener('keyup', onKeyUp);
        target.removeEventListener('pointerdown', onPointerDown);
        target.removeEventListener('pointerup', onPointerUp);
        target.removeEventListener('pointermove', onPointerMove);
        target.removeEventListener('wheel', onWheel);
        if (supportsSafariGesture) {
          target.removeEventListener('gesturestart', onGestureStart);
          target.removeEventListener('gesturechange', onGestureChange);
        }
        downAt.clear();
        pendingMove = null;
        pendingWheel = null;
      };
    },
  };
}
