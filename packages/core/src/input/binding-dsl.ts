/**
 * input/binding-dsl —— 绑定语法的解析与格式化（唯一真相源）。
 *
 * 语法形态：
 *
 * ```text
 * [chord +] <gesture> [then <gesture> ...]
 * ```
 *
 * 设计约束：
 *
 * 1. **往返一致**：`parseBinding(formatBinding(x))` 与 `normalizeBinding(x)` 等价（属性测试守护）。
 * 2. **人读可粘贴**：同一份文本用于面板输入、持久化与文档示例。
 * 3. **旧写法是语法糖**：`Ctrl+Shift+P` 仍被接受，但输出一律为新语法。
 * 4. **错误结构化**：非法输入抛 {@link BindingParseError}，带稳定 `code`，面板可据此给本地化提示。
 *
 * 修饰键语义（关键区分）：
 *
 * | 写法 | 含义 |
 * | --- | --- |
 * | `mod` / `ctrl` / `cmd` / `command` | **平台主修饰键**（mac 为 ⌘，其余为 Ctrl） |
 * | `meta` / `win` / `super` | 字面 Meta（mac 的 ⌘、Windows 的 Win 键） |
 * | `control` | 字面 Control（mac 的 ⌃） |
 * | `alt` / `option` | Alt / Option |
 * | `shift` | Shift |
 *
 * `ctrl` 归到主修饰键而非字面 Control，是**兼容既有下游**的选择：
 * 现存 11 处绑定均写 `Ctrl+X`，在 macOS 上它们一直是 ⌘X。
 * 需要字面 ⌃ 时写 `control`。
 */
import type {
  Binding,
  BindingChord,
  BindingDraft,
  GesturePattern,
  InputModifiers,
  KeyRef,
  KeyGesturePattern,
  Platform,
  PointerGesturePattern,
  TrackpadGesturePattern,
} from './types';
import { NO_MODIFIERS } from './types';
import { currentPlatform, primaryModifier } from './platform';

/** 解析错误代码。 */
export type BindingParseErrorCode =
  | 'empty'
  | 'unknown-gesture'
  | 'missing-target'
  | 'invalid-parameter'
  | 'unknown-token'
  | 'duplicate-modifier';

/** 结构化解析错误。 */
export class BindingParseError extends Error {
  readonly code: BindingParseErrorCode;
  /** 出错的原始片段（便于面板高亮）。 */
  readonly fragment: string;

  constructor(code: BindingParseErrorCode, message: string, fragment: string) {
    super(message);
    this.name = 'BindingParseError';
    this.code = code;
    this.fragment = fragment;
  }
}

/** 修饰键别名表：写法 → 槽位。 */
const MODIFIER_ALIASES: Record<string, keyof InputModifiers | 'primary'> = {
  mod: 'primary',
  ctrl: 'primary',
  cmd: 'primary',
  command: 'primary',
  control: 'ctrl',
  meta: 'meta',
  win: 'meta',
  super: 'meta',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
};

/** 修饰键格式化顺序。 */
const MODIFIER_ORDER: Array<keyof InputModifiers> = ['ctrl', 'meta', 'alt', 'shift'];

/** atLeast 标记：chord 中单独出现的 `*`。 */
const AT_LEAST_TOKEN = '*';

/** 常用键别名 → `KeyboardEvent.code`。 */
const KEY_CODE_ALIASES: Record<string, string> = {
  esc: 'Escape',
  escape: 'Escape',
  space: 'Space',
  spacebar: 'Space',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  del: 'Delete',
  delete: 'Delete',
  backspace: 'Backspace',
  bs: 'Backspace',
  insert: 'Insert',
  ins: 'Insert',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pgup: 'PageUp',
  pagedown: 'PageDown',
  pgdn: 'PageDown',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  backquote: 'Backquote',
  minus: 'Minus',
  equal: 'Equal',
  plus: 'Equal',
  bracketleft: 'BracketLeft',
  bracketright: 'BracketRight',
  backslash: 'Backslash',
  semicolon: 'Semicolon',
  quote: 'Quote',
  comma: 'Comma',
  period: 'Period',
  dot: 'Period',
  slash: 'Slash',
};

/** 反向别名：用于把 code 格式化成最易读的 token。 */
const KEY_CODE_DISPLAY: Record<string, string> = {
  Escape: 'Escape',
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Delete: 'Delete',
  Backspace: 'Backspace',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
};

/** 手势种类集合，用于识别「token 是否是手势」。 */
const GESTURE_KINDS = new Set<string>([
  'press',
  'release',
  'tap',
  'hold',
  'repeat',
  'click',
  'drag',
  'wheel',
  'pinch',
  'swipe',
  'rotate',
]);

