/**
 * 识别器与匹配器的行为契约测试（设计验收 ④–⑫）。
 *
 * 全部用例零 DOM：识别器只吃 `InputSignal[]`，时钟与定时器全由测试注入，
 * 因此「长按 249ms 不触发、251ms 触发」这类时序能被精确断言。
 */
import { describe, expect, test, vi } from 'vitest';
import { createInputSession } from '../src/input/session';
import { createRecognizer, maskHas, swipeDirection } from '../src/input/recognizer';
import { classifyWheel, createWheelAccumulator } from '../src/input/wheel-session';
import { NO_MODIFIERS, type GesturePattern, type InputSignal, type InputModifiers } from '../src/input/types';
import {
  chordSatisfied,
  compareSpecificity,
  diagnoseBindings,
  filterCandidates,
  gestureShape,
  pickBest,
  sameGesture,
} from '../src/input/matcher';
import type { Binding } from '../src/input/types';
import { draftFromText } from '../src/input/binding-dsl';

/** 构造键盘信号。 */
const keyDown = (code: string, t: number, mods: InputModifiers = NO_MODIFIERS, repeat = false): InputSignal => ({
  phase: 'down',
  source: 'keyboard',
  code,
  key: code,
  mods,
  repeat,
  t,
});

const keyUp = (code: string, t: number, heldMs?: number, mods: InputModifiers = NO_MODIFIERS): InputSignal => ({
  phase: 'up',
  source: 'keyboard',
  code,
  key: code,
  mods,
  repeat: false,
  heldMs,
  t,
});

const pointerDown = (button: number, x: number, y: number, t: number): InputSignal => ({
  phase: 'down',
  source: 'pointer',
  button,
  mods: NO_MODIFIERS,
  pos: { x, y },
  t,
});

const pointerUp = (button: number, x: number, y: number, t: number): InputSignal => ({
  phase: 'up',
  source: 'pointer',
  button,
  mods: NO_MODIFIERS,
  pos: { x, y },
  t,
});

const pointerMove = (dx: number, dy: number, x: number, y: number, buttons: number, t: number): InputSignal => ({
  phase: 'move',
  source: 'pointer',
  dx,
  dy,
  buttons,
  pos: { x, y },
  t,
});

const wheel = (kind: 'notch' | 'pan', dx: number, dy: number, t: number): InputSignal => ({
  phase: 'wheel',
  source: 'wheel',
  kind,
  dx,
  dy,
  mods: NO_MODIFIERS,
  pos: { x: 0, y: 0 },
  t,
});

const pinch = (scale: number, t: number): InputSignal => ({
  phase: 'pinch',
  source: 'wheel',
  scale,
  mods: NO_MODIFIERS,
  pos: { x: 0, y: 0 },
  t,
});

/** 收集全部识别结果。 */
const recognizeAll = (signals: InputSignal[]): GesturePattern[] => {
  const recognizer = createRecognizer({ session: createInputSession() });
  const gestures: GesturePattern[] = [];
  for (const signal of signals) {
    for (const recognized of recognizer.feed(signal)) gestures.push(recognized.gesture);
  }
  return gestures;
};

