/**
 * input/types —— 输入与手势系统的公共类型（单一真相源）。
 *
 * 三层严格分离：
 *
 * 1. **信号（InputSignal）**：输入源归一化后的原始事实（按键、指针、滚轮、手势）。
 * 2. **手势（GesturePattern）**：从连续信号中识别出的时序模式（长按、序列、捏合、甩动）。
 * 3. **绑定（Binding）**：一条「输入 → 命令」的完整声明（组合 + 手势 + 序列 + 上下文）。
 *
 * 本文件不依赖 DOM、Vue 或任何运行时，因此可在 Node 环境下直接单测。
 */

/** 平台归一：驱动「主修饰键」映射与键位显示符号。 */
export type Platform = 'mac' | 'windows' | 'linux';

/** 修饰键状态快照。 */
export type InputModifiers = {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
};

/** 全空的修饰键状态。 */
export const NO_MODIFIERS: InputModifiers = Object.freeze({
  ctrl: false,
  alt: false,
  shift: false,
  meta: false,
});

/**
 * 按键引用：物理键位优先。
 *
 * `code` 形式跨键盘布局稳定（中文输入法、AZERTY、Dvorak 下 `key` 会漂移）。
 * `key` 形式只在绑定字符语义时使用（如 `?`、`+`）。
 */
export type KeyRef = { code: string } | { key: string };

/** 二维坐标。 */
export type Vec2 = { x: number; y: number };

/** 输入信号：输入源归一化后的原始事实。 */
export type InputSignal =
  | KeyboardSignal
  | PointerButtonSignal
  | PointerMoveSignal
  | WheelSignal
  | PinchSignal
  | NativeGestureSignal;

export type KeyboardSignal = {
  phase: 'down' | 'up';
  source: 'keyboard';
  /** `KeyboardEvent.code`（物理键位）。 */
  code: string;
  /** `KeyboardEvent.key`（字符语义）。 */
  key: string;
  mods: InputModifiers;
  /** 长按连发（`KeyboardEvent.repeat`）。 */
  repeat: boolean;
  /** `up` 时为按住时长（毫秒）；`down` 时为 `undefined`。 */
  heldMs?: number;
  /** 单调递增时间戳（毫秒），由注入的 clock 产生。 */
  t: number;
};

export type PointerButtonSignal = {
  phase: 'down' | 'up';
  source: 'pointer';
  /** 0 = 左键，1 = 中键，2 = 右键，3/4 = 侧键。 */
  button: number;
  mods: InputModifiers;
  pos: Vec2;
  t: number;
};

export type PointerMoveSignal = {
  phase: 'move';
  source: 'pointer';
  /** 相对上一次 move 的位移。 */
  dx: number;
  dy: number;
  /** 当前按住的鼠标键位掩码（沿用 `PointerEvent.buttons`）。 */
  buttons: number;
  pos: Vec2;
  t: number;
};

export type WheelSignal = {
  phase: 'wheel';
  source: 'wheel';
  /** `notch` = 鼠标滚轮；`pan` = 触控板双指平移。 */
  kind: 'notch' | 'pan';
  dx: number;
  dy: number;
  mods: InputModifiers;
  pos: Vec2;
  t: number;
};

export type PinchSignal = {
  phase: 'pinch';
  source: 'wheel';
  /** 该事件贡献的对数缩放量（正 = 放大）。 */
  scale: number;
  mods: InputModifiers;
  pos: Vec2;
  t: number;
};

export type NativeGestureSignal = {
  phase: 'gesture';
  source: 'native' | 'safari';
  kind: 'pinch' | 'rotate' | 'swipe' | 'fingers';
  scale?: number;
  /** 旋转角度（度）。 */
  rotation?: number;
  dx?: number;
  dy?: number;
  fingers?: number;
  t: number;
};

/** 键盘手势目标。 */
export type KeyGesturePattern =
  | { kind: 'press'; target: KeyRef }
  | { kind: 'release'; target: KeyRef; heldMs?: { min?: number; max?: number } }
  | { kind: 'tap'; target: KeyRef; maxMs: number }
  | { kind: 'hold'; target: KeyRef; minMs: number }
  | { kind: 'repeat'; target: KeyRef };

/** 鼠标手势。 */
export type PointerGesturePattern =
  | { kind: 'click'; button: number; count: 1 | 2 }
  | { kind: 'drag'; button: number; axis?: 'x' | 'y'; minPx: number }
  | { kind: 'wheel'; dir: 'up' | 'down' | 'left' | 'right'; minDelta: number };

/** 触控板手势。 */
export type TrackpadGesturePattern =
  | { kind: 'pinch'; dir: 'in' | 'out'; minScale: number }
  | { kind: 'swipe'; dir: 'left' | 'right' | 'up' | 'down'; minPx: number; maxMs: number; fingers?: number }
  | { kind: 'rotate'; dir: 'cw' | 'ccw'; minDeg: number };