/**
 * 解析单字符：字母/数字推断物理键位，其余按字符语义。
 *
 * @example
 * normalizeKeyRef('a')  // { code: 'KeyA' }
 * normalizeKeyRef('?')  // { key: '?' }
 */
function parseKeyToken(token: string): KeyRef {
  const lowered = token.toLowerCase();
  const alias = KEY_CODE_ALIASES[lowered];
  if (alias) return { code: alias };
  if (/^[a-z]$/i.test(token)) return { code: `Key${token.toUpperCase()}` };
  if (/^[0-9]$/.test(token)) return { code: `Digit${token}` };
  if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(token)) return { code: token.toUpperCase() };
  if (/^[A-Z][A-Za-z0-9]+$/.test(token) || /^(Numpad|Digit|Key)\w+$/.test(token)) return { code: token };
  if (token.length === 1) return { key: token };
  throw new BindingParseError('unknown-token', `无法识别的按键：${token}`, token);
}

/** 格式化按键引用为 token。 */
function formatKeyRef(target: KeyRef): string {
  if ('key' in target) return target.key;
  return KEY_CODE_DISPLAY[target.code] ?? target.code;
}

/** 解析数值参数。 */
function parseNumber(raw: string | undefined, fallback: number, fragment: string): number {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new BindingParseError('invalid-parameter', `参数不是有效数值：${raw}`, fragment);
  }
  return value;
}

/** 解析必填数值参数。 */
function requireNumber(raw: string | undefined, fragment: string, name: string): number {
  if (raw === undefined || raw === '') {
    throw new BindingParseError('invalid-parameter', `缺少参数 ${name}`, fragment);
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new BindingParseError('invalid-parameter', `参数 ${name} 不是有效数值：${raw}`, fragment);
  }
  return value;
}

/** 解析方向词。 */
function parseDirection<T extends string>(raw: string | undefined, allowed: readonly T[], fragment: string): T {
  if (!raw) throw new BindingParseError('missing-target', '缺少方向参数', fragment);
  const normalized = raw.toLowerCase() as T;
  if (!allowed.includes(normalized)) {
    throw new BindingParseError('invalid-parameter', `方向参数非法：${raw}`, fragment);
  }
  return normalized;
}

/** 解析单个手势 token（如 `press:KeyP`、`drag:0:x:8`）。 */
function parseGestureToken(token: string): GesturePattern {
  const [rawKind, ...params] = token.split(':');
  const kind = (rawKind ?? '').trim().toLowerCase();
  if (!GESTURE_KINDS.has(kind)) {
    throw new BindingParseError('unknown-gesture', `未知手势：${rawKind || '(空)'}`, token);
  }

  switch (kind) {
    case 'press':
    case 'repeat': {
      const target = params[0];
      if (!target) throw new BindingParseError('missing-target', `${kind} 缺少按键目标`, token);
      return { kind, target: parseKeyToken(target) };
    }
    case 'tap': {
      const target = params[0];
      if (!target) throw new BindingParseError('missing-target', 'tap 缺少按键目标', token);
      return { kind: 'tap', target: parseKeyToken(target), maxMs: parseNumber(params[1], 250, token) };
    }
    case 'hold': {
      const target = params[0];
      if (!target) throw new BindingParseError('missing-target', 'hold 缺少按键目标', token);
      return { kind: 'hold', target: parseKeyToken(target), minMs: parseNumber(params[1], 250, token) };
    }
    case 'release': {
      const target = params[0];
      if (!target) throw new BindingParseError('missing-target', 'release 缺少按键目标', token);
      const pattern: KeyGesturePattern = { kind: 'release', target: parseKeyToken(target) };
      const raw = params[1];
      if (raw) {
        const [min, max] = raw.split('-');
        pattern.heldMs = {};
        if (min) pattern.heldMs.min = requireNumber(min, token, 'heldMs.min');
        if (max) pattern.heldMs.max = requireNumber(max, token, 'heldMs.max');
      }
      return pattern;
    }
    case 'click': {
      const button = requireNumber(params[0], token, 'button');
      const count = parseNumber(params[1], 1, token);
      if (count !== 1 && count !== 2) {
        throw new BindingParseError('invalid-parameter', `click 的 count 只能是 1 或 2：${count}`, token);
      }
      const pattern: PointerGesturePattern = { kind: 'click', button, count };
      return pattern;
    }
    case 'drag': {
      const button = requireNumber(params[0], token, 'button');
      const maybeAxis = params[1];
      const hasAxis = maybeAxis === 'x' || maybeAxis === 'y' || maybeAxis === 'X' || maybeAxis === 'Y';
      const axis = hasAxis ? (maybeAxis.toLowerCase() as 'x' | 'y') : undefined;
      const minPx = hasAxis ? parseNumber(params[2], 4, token) : parseNumber(params[1], 4, token);
      const pattern: PointerGesturePattern = { kind: 'drag', button, minPx };
      if (axis) pattern.axis = axis;
      return pattern;
    }
    case 'wheel': {
      const dir = parseDirection(params[0], ['up', 'down', 'left', 'right'] as const, token);
      return { kind: 'wheel', dir, minDelta: parseNumber(params[1], 40, token) };
    }
    case 'pinch': {
      const dir = parseDirection(params[0], ['in', 'out'] as const, token);
      return { kind: 'pinch', dir, minScale: parseNumber(params[1], 0.02, token) };
    }
    case 'swipe': {
      const dir = parseDirection(params[0], ['left', 'right', 'up', 'down'] as const, token);
      const pattern: TrackpadGesturePattern = {
        kind: 'swipe',
        dir,
        minPx: parseNumber(params[1], 40, token),
        maxMs: parseNumber(params[2], 300, token),
      };
      return pattern;
    }
    default: {
      const dir = parseDirection(params[0], ['cw', 'ccw'] as const, token);
      return { kind: 'rotate', dir, minDeg: parseNumber(params[1], 15, token) };
    }
  }
}