describe('滚轮判型（设计验收 ④）', () => {
  test('鼠标滚轮整数 ±100 → notch', () => {
    expect(classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -100, deltaMode: 0 })).toBe('zoom');
    expect(classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: 100, deltaMode: 0 })).toBe('zoom');
  });

  test('触控板双指平移（浮点 + 横向）→ pan', () => {
    expect(classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 12, deltaY: -3, deltaMode: 0 })).toBe('pan');
    expect(classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -2.5, deltaMode: 0 })).toBe('pan');
  });

  test('ctrlKey 捏合 → pinch', () => {
    expect(classifyWheel({ ctrlKey: true, metaKey: false, deltaX: 0, deltaY: 4, deltaMode: 0 })).toBe('pinch');
  });

  test('行/页模式 → 缩放', () => {
    expect(classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: 3, deltaMode: 1 })).toBe('zoom');
  });

  test('小幅纵向滚动按触控板处理', () => {
    expect(classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -30, deltaMode: 0 })).toBe('pan');
  });

  /**
   * **事件流密度判据**（2026-10-27 新增）。
   *
   * 只按 `|deltaY| < 40` 判时，「双指快速轻扫」会因 delta 越过 40 而被当成
   * 鼠标滚轮 → 表现为「一快扫就变成缩放」（这一项自 2026-10-24 起一直挂着
   * 「阈值 40 待真机判读」）。但触控板与鼠标滚轮的**事件流形态**天然不同：
   * 前者是 60/120Hz 连续流（间隔 < 16ms），后者是离散一格一个（间隔 ≥ 100ms）。
   * 故提供 `intervalMs` 时按密度判，不再依赖单次 delta 大小。
   *
   * 这一组用例同时锁住「不破坏既有行为」：不给 `intervalMs` 时判定与旧逻辑逐字一致。
   */
  test('触控板快扫：大整数 delta + 密集流 → 仍判 pan（旧逻辑会误判 zoom）', () => {
    // 55 >= 40 且是整数 → 旧逻辑判 zoom；但间隔 8ms 是 120Hz 触控板流
    expect(classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -55, deltaMode: 0, intervalMs: 8 })).toBe('pan');
    expect(classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: 80, deltaMode: 0, intervalMs: 16 })).toBe('pan');
  });

  test('鼠标滚轮：大整数 delta + 稀疏流 → zoom', () => {
    expect(classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -100, deltaMode: 0, intervalMs: 120 })).toBe('zoom');
    expect(classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: 100, deltaMode: 0, intervalMs: 250 })).toBe('zoom');
  });

  test('密度阈值边界：24ms 判触控板，25ms 交给 delta 判据', () => {
    // 24ms = 阈值内 → pan
    expect(classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -100, deltaMode: 0, intervalMs: 24 })).toBe('pan');
    // 25ms = 阈值外，delta 100 >= 40 → zoom
    expect(classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -100, deltaMode: 0, intervalMs: 25 })).toBe('zoom');
  });

  test('不给 intervalMs 时判定与旧逻辑逐字一致（向后兼容）', () => {
    expect(classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -100, deltaMode: 0 })).toBe('zoom');
    expect(classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -30, deltaMode: 0 })).toBe('pan');
  });

  test('非有限/负 intervalMs 不触发密度判据（脏数据不改变判定）', () => {
    expect(classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -100, deltaMode: 0, intervalMs: Number.NaN })).toBe('zoom');
    expect(classifyWheel({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: -100, deltaMode: 0, intervalMs: -5 })).toBe('zoom');
  });
});

describe('滚轮累积', () => {
  test('不足一格不触发，达阈值触发一格', () => {
    const acc = createWheelAccumulator({ stepDelta: 40, idleMs: 120 });
    expect(acc.feed(0, -20, 0)).toEqual([]);
    expect(acc.feed(0, -25, 16)).toEqual([{ dir: 'up', delta: -40 }]);
    expect(acc.peek()).toEqual({ dx: 0, dy: -5 });
  });

  test('空闲超时清空累积', () => {
    const acc = createWheelAccumulator({ stepDelta: 40, idleMs: 120 });
    acc.feed(0, -30, 0);
    expect(acc.feed(0, -20, 500)).toEqual([]);
  });

  test('横向累积产生 left/right（delta 为本格消耗量，余量留待下次）', () => {
    const acc = createWheelAccumulator({ stepDelta: 40, idleMs: 120 });
    expect(acc.feed(50, 0, 0)).toEqual([{ dir: 'right', delta: 40 }]);
    expect(acc.peek()).toEqual({ dx: 10, dy: 0 });
    expect(acc.feed(-50, 0, 16)).toEqual([{ dir: 'left', delta: -40 }]);
  });
});