/** 手势：识别层输出、绑定层消费。 */
export type GesturePattern = KeyGesturePattern | PointerGesturePattern | TrackpadGesturePattern;

/**
 * 手势测量值：识别时实际观测到的量。
 *
 * 必须与 {@link GesturePattern} 的**阈值**分离：绑定写的是「至少 250ms」，
 * 识别器产出的是「观测 312ms」。把两者塞进同一字段会让匹配退化成
 * 「阈值必须等于实测值」，永远不成立。
 */
export type GestureMeasurement = {
  /** 键盘：按住时长（毫秒）。 */
  heldMs?: number;
  /** 指针：位移距离（CSS 像素）。 */
  distance?: number;
  /** 指针/滚轮：带符号位移。 */
  deltaX?: number;
  deltaY?: number;
  /** 滚轮/捏合：量值（滚轮为格数×阈值，捏合为对数缩放量）。 */
  magnitude?: number;
  /** 捏合/旋转：累计角度或缩放。 */
  scale?: number;
  rotation?: number;
  /** 甩动：持续时长（毫秒）。 */
  durationMs?: number;
};

/** 手势种类名（用于建索引与诊断）。 */
export type GestureKind = GesturePattern['kind'];

/** 修饰键匹配策略：`exact` 要求完全一致，`atLeast` 允许多余修饰键。 */
export type ModsMatch = 'exact' | 'atLeast';

/**
 * 组合（chord）：触发该手势时必须同时按住的输入。
 *
 * `keys` 用于 Blender 式「按住某键作模式」（如按住 `Space` 再左键拖拽平移）。
 */
export type BindingChord = {
  mods: InputModifiers;
  modsMatch: ModsMatch;
  /** 需按住的鼠标键（`PointerEvent.button` 语义）。 */
  buttons: number[];
  /** 需按住的非修饰键（`KeyboardEvent.code`）。 */
  keys: string[];
};

/** 无组合的 chord。 */
export const EMPTY_CHORD: BindingChord = Object.freeze({
  mods: NO_MODIFIERS,
  modsMatch: 'exact',
  buttons: Object.freeze([]) as unknown as number[],
  keys: Object.freeze([]) as unknown as string[],
});

/** 输入作用域：栈深者优先。 */
export type InputScope = 'global' | 'workspace' | 'editor' | 'canvas' | 'modal';

/** 作用域优先级（数值越大越深，用于具体度排序）。 */
export const INPUT_SCOPE_DEPTH: Readonly<Record<InputScope, number>> = Object.freeze({
  global: 0,
  workspace: 1,
  editor: 2,
  canvas: 3,
  modal: 4,
});

/** 绑定来源，用于面板徽标与覆盖层级。 */
export type BindingOrigin = 'default' | 'host' | 'user';

/** 覆盖层级优先级（数值越大越优先）。 */
export const BINDING_ORIGIN_RANK: Readonly<Record<BindingOrigin, number>> = Object.freeze({
  default: 0,
  host: 1,
  user: 2,
});

/** 触发方式：`once` 只触发一次；`stream` 连续回调 begin/update/end。 */
export type BindingMode = 'once' | 'stream';

/** 绑定：一条「输入 → 命令」的完整声明。 */
export type Binding = {
  /** 稳定标识，默认 `default:<commandId>:<index>`；用户覆盖以此为锚点。 */
  id: string;
  commandId: string;
  chord: BindingChord;
  gesture: GesturePattern;
  /** 序列前置手势（按顺序），末项即 `gesture`。 */
  sequence?: GesturePattern[];
  /** 上下文表达式（`evaluateWhen` 语义）。 */
  when?: string;
  scope?: InputScope;
  /** 同具体度时的显式优先。 */
  weight?: number;
  /** 触发后是否吞掉事件（默认 `true`）。 */
  swallow?: boolean;
  /** 焦点在可编辑元素内是否仍触发（默认 `false`）。 */
  allowInInput?: boolean;
  mode?: BindingMode;
  origin: BindingOrigin;
  /** 面板分类，缺省取命令 `category`。 */
  category?: string;
};

/**
 * 绑定草稿：DSL 解析产物。
 *
 * 不含 `id` / `commandId` / `origin` —— 这三项由注册方补齐，
 * 使「同一个输入表达式」可被任意命令复用。
 */
export type BindingDraft = Omit<Binding, 'id' | 'commandId' | 'origin'>;

/** 连续手势的阶段。 */
export type TriggerPhase = 'begin' | 'update' | 'end';

/** 触发增量（仅 `stream` 才有实质内容）。 */
export type TriggerDelta = {
  dx: number;
  dy: number;
  scale?: number;
  rotation?: number;
};