/** 格式化单个手势为 token。 */
function formatGestureToken(gesture: GesturePattern): string {
  switch (gesture.kind) {
    case 'press':
    case 'repeat':
      return `${gesture.kind}:${formatKeyRef(gesture.target)}`;
    case 'tap':
      return `tap:${formatKeyRef(gesture.target)}:${gesture.maxMs}`;
    case 'hold':
      return `hold:${formatKeyRef(gesture.target)}:${gesture.minMs}`;
    case 'release': {
      const held = gesture.heldMs;
      if (!held || (held.min === undefined && held.max === undefined)) {
        return `release:${formatKeyRef(gesture.target)}`;
      }
      const min = held.min ?? '';
      const max = held.max ?? '';
      return `release:${formatKeyRef(gesture.target)}:${min}-${max}`;
    }
    case 'click':
      return gesture.count === 2 ? `click:${gesture.button}:2` : `click:${gesture.button}`;
    case 'drag':
      return gesture.axis
        ? `drag:${gesture.button}:${gesture.axis}:${gesture.minPx}`
        : `drag:${gesture.button}:${gesture.minPx}`;
    case 'wheel':
      return `wheel:${gesture.dir}:${gesture.minDelta}`;
    case 'pinch':
      return `pinch:${gesture.dir}:${gesture.minScale}`;
    case 'swipe':
      return `swipe:${gesture.dir}:${gesture.minPx}:${gesture.maxMs}`;
    case 'rotate':
      return `rotate:${gesture.dir}:${gesture.minDeg}`;
  }
}

/** 格式化修饰键为 chord token 列表。 */
function formatChordModifiers(chord: BindingChord, platform: Platform): string[] {
  const tokens: string[] = [];
  const primary = primaryModifier(platform);
  for (const name of MODIFIER_ORDER) {
    if (!chord.mods[name]) continue;
    if (name === primary) {
      // 主修饰键：mac 写 cmd，其余写 ctrl（与解析时的别名表对称）
      tokens.push(platform === 'mac' ? 'cmd' : 'ctrl');
    } else if (name === 'ctrl') {
      // 非 mac 平台上 ctrl 即主修饰键，已被上面处理；此处只剩 mac 的字面 ⌃
      tokens.push('control');
    } else if (name === 'meta') {
      tokens.push('meta');
    } else {
      tokens.push(name);
    }
  }
  if (chord.modsMatch === 'atLeast') tokens.push(AT_LEAST_TOKEN);
  return tokens;
}