describe('识别：键盘（设计验收 ⑥）', () => {
  test('按下产出 press', () => {
    expect(recognizeAll([keyDown('KeyF', 0)])).toEqual([{ kind: 'press', target: { code: 'KeyF' } }]);
  });

  test('连发产出 repeat', () => {
    const gestures = recognizeAll([keyDown('KeyF', 0), keyDown('KeyF', 40, NO_MODIFIERS, true)]);
    expect(gestures[0].kind).toBe('press');
    expect(gestures[1].kind).toBe('repeat');
  });

  test('抬起产出 release 并带按住时长', () => {
    const gestures = recognizeAll([keyDown('KeyF', 0), keyUp('KeyF', 120, 120)]);
    expect(gestures[1]).toEqual({ kind: 'release', target: { code: 'KeyF' }, heldMs: { min: 0 } });
  });

  test('纯修饰键不产 press（否则组合键无法按下）', () => {
    expect(recognizeAll([keyDown('ShiftLeft', 0)])).toEqual([]);
    expect(recognizeAll([keyDown('MetaLeft', 0)])).toEqual([]);
  });

  test('输入法组字期间的 keydown 由输入源过滤（识别器不做判断）', () => {
    // 识别器只处理已到达的信号；组字过滤在 createDomInputSource 内
    expect(recognizeAll([keyDown('KeyA', 0)])).toHaveLength(1);
  });
});

describe('识别：鼠标（设计验收 ⑦）', () => {
  test('单击产出 click:1', () => {
    expect(recognizeAll([pointerDown(0, 0, 0, 0), pointerUp(0, 0, 0, 50)])).toEqual([
      { kind: 'click', button: 0, count: 1 },
    ]);
  });

  test('300ms 内两次合成 click:2', () => {
    const gestures = recognizeAll([
      pointerDown(0, 0, 0, 0),
      pointerUp(0, 0, 0, 50),
      pointerDown(0, 0, 0, 100),
      pointerUp(0, 0, 0, 150),
    ]);
    expect(gestures).toHaveLength(2);
    expect(gestures[1]).toEqual({ kind: 'click', button: 0, count: 2 });
  });

  test('超过 300ms 是两次 click:1', () => {
    const gestures = recognizeAll([
      pointerDown(0, 0, 0, 0),
      pointerUp(0, 0, 0, 50),
      pointerDown(0, 0, 0, 500),
      pointerUp(0, 0, 0, 550),
    ]);
    expect(gestures.every((gesture) => gesture.kind === 'click' && gesture.count === 1)).toBe(true);
  });

  test('越过阈值产出 drag begin/update/end', () => {
    const recognizer = createRecognizer({ session: createInputSession() });
    const phases: string[] = [];
    const feed = (signal: InputSignal) => {
      for (const recognized of recognizer.feed(signal)) {
        if (recognized.gesture.kind === 'drag') phases.push(recognized.phase);
      }
    };
    feed(pointerDown(0, 0, 0, 0));
    feed(pointerMove(1, 1, 1, 1, 1, 10)); // 未越阈值
    feed(pointerMove(10, 0, 11, 1, 1, 20)); // 越阈值 → begin
    feed(pointerMove(10, 0, 21, 1, 1, 30)); // update
    feed(pointerUp(0, 21, 1, 40)); // end
    expect(phases).toEqual(['begin', 'update', 'end']);
  });

  test('轻点不产 drag', () => {
    const gestures = recognizeAll([pointerDown(0, 10, 10, 0), pointerMove(1, 1, 11, 11, 1, 10), pointerUp(0, 11, 11, 20)]);
    expect(gestures.some((gesture) => gesture.kind === 'drag')).toBe(false);
  });

  test('按键位掩码判定', () => {
    expect(maskHas(1, 0)).toBe(true);
    expect(maskHas(2, 0)).toBe(false);
    expect(maskHas(4, 1)).toBe(true);
    expect(maskHas(2, 2)).toBe(true);
  });
});

