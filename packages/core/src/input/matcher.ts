/**
 * input/matcher —— 手势 + 上下文 → 唯一命中的绑定。
 *
 * 具体度必须是**全序**：任何两条绑定在同一输入下都能确定地分出先后，
 * 否则「用户改了快捷键却不生效」会变成不可解释的行为。
 *
 * 排序键依次比较（见 {@link compareSpecificity}）：
 *
 * 1. `weight` 降序；
 * 2. 修饰键匹配数降序；
 * 3. `modsMatch: 'exact'` 优先于 `'atLeast'`；
 * 4. 手势时序具体度降序（`tap`/`hold`/`release`/`click:2` > `press`/`drag`/`wheel`/… > `click:1`）；
 * 5. 作用域深度降序；
 * 6. `origin` 优先级降序（`user` > `host` > `default`）；
 * 7. 注册顺序降序（后注册者胜，便于覆盖）。
 */
import type {
  Binding,
  BindingChord,
  GestureKind,
  GesturePattern,
  InputDiagnostic,
  InputModifiers,
  InputScope,
} from './types';
import { BINDING_ORIGIN_RANK, INPUT_SCOPE_DEPTH, isModifierCode } from './types';
import { countModifiers } from './binding-dsl';
import { keyRefCode } from './recognizer';

/** 匹配时的运行上下文。 */
export type MatchContext = {
  /** 当前作用域栈（深者在前或后均可，内部按深度判断）。 */
  scopes: ReadonlySet<InputScope>;
  /** 当前按住的物理键位。 */
  pressedKeys: ReadonlySet<string>;
  /** 当前按住的鼠标键。 */
  pressedButtons: ReadonlySet<number>;
  /** 当前修饰键快照。 */
  mods: InputModifiers;
  /** 焦点是否在可编辑元素内。 */
  inInput: boolean;
};

/** 手势时序具体度。 */
export function gestureSpecificity(gesture: GesturePattern): number {
  switch (gesture.kind) {
    case 'tap':
    case 'hold':
    case 'release':
      return 3;
    case 'click':
      return gesture.count === 2 ? 3 : 1;
    case 'press':
    case 'drag':
    case 'wheel':
    case 'pinch':
    case 'swipe':
    case 'rotate':
    case 'repeat':
      return 2;
  }
}

/**
 * 手势「形状」：去掉阈值参数后的语义标识。
 *
 * 这是匹配的核心：绑定写的是阈值（`hold ... minMs: 250`），
 * 识别器产出的是实测值（`heldMs: 312`）。两者只有在形状层面才可比。
 *
 * @param gesture 手势。
 * @returns 形状键，例：`'hold:Space'`、`'drag:0:x'`、`'pinch:out'`。
 * @example
 * gestureShape({ kind: 'hold', target: { code: 'Space' }, minMs: 250 }) // 'hold:Space'
 */
export function gestureShape(gesture: GesturePattern): string {
  switch (gesture.kind) {
    case 'press':
    case 'release':
    case 'tap':
    case 'hold':
    case 'repeat':
      return `${gesture.kind}:${keyRefCode(gesture.target)}`;
    case 'click':
      return `click:${gesture.button}:${gesture.count}`;
    case 'drag':
      return `drag:${gesture.button}:${gesture.axis ?? 'any'}`;
    case 'wheel':
      return `wheel:${gesture.dir}`;
    case 'pinch':
      return `pinch:${gesture.dir}`;
    case 'swipe':
      return `swipe:${gesture.dir}`;
    case 'rotate':
      return `rotate:${gesture.dir}`;
  }
}

/**
 * 判断两条手势是否「形状相同」（阈值与实测值不参与）。
 *
 * @param a 手势。
 * @param b 手势。
 * @returns 形状是否相同。
 */
export function sameGesture(a: GesturePattern, b: GesturePattern): boolean {
  return gestureShape(a) === gestureShape(b);
}

/** 判断某手势是否属于「同一输入族」，用于前缀/冲突判定。 */
export function sameGestureFamily(a: GesturePattern, b: GesturePattern): boolean {
  const family = (gesture: GesturePattern): string => {
    switch (gesture.kind) {
      case 'press':
      case 'release':
      case 'tap':
      case 'hold':
      case 'repeat':
        return `key:${keyRefCode(gesture.target)}`;
      case 'click':
        return `pointer:${gesture.button}`;
      case 'drag':
        return `pointer:${gesture.button}`;
      case 'wheel':
        return 'wheel';
      case 'pinch':
        return 'pinch';
      case 'swipe':
        return 'swipe';
      case 'rotate':
        return 'rotate';
    }
  };
  return family(a) === family(b);
}

/** chord 是否被当前输入满足。 */
export function chordSatisfied(chord: BindingChord, context: MatchContext): boolean {
  // 修饰键
  for (const name of ['ctrl', 'meta', 'alt', 'shift'] as Array<keyof InputModifiers>) {
    const required = chord.mods[name];
    const actual = context.mods[name];
    if (chord.modsMatch === 'exact') {
      if (required !== actual) return false;
    } else if (required && !actual) {
      return false;
    }
  }
  // 鼠标键：chord 声明的每一键都必须按住
  for (const button of chord.buttons) {
    if (!context.pressedButtons.has(button)) return false;
  }
  // 非修饰键：同上
  for (const code of chord.keys) {
    if (!context.pressedKeys.has(code)) return false;
  }
  return true;
}