/** 解析单个片段的 chord 部分。 */
function parseChordTokens(tokens: string[], fragment: string, platform: Platform): BindingChord {
  const mods: InputModifiers = { ...NO_MODIFIERS };
  let modsMatch: 'exact' | 'atLeast' = 'exact';
  const buttons: number[] = [];
  const keys: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    if (token === AT_LEAST_TOKEN) {
      modsMatch = 'atLeast';
      continue;
    }
    const lowered = token.toLowerCase();
    const slot = MODIFIER_ALIASES[lowered];
    if (slot) {
      const resolved: keyof InputModifiers = slot === 'primary' ? primaryModifier(platform) : slot;
      if (seen.has(resolved)) {
        throw new BindingParseError('duplicate-modifier', `修饰键重复：${token}`, fragment);
      }
      seen.add(resolved);
      mods[resolved] = true;
      continue;
    }
    if (/^(button)?[0-4]$/i.test(token)) {
      buttons.push(Number(token.replace(/^button/i, '')));
      continue;
    }
    const parsedRef = parseKeyToken(token);
    keys.push('code' in parsedRef ? parsedRef.code : `Key${token.toUpperCase()}`);
  }

  return { mods, modsMatch, buttons, keys };
}

/**
 * 解析绑定表达式。
 *
 * @param input 表达式文本。
 * @param platform 目标平台（决定 `ctrl`/`cmd` 落到哪个修饰键槽位）。
 * @returns 绑定草稿（不含 `id` / `commandId` / `origin`）。
 * @throws {BindingParseError} 输入非法时抛出结构化错误。
 * @example
 * parseBinding('alt+drag:0:x:8').gesture // { kind: 'drag', button: 0, axis: 'x', minPx: 8 }
 */
export function parseBinding(input: string, platform: Platform = currentPlatform()): BindingDraft {
  const text = (input ?? '').trim();
  if (!text) throw new BindingParseError('empty', '绑定表达式不能为空', input ?? '');

  const segments = text
    .split(/\s+then\s+/i)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) throw new BindingParseError('empty', '绑定表达式不能为空', text);

  const gestures: GesturePattern[] = [];
  let chord: BindingChord | undefined;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const tokens = segment.split('+').map((token) => token.trim()).filter(Boolean);
    if (tokens.length === 0) throw new BindingParseError('empty', `空片段：${segment}`, segment);

    const gestureIndex = tokens.findIndex((token) => {
      const kind = token.split(':')[0]?.trim().toLowerCase();
      return GESTURE_KINDS.has(kind ?? '');
    });

    if (gestureIndex < 0) {
      // 纯修饰键/按键片段：视为 `press:<token>`（旧写法 `Ctrl+Shift+P` 的语法糖）
      if (index > 0) {
        throw new BindingParseError('unknown-gesture', `序列片段缺少手势：${segment}`, segment);
      }
      const last = tokens[tokens.length - 1];
      // 带冒号说明用户想写手势却写错了名字，报「未知手势」而非「未知按键」
      const looksLikeGesture = tokens.some((token) => token.includes(':'));
      if (looksLikeGesture) {
        const rawKind = last.split(':')[0]?.trim() || '(空)';
        throw new BindingParseError('unknown-gesture', `未知手势：${rawKind}`, last);
      }
      const chordTokens = tokens.slice(0, -1);
      chord = chordTokens.length > 0 ? parseChordTokens(chordTokens, segment, platform) : undefined;
      gestures.push({ kind: 'press', target: parseKeyToken(last) });
      continue;
    }

    if (gestureIndex !== tokens.length - 1) {
      throw new BindingParseError('unknown-token', `手势必须是片段末项：${segment}`, segment);
    }

    const chordTokens = tokens.slice(0, gestureIndex);
    const parsedChord = chordTokens.length > 0 ? parseChordTokens(chordTokens, segment, platform) : undefined;
    if (parsedChord) {
      if (chord && index === 0) throw new BindingParseError('unknown-token', '序列首段只能有一个 chord', segment);
      if (!chord) chord = parsedChord;
    }
    gestures.push(parseGestureToken(tokens[gestureIndex]));
  }

  const last = gestures.pop() as GesturePattern;
  const draft: BindingDraft = {
    chord: chord ?? { mods: { ...NO_MODIFIERS }, modsMatch: 'exact', buttons: [], keys: [] },
    gesture: last,
  };
  if (gestures.length > 0) draft.sequence = gestures;
  return draft;
}

/**
 * 格式化绑定草稿为表达式文本。
 *
 * @param draft 绑定草稿或完整绑定。
 * @param platform 目标平台。
 * @returns 可直接回灌 {@link parseBinding} 的文本。
 * @example
 * formatBinding({ chord: {...}, gesture: { kind: 'press', target: { code: 'KeyP' } } }, 'mac') // 'cmd+press:KeyP'
 */
