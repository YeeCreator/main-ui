/**
 * input/session —— 输入会话状态（识别器的记忆）。
 *
 * 识别是**有状态**的：长按要等计时、双击要跨两次抬起、序列要留窗口。
 * 本模块把这堆易错的状态集中到一处，并保证：
 *
 * - 所有时间都来自注入的 `clock`，因此时序判定可在 Node 下精确重放；
 * - 状态可 `reset()`，便于宿主热重载或布局重建时清理；
 * - 不持有任何 DOM 引用。
 */
import type { InputModifiers, Vec2 } from './types';
import { NO_MODIFIERS } from './types';

/** 拖拽进行态。 */
export type DragState = {
  button: number;
  start: Vec2;
  current: Vec2;
  /** 是否已越过起判阈值。 */
  active: boolean;
  /** 本段拖拽累计的 x/y 位移（在 `pointerup` 时交给 `end` 阶段）。 */
  totalDx: number;
  totalDy: number;
};

/** 单击累积态（用于双击合成）。 */
export type ClickState = {
  button: number;
  at: number;
  count: number;
};

/** 触控板平移会话（用于甩动识别）。 */
export type PanSession = {
  startedAt: number;
  lastAt: number;
  totalX: number;
  totalY: number;
};

/** 捏合会话。 */
export type PinchSession = {
  /** 会话内累计的对数缩放量。 */
  total: number;
  /** 已触发的离散步数（正 = 外扩）。 */
  steps: number;
  lastAt: number;
};

/** 输入会话。 */
export type InputSession = {
  /** 已按住的物理键位。 */
  pressedKeys: Set<string>;
  /** 已按住的鼠标键。 */
  pressedButtons: Set<number>;
  /** 最近一次修饰键快照。 */
  mods: InputModifiers;
  /** 按键按下时刻（`code` → 毫秒）。 */
  keyDownAt: Map<string, number>;
  /** 按住期间已消费过组合键的修饰键（这些键抬起时不再触发 release/tap）。 */
  consumedModifiers: Set<string>;
  /** 拖拽进行态（无则为 null）。 */
  drag: DragState | null;
  /** 上一次单击（用于双击合成）。 */
  lastClick: ClickState | null;
  /** 触控板平移会话。 */
  pan: PanSession | null;
  /** 捏合会话。 */
  pinch: PinchSession | null;
  /** 清空全部会话状态。 */
  reset: () => void;
};

/**
 * 创建空会话。
 *
 * @returns 可复用的会话对象。
 * @example
 * const session = createInputSession()
 * session.pressedKeys.add('KeyA')
 */
export function createInputSession(): InputSession {
  const session: InputSession = {
    pressedKeys: new Set<string>(),
    pressedButtons: new Set<number>(),
    mods: { ...NO_MODIFIERS },
    keyDownAt: new Map<string, number>(),
    consumedModifiers: new Set<string>(),
    drag: null,
    lastClick: null,
    pan: null,
    pinch: null,
    reset() {
      session.pressedKeys.clear();
      session.pressedButtons.clear();
      session.mods = { ...NO_MODIFIERS };
      session.keyDownAt.clear();
      session.consumedModifiers.clear();
      session.drag = null;
      session.lastClick = null;
      session.pan = null;
      session.pinch = null;
    },
  };
  return session;
}