describe('识别：滚轮与捏合（设计验收 ⑤）', () => {
  test('notch 累积到一格才产出 wheel 手势', () => {
    const gestures = recognizeAll([wheel('notch', 0, -20, 0), wheel('notch', 0, -25, 16)]);
    expect(gestures).toEqual([{ kind: 'wheel', dir: 'up', minDelta: 40 }]);
  });

  test('捏合累计到步长产出 pinch:out', () => {
    // 30 个 0.002 的小事件累计 0.06 > 0.02 步长
    const signals: InputSignal[] = [];
    for (let index = 0; index < 30; index += 1) signals.push(pinch(0.002, index * 16));
    const gestures = recognizeAll(signals);
    expect(gestures.length).toBeGreaterThanOrEqual(1);
    expect(gestures[0]).toEqual({ kind: 'pinch', dir: 'out', minScale: 0.02 });
  });

  test('捏合不产 wheel 误触发', () => {
    const signals: InputSignal[] = [];
    for (let index = 0; index < 30; index += 1) signals.push(pinch(0.002, index * 16));
    expect(recognizeAll(signals).some((gesture) => gesture.kind === 'wheel')).toBe(false);
  });

  test('平移不产 wheel 手势（需空闲后才结算甩动）', () => {
    const gestures = recognizeAll([wheel('pan', 50, 0, 0)]);
    expect(gestures).toEqual([]);
  });
});

describe('甩动方向', () => {
  test('取绝对值较大的一轴', () => {
    expect(swipeDirection(50, 10)).toBe('right');
    expect(swipeDirection(-50, 10)).toBe('left');
    expect(swipeDirection(10, -50)).toBe('up');
    expect(swipeDirection(10, 50)).toBe('down');
  });
});

describe('手势形状比较', () => {
  test('阈值与实测值不参与形状比较', () => {
    const binding: GesturePattern = { kind: 'hold', target: { code: 'Space' }, minMs: 250 };
    const recognized: GesturePattern = { kind: 'hold', target: { code: 'Space' }, minMs: 312 };
    expect(sameGesture(binding, recognized)).toBe(true);
    expect(gestureShape(binding)).toBe('hold:Space');
  });

  test('不同按键不相等', () => {
    expect(
      sameGesture(
        { kind: 'press', target: { code: 'KeyA' } },
        { kind: 'press', target: { code: 'KeyB' } },
      ),
    ).toBe(false);
  });

  test('单击与双击不相等', () => {
    expect(
      sameGesture({ kind: 'click', button: 0, count: 1 }, { kind: 'click', button: 0, count: 2 }),
    ).toBe(false);
  });

  test('拖拽分轴形状不同', () => {
    expect(gestureShape({ kind: 'drag', button: 0, axis: 'x', minPx: 4 })).toBe('drag:0:x');
    expect(gestureShape({ kind: 'drag', button: 0, minPx: 4 })).toBe('drag:0:any');
  });
});

/** 由 DSL 构造绑定。 */
const bindingOf = (id: string, commandId: string, text: string, extra: Partial<Binding> = {}): Binding => {
  const draft = draftFromText(text, 'mac');
  return { id, commandId, origin: 'host', ...draft, ...extra };
};

describe('chord 匹配', () => {
  const context = (overrides: Partial<Parameters<typeof chordSatisfied>[1]> = {}) => ({
    scopes: new Set<'global'>(['global']),
    pressedKeys: new Set<string>(),
    pressedButtons: new Set<number>(),
    mods: { ...NO_MODIFIERS },
    inInput: false,
    ...overrides,
  });

  test('exact 要求修饰键完全一致', () => {
    const binding = bindingOf('a', 'cmd', 'cmd+press:KeyS');
    expect(chordSatisfied(binding.chord, context({ mods: { ...NO_MODIFIERS, meta: true } }))).toBe(true);
    expect(
      chordSatisfied(binding.chord, context({ mods: { ...NO_MODIFIERS, meta: true, shift: true } })),
    ).toBe(false);
  });

  test('atLeast 允许多余修饰键', () => {
    const binding = bindingOf('a', 'cmd', 'cmd+*+press:KeyS');
    expect(
      chordSatisfied(binding.chord, context({ mods: { ...NO_MODIFIERS, meta: true, shift: true } })),
    ).toBe(true);
  });

  test('需按住的鼠标键', () => {
    const binding = bindingOf('a', 'cmd', '0+press:KeyS');
    expect(chordSatisfied(binding.chord, context())).toBe(false);
    expect(chordSatisfied(binding.chord, context({ pressedButtons: new Set([0]) }))).toBe(true);
  });

  test('需按住的非修饰键', () => {
    const binding = bindingOf('a', 'cmd', 'space+press:KeyS');
    expect(chordSatisfied(binding.chord, context({ pressedKeys: new Set(['Space']) }))).toBe(true);
  });
});