export function formatBinding(draft: BindingDraft | Binding, platform: Platform = currentPlatform()): string {
  const chordTokens = [
    ...formatChordModifiers(draft.chord, platform),
    ...draft.chord.buttons.map((button) => String(button)),
    ...draft.chord.keys,
  ];
  const prefix = chordTokens.length > 0 ? `${chordTokens.join('+')}+` : '';
  const sequence = draft.sequence ?? [];
  const all = [...sequence, draft.gesture];
  // chord 只作用于首段（序列后续段沿用同一组合语义）
  const parts = all.map((gesture, index) => `${index === 0 ? prefix : ''}${formatGestureToken(gesture)}`);
  return parts.join(' then ');
}

/** 修饰键数量（用于具体度排序）。 */
export function countModifiers(mods: InputModifiers): number {
  return MODIFIER_ORDER.reduce((sum, name) => (mods[name] ? sum + 1 : sum), 0);
}

/**
 * 规范化绑定草稿：补齐默认值、收敛键位引用、排序修饰键。
 *
 * 这是「往返一致」的落脚点：`parseBinding(formatBinding(x))` 的结果
 * 与 `normalizeBinding(x)` 必须相等。
 *
 * @param draft 原始草稿。
 * @param platform 目标平台。
 * @returns 规范化后的草稿（新对象，不修改入参）。
 */
export function normalizeBinding(draft: BindingDraft, platform: Platform = currentPlatform()): BindingDraft {
  void platform;
  const normalizeKey = (target: KeyRef): KeyRef => {
    if ('key' in target) {
      // 单字符字母/数字统一按物理键位表达，保证 format/parse 稳定
      if (/^[a-z]$/i.test(target.key)) return { code: `Key${target.key.toUpperCase()}` };
      if (/^[0-9]$/.test(target.key)) return { code: `Digit${target.key}` };
      return { key: target.key };
    }
    return { code: target.code };
  };

  const normalizeGesture = (gesture: GesturePattern): GesturePattern => {
    switch (gesture.kind) {
      case 'press':
      case 'repeat':
        return { kind: gesture.kind, target: normalizeKey(gesture.target) };
      case 'tap':
        return { kind: 'tap', target: normalizeKey(gesture.target), maxMs: gesture.maxMs };
      case 'hold':
        return { kind: 'hold', target: normalizeKey(gesture.target), minMs: gesture.minMs };
      case 'release': {
        const normalized: KeyGesturePattern = { kind: 'release', target: normalizeKey(gesture.target) };
        if (gesture.heldMs) normalized.heldMs = { ...gesture.heldMs };
        return normalized;
      }
      case 'click':
        return { kind: 'click', button: gesture.button, count: gesture.count };
      case 'drag': {
        const normalized: PointerGesturePattern = { kind: 'drag', button: gesture.button, minPx: gesture.minPx };
        if (gesture.axis) normalized.axis = gesture.axis;
        return normalized;
      }
      case 'wheel':
        return { kind: 'wheel', dir: gesture.dir, minDelta: gesture.minDelta };
      case 'pinch':
        return { kind: 'pinch', dir: gesture.dir, minScale: gesture.minScale };
      case 'swipe':
        return { kind: 'swipe', dir: gesture.dir, minPx: gesture.minPx, maxMs: gesture.maxMs };
      case 'rotate':
        return { kind: 'rotate', dir: gesture.dir, minDeg: gesture.minDeg };
    }
  };

  const normalized: BindingDraft = {
    chord: {
      mods: { ...draft.chord.mods },
      modsMatch: draft.chord.modsMatch ?? 'exact',
      buttons: [...draft.chord.buttons].sort((a, b) => a - b),
      keys: [...draft.chord.keys].sort(),
    },
    gesture: normalizeGesture(draft.gesture),
  };

  if (draft.sequence && draft.sequence.length > 0) {
    normalized.sequence = draft.sequence.map(normalizeGesture);
  }
  if (draft.when !== undefined) normalized.when = draft.when;
  if (draft.scope !== undefined) normalized.scope = draft.scope;
  if (draft.weight !== undefined) normalized.weight = draft.weight;
  if (draft.allowInInput !== undefined) normalized.allowInInput = draft.allowInInput;
  if (draft.category !== undefined) normalized.category = draft.category;
  normalized.swallow = draft.swallow ?? true;
  normalized.mode = draft.mode ?? 'once';

  return normalized;
}

/**
 * 由表达式文本一次得到规范化草稿。
 *
 * @param input 表达式文本。
 * @param platform 目标平台。
 * @returns 规范化草稿。
 * @example
 * draftFromText('Ctrl+Shift+P', 'mac')
 */
export function draftFromText(input: string, platform: Platform = currentPlatform()): BindingDraft {
  return normalizeBinding(parseBinding(input, platform), platform);
}