/** 具体度比较：负数表示 a 优先。 */
export function compareSpecificity(a: Binding, b: Binding, registrationOrder: ReadonlyMap<string, number>): number {
  const weightDiff = (b.weight ?? 0) - (a.weight ?? 0);
  if (weightDiff !== 0) return weightDiff;

  const modsDiff = countModifiers(b.chord.mods) - countModifiers(a.chord.mods);
  if (modsDiff !== 0) return modsDiff;

  const exactA = a.chord.modsMatch === 'exact' ? 1 : 0;
  const exactB = b.chord.modsMatch === 'exact' ? 1 : 0;
  if (exactA !== exactB) return exactB - exactA;

  const gestureDiff = gestureSpecificity(b.gesture) - gestureSpecificity(a.gesture);
  if (gestureDiff !== 0) return gestureDiff;

  const scopeA = a.scope ? INPUT_SCOPE_DEPTH[a.scope] : -1;
  const scopeB = b.scope ? INPUT_SCOPE_DEPTH[b.scope] : -1;
  if (scopeA !== scopeB) return scopeB - scopeA;

  const originDiff = BINDING_ORIGIN_RANK[b.origin] - BINDING_ORIGIN_RANK[a.origin];
  if (originDiff !== 0) return originDiff;

  return (registrationOrder.get(b.id) ?? 0) - (registrationOrder.get(a.id) ?? 0);
}

/** 前缀匹配：`prefix` 是否为 `binding` 序列的前段。 */
export function isSequencePrefix(prefix: GesturePattern[], binding: Binding): boolean {
  const full = [...(binding.sequence ?? []), binding.gesture];
  if (full.length <= prefix.length) return false;
  return prefix.every((gesture, index) => sameGesture(gesture, full[index]));
}

/**
 * 过滤候选绑定。
 *
 * @param bindings 全部绑定。
 * @param gesture 当前识别出的手势。
 * @param context 运行上下文。
 * @param enabled `when` 求值结果（由调用方注入，便于复用 `evaluateWhen`）。
 * @returns 候选集（未排序）。
 */
export function filterCandidates(
  bindings: readonly Binding[],
  gesture: GesturePattern,
  context: MatchContext,
  enabled: (binding: Binding) => boolean,
): Binding[] {
  const candidates: Binding[] = [];
  for (const binding of bindings) {
    if (!sameGesture(binding.gesture, gesture)) continue;
    if (binding.scope && !context.scopes.has(binding.scope)) continue;
    if (!binding.allowInInput && context.inInput) continue;
    if (!chordSatisfied(binding.chord, context)) continue;
    if (!enabled(binding)) continue;
    candidates.push(binding);
  }
  return candidates;
}

/**
 * 选出唯一命中。
 *
 * @param candidates 候选集。
 * @param order 注册顺序。
 * @returns 命中的绑定；空集返回 `null`。
 */
export function pickBest(candidates: Binding[], order: ReadonlyMap<string, number>): Binding | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => compareSpecificity(a, b, order));
  return sorted[0];
}

/**
 * 诊断：找出冲突与不可达。
 *
 * 冲突 = 同输入族 + 同 chord + 同 `when` + 同作用域，且具体度完全并列。
 * 不可达 = 某绑定在同样条件下总被另一条更具体的绑定遮蔽。
 *
 * @param bindings 全部绑定。
 * @returns 阻断级与提示级诊断。
 */
export function diagnoseBindings(bindings: readonly Binding[]): InputDiagnostic[] {
  const diagnostics: InputDiagnostic[] = [];

  // 1. 纯修饰键使用 press/hold/repeat
  for (const binding of bindings) {
    const kinds: readonly GestureKind[] = ['press', 'hold', 'repeat'];
    const gesture = binding.gesture;
    if (!kinds.includes(gesture.kind)) continue;
    if (!('target' in gesture)) continue;
    if (!isModifierCode(keyRefCode(gesture.target))) continue;
    diagnostics.push({
      level: 'error',
      code: 'modifier-press',
      bindingIds: [binding.id],
      message: `纯修饰键不能使用 ${gesture.kind}：会让组合键无法按下（改用 release 或 tap）`,
    });
  }

  // 2. 同族冲突
  for (let i = 0; i < bindings.length; i += 1) {
    for (let j = i + 1; j < bindings.length; j += 1) {
      const a = bindings[i];
      const b = bindings[j];
      if (!sameGesture(a.gesture, b.gesture)) continue;
      if (!sameChord(a.chord, b.chord)) continue;
      if ((a.when ?? '') !== (b.when ?? '')) continue;
      if (a.scope !== b.scope) continue;
      if ((a.weight ?? 0) !== (b.weight ?? 0)) continue;
      diagnostics.push({
        level: 'error',
        code: 'conflict',
        bindingIds: [a.id, b.id],
        message: `「${a.commandId}」与「${b.commandId}」绑定完全相同，无法判定优先级`,
      });
    }
  }

  return diagnostics;
}

/** 判断两个 chord 是否等价。 */
export function sameChord(a: BindingChord, b: BindingChord): boolean {
  if (a.modsMatch !== b.modsMatch) return false;
  for (const name of ['ctrl', 'meta', 'alt', 'shift'] as Array<keyof InputModifiers>) {
    if (a.mods[name] !== b.mods[name]) return false;
  }
  if (a.buttons.length !== b.buttons.length) return false;
  const sortedA = [...a.buttons].sort((x, y) => x - y);
  const sortedB = [...b.buttons].sort((x, y) => x - y);
  if (sortedA.some((value, index) => value !== sortedB[index])) return false;
  if (a.keys.length !== b.keys.length) return false;
  const keysA = [...a.keys].sort();
  const keysB = [...b.keys].sort();
  return keysA.every((value, index) => value === keysB[index]);
}