describe('具体度全序（设计验收 ⑨）', () => {
  const order = new Map<string, number>();

  test('weight 优先', () => {
    const a = bindingOf('a', 'one', 'press:KeyS', { weight: 10 });
    const b = bindingOf('b', 'two', 'press:KeyS');
    expect(compareSpecificity(a, b, order)).toBeLessThan(0);
  });

  test('修饰键多者优先', () => {
    const a = bindingOf('a', 'one', 'cmd+shift+press:KeyS');
    const b = bindingOf('b', 'two', 'cmd+press:KeyS');
    expect(compareSpecificity(a, b, order)).toBeLessThan(0);
  });

  test('exact 优先于 atLeast', () => {
    const a = bindingOf('a', 'one', 'cmd+press:KeyS');
    const b = bindingOf('b', 'two', 'cmd+*+press:KeyS');
    expect(compareSpecificity(a, b, order)).toBeLessThan(0);
  });

  test('时序具体度：tap 优先于 press', () => {
    const a = bindingOf('a', 'one', 'tap:KeyS');
    const b = bindingOf('b', 'two', 'press:KeyS');
    expect(compareSpecificity(a, b, order)).toBeLessThan(0);
  });

  test('作用域深者优先', () => {
    const a = bindingOf('a', 'one', 'press:KeyS', { scope: 'editor' });
    const b = bindingOf('b', 'two', 'press:KeyS', { scope: 'global' });
    expect(compareSpecificity(a, b, order)).toBeLessThan(0);
  });

  test('origin 优先级 user > host > default', () => {
    const a = bindingOf('a', 'one', 'press:KeyS', { origin: 'user' });
    const b = bindingOf('b', 'two', 'press:KeyS', { origin: 'host' });
    const c = bindingOf('c', 'three', 'press:KeyS', { origin: 'default' });
    expect(compareSpecificity(a, b, order)).toBeLessThan(0);
    expect(compareSpecificity(b, c, order)).toBeLessThan(0);
  });

  test('注册顺序：后注册者胜', () => {
    const withOrder = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const a = bindingOf('a', 'one', 'press:KeyS');
    const b = bindingOf('b', 'two', 'press:KeyS');
    expect(compareSpecificity(a, b, withOrder)).toBeGreaterThan(0);
  });

  test('三者共存时按 ⌘⇧S 只选最具体者', () => {
    const bindings = [
      bindingOf('a', 'plain', 'press:KeyS'),
      bindingOf('b', 'cmd', 'cmd+press:KeyS'),
      bindingOf('c', 'cmdShift', 'cmd+shift+press:KeyS'),
    ];
    const gesture: GesturePattern = { kind: 'press', target: { code: 'KeyS' } };
    const context = {
      scopes: new Set<'global'>(['global']),
      pressedKeys: new Set<string>(),
      pressedButtons: new Set<number>(),
      mods: { ...NO_MODIFIERS, meta: true, shift: true },
      inInput: false,
    };
    const candidates = filterCandidates(bindings, gesture, context, () => true);
    expect(pickBest(candidates, order)?.commandId).toBe('cmdShift');
  });
});