/** 注入命令上下文的触发信息。 */
export type InputTrigger = {
  bindingId: string;
  source: 'keyboard' | 'pointer' | 'wheel' | 'native' | 'safari';
  gesture: GesturePattern;
  phase: TriggerPhase;
  delta?: TriggerDelta;
};

/** 诊断级别。 */
export type InputDiagnosticLevel = 'error' | 'warning' | 'info';

/** 诊断代码。 */
export type InputDiagnosticCode =
  | 'conflict'
  | 'unreachable'
  | 'platform-unavailable'
  | 'modifier-press'
  | 'stream-unsafe'
  | 'input-shadowed';

/** 诊断项。`conflict` 与 `modifier-press` 为阻断级（面板不允许保存）。 */
export type InputDiagnostic = {
  level: InputDiagnosticLevel;
  code: InputDiagnosticCode;
  bindingIds: string[];
  message: string;
};

/** 阻断级诊断代码。 */
export const BLOCKING_DIAGNOSTIC_CODES: ReadonlySet<InputDiagnosticCode> = new Set<InputDiagnosticCode>([
  'conflict',
  'modifier-press',
]);

/** 判断诊断是否阻断保存。 */
export function isBlockingDiagnostic(diagnostic: InputDiagnostic): boolean {
  return BLOCKING_DIAGNOSTIC_CODES.has(diagnostic.code);
}

/** 修饰键的键位集合（左右两侧都算）。 */
export const MODIFIER_CODES: ReadonlySet<string> = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
]);

/** 判断某物理键位是否为修饰键。 */
export function isModifierCode(code: string): boolean {
  return MODIFIER_CODES.has(code);
}

/** 会话与识别阈值（全部可配置，给出设计默认值）。 */
export type InputTimings = {
  /** 长按达标（毫秒）。 */
  holdMs: number;
  /** 轻点上限（毫秒）。 */
  tapMs: number;
  /** 双击间隔（毫秒）。 */
  doubleClickMs: number;
  /** 序列前缀裁决窗口（毫秒）。 */
  sequenceTimeoutMs: number;
  /** 滚轮/平移会话切分（毫秒）。 */
  wheelSessionIdleMs: number;
  /** notch 累积到该值算一格。 */
  wheelStepDelta: number;
  /** 甩动最小距离（CSS 像素）。 */
  swipeMinPx: number;
  /** 甩动最长时长（毫秒）。 */
  swipeMaxMs: number;
  /** 捏合离散步长（对数缩放量）。 */
  pinchMinScale: number;
  /** 拖拽起判（CSS 像素），与 `pointer-gesture` 同源。 */
  dragMinPx: number;
};

/** 设计默认阈值。 */
export const DEFAULT_INPUT_TIMINGS: InputTimings = Object.freeze({
  holdMs: 250,
  tapMs: 250,
  doubleClickMs: 300,
  sequenceTimeoutMs: 250,
  wheelSessionIdleMs: 120,
  wheelStepDelta: 40,
  swipeMinPx: 40,
  swipeMaxMs: 300,
  pinchMinScale: 0.02,
  dragMinPx: 4,
});

/** 可注入的时钟与定时器（使时序判定完全可测）。 */
export type InputClock = {
  /** 当前时间（毫秒，单调递增）。 */
  now: () => number;
  /** 安排一次回调，返回取消函数。 */
  setTimeout: (handler: () => void, ms: number) => () => void;
};

/** 默认时钟（浏览器环境）。 */
export function createDefaultInputClock(): InputClock {
  return {
    now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    setTimeout: (handler, ms) => {
      if (typeof setTimeout !== 'function') return () => undefined;
      const id = setTimeout(handler, ms);
      return () => clearTimeout(id);
    },
  };
}

/** 手势键位或按钮的人类可读描述（供诊断消息使用）。 */
export function describeGesture(gesture: GesturePattern): string {
  switch (gesture.kind) {
    case 'press':
    case 'tap':
    case 'hold':
    case 'release':
    case 'repeat': {
      const target = 'code' in gesture.target ? gesture.target.code : gesture.target.key;
      const action: Record<typeof gesture.kind, string> = {
        press: '按下',
        tap: '轻点',
        hold: '按住',
        release: '抬起',
        repeat: '连发',
      };
      return `${action[gesture.kind]} ${target}`;
    }
    case 'click':
      return gesture.count === 2 ? `双击 按钮${gesture.button}` : `单击 按钮${gesture.button}`;
    case 'drag':
      return `拖拽 按钮${gesture.button}${gesture.axis ? `（${gesture.axis.toUpperCase()} 轴）` : ''}`;
    case 'wheel':
      return `滚轮 ${gesture.dir}`;
    case 'pinch':
      return gesture.dir === 'out' ? '双指捏合（外扩）' : '双指捏合（内收）';
    case 'swipe':
      return `双指甩动 ${gesture.dir}`;
    case 'rotate':
      return `双指旋转 ${gesture.dir}`;
  }
}