describe('作用域与焦点过滤（设计验收 ⑪⑫）', () => {
  test('作用域不在栈中则不参与', () => {
    const binding = bindingOf('a', 'cmd', 'press:KeyS', { scope: 'modal' });
    const gesture: GesturePattern = { kind: 'press', target: { code: 'KeyS' } };
    const context = {
      scopes: new Set<'global'>(['global']),
      pressedKeys: new Set<string>(),
      pressedButtons: new Set<number>(),
      mods: { ...NO_MODIFIERS },
      inInput: false,
    };
    expect(filterCandidates([binding], gesture, context, () => true)).toHaveLength(0);
  });

  test('allowInInput 为假时输入框内不触发', () => {
    const binding = bindingOf('a', 'cmd', 'press:KeyS');
    const gesture: GesturePattern = { kind: 'press', target: { code: 'KeyS' } };
    const context = {
      scopes: new Set<'global'>(['global']),
      pressedKeys: new Set<string>(),
      pressedButtons: new Set<number>(),
      mods: { ...NO_MODIFIERS },
      inInput: true,
    };
    expect(filterCandidates([binding], gesture, context, () => true)).toHaveLength(0);
    const allowed = bindingOf('b', 'cmd2', 'press:KeyS', { allowInInput: true });
    expect(filterCandidates([allowed], gesture, context, () => true)).toHaveLength(1);
  });
});

describe('诊断（设计验收 ⑩）', () => {
  test('纯修饰键 press 报 modifier-press', () => {
    const binding = bindingOf('a', 'cmd', 'press:ShiftLeft');
    const diagnostics = diagnoseBindings([binding]);
    expect(diagnostics.some((item) => item.code === 'modifier-press')).toBe(true);
    expect(diagnostics[0].level).toBe('error');
  });

  test('纯修饰键 release 合法', () => {
    const binding = bindingOf('a', 'cmd', 'release:ShiftLeft');
    expect(diagnoseBindings([binding])).toHaveLength(0);
  });

  test('完全相同的绑定报 conflict', () => {
    const a = bindingOf('a', 'one', 'press:KeyS');
    const b = bindingOf('b', 'two', 'press:KeyS');
    const diagnostics = diagnoseBindings([a, b]);
    expect(diagnostics.some((item) => item.code === 'conflict')).toBe(true);
  });

  test('不同 when 不算冲突', () => {
    const a = bindingOf('a', 'one', 'press:KeyS', { when: 'inCanvas' });
    const b = bindingOf('b', 'two', 'press:KeyS', { when: 'inList' });
    expect(diagnoseBindings([a, b]).some((item) => item.code === 'conflict')).toBe(false);
  });

  test('不同作用域不算冲突', () => {
    const a = bindingOf('a', 'one', 'press:KeyS', { scope: 'editor' });
    const b = bindingOf('b', 'two', 'press:KeyS', { scope: 'global' });
    expect(diagnoseBindings([a, b]).some((item) => item.code === 'conflict')).toBe(false);
  });
});

describe('识别器独立性', () => {
  test('reset 清空自身累积但不清外部会话（职责分离：会话由 router 重置）', () => {
    const session = createInputSession();
    const recognizer = createRecognizer({ session });
    recognizer.feed(keyDown('KeyA', 0));
    expect(session.pressedKeys.has('KeyA')).toBe(true);
    recognizer.reset();
    // 会话状态不归识别器管：router.reset() 才同时清两者
    expect(session.pressedKeys.size).toBe(1);
  });

  test('同一信号重复喂入不重复 press（repeat 语义由事件决定）', () => {
    const recognizer = createRecognizer({ session: createInputSession() });
    const first = recognizer.feed(keyDown('KeyA', 0));
    const second = recognizer.feed(keyDown('KeyA', 10, NO_MODIFIERS, true));
    expect(first[0].gesture.kind).toBe('press');
    expect(second[0].gesture.kind).toBe('repeat');
  });
});

describe('vi 注入时钟的可测性', () => {
  test('识别器不依赖真实时钟', () => {
    vi.useFakeTimers();
    const recognizer = createRecognizer({ session: createInputSession() });
    expect(recognizer.feed(keyDown('KeyA', 0))).toHaveLength(1);
    vi.useRealTimers();
  });
});
