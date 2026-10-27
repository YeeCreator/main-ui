/**
 * 路由器行为契约测试（设计验收 ⑧⑪⑬⑭）。
 *
 * 路由器是全系统最易出错的一环：序列裁决、作用域优先、录制态、
 * 连续手势的 begin/update/end 都集中在这里。测试用注入时钟精确控制时间。
 */
import { describe, expect, test, vi } from 'vitest';
import { createInputRouter } from '../src/input/router';
import { draftFromText } from '../src/input/binding-dsl';
import { NO_MODIFIERS, type Binding, type InputSignal, type InputTrigger } from '../src/input/types';

/** 由 DSL 构造绑定。 */
const bindingOf = (id: string, commandId: string, text: string, extra: Partial<Binding> = {}): Binding => ({
  id,
  commandId,
  origin: 'host',
  ...draftFromText(text, 'mac'),
  ...extra,
});

/** 构造键盘信号。 */
const keyDown = (code: string, t: number): InputSignal => ({
  phase: 'down',
  source: 'keyboard',
  code,
  key: code,
  mods: NO_MODIFIERS,
  repeat: false,
  t,
});

const keyUp = (code: string, t: number): InputSignal => ({
  phase: 'up',
  source: 'keyboard',
  code,
  key: code,
  mods: NO_MODIFIERS,
  repeat: false,
  heldMs: 0,
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

const pointerMove = (dx: number, dy: number, x: number, y: number, buttons: number, t: number): InputSignal => ({
  phase: 'move',
  source: 'pointer',
  dx,
  dy,
  buttons,
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

/** 建一个可手动推进时间、手动触发定时器的测试装置。 */
const createHarness = (bindings: Binding[]) => {
  let currentTime = 0;
  const timers: Array<{ at: number; handler: () => void; cancelled: boolean }> = [];
  const triggers: Array<{ trigger: InputTrigger; binding: Binding }> = [];

  const router = createInputRouter({
    now: () => currentTime,
    setTimeout: (handler, ms) => {
      const entry = { at: currentTime + ms, handler, cancelled: false };
      timers.push(entry);
      return () => {
        entry.cancelled = true;
      };
    },
    onTrigger: (trigger, binding) => triggers.push({ trigger, binding }),
  });
  router.setBindings(bindings);

  return {
    router,
    triggers,
    /** 推进时间并触发到期的定时器。 */
    advance(ms: number) {
      currentTime += ms;
      for (const timer of timers) {
        if (timer.cancelled) continue;
        if (timer.at <= currentTime) {
          timer.cancelled = true;
          timer.handler();
        }
      }
    },
    feed(signal: InputSignal) {
      router.feed(signal);
    },
    now: () => currentTime,
    dispose: () => router.dispose(),
  };
};

describe('序列裁决（设计验收 ⑧）', () => {
  test('仅有 press:KeyG 时立即触发', () => {
    const harness = createHarness([bindingOf('a', 'one', 'press:KeyG')]);
    harness.feed(keyDown('KeyG', 0));
    expect(harness.triggers).toHaveLength(1);
    expect(harness.triggers[0].binding.commandId).toBe('one');
    harness.dispose();
  });

  test('G 与 GG 共存时首次 G 先挂起，窗口内第二击触发序列', () => {
    const harness = createHarness([
      bindingOf('single', 'single', 'press:KeyG'),
      bindingOf('double', 'double', 'press:KeyG then press:KeyG'),
    ]);
    harness.feed(keyDown('KeyG', 0));
    expect(harness.triggers).toHaveLength(0); // 挂起等待

    harness.advance(100);
    harness.feed(keyDown('KeyG', 100));
    expect(harness.triggers).toHaveLength(1);
    expect(harness.triggers[0].binding.commandId).toBe('double');
    harness.dispose();
  });

  test('G 与 GG 共存时超时触发单键', () => {
    const harness = createHarness([
      bindingOf('single', 'single', 'press:KeyG'),
      bindingOf('double', 'double', 'press:KeyG then press:KeyG'),
    ]);
    harness.feed(keyDown('KeyG', 0));
    expect(harness.triggers).toHaveLength(0);

    harness.advance(300); // 超过 sequenceTimeoutMs(250)
    expect(harness.triggers).toHaveLength(1);
    expect(harness.triggers[0].binding.commandId).toBe('single');
    harness.dispose();
  });

  test('前缀无可执行绑定时超时静默丢弃', () => {
    const harness = createHarness([bindingOf('double', 'double', 'press:KeyG then press:KeyH')]);
    harness.feed(keyDown('KeyG', 0));
    harness.advance(300);
    // G 无独立绑定，H 未按 → 无触发
    expect(harness.triggers).toHaveLength(0);
    harness.dispose();
  });

  test('序列首段不匹配时不挂起', () => {
    const harness = createHarness([bindingOf('double', 'double', 'press:KeyG then press:KeyH')]);
    harness.feed(keyDown('KeyX', 0));
    harness.advance(300);
    expect(harness.triggers).toHaveLength(0);
    harness.dispose();
  });
});

describe('具体度胜出（设计验收 ⑨）', () => {
  test('作用域深者吞掉同输入的浅层绑定（设计验收 ⑪）', () => {
    const harness = createHarness([
      bindingOf('global', 'globalCmd', 'press:KeyS', { scope: 'global' }),
      bindingOf('modal', 'modalCmd', 'press:KeyS', { scope: 'modal' }),
    ]);
    harness.router.pushScope('modal');
    harness.feed(keyDown('KeyS', 0));
    expect(harness.triggers).toHaveLength(1);
    expect(harness.triggers[0].binding.commandId).toBe('modalCmd');
    harness.dispose();
  });

  test('作用域不在栈中则不触发', () => {
    const harness = createHarness([bindingOf('a', 'cmd', 'press:KeyS', { scope: 'modal' })]);
    harness.feed(keyDown('KeyS', 0));
    expect(harness.triggers).toHaveLength(0);
    harness.dispose();
  });

  test('popScope 后回落到浅层绑定', () => {
    const harness = createHarness([
      bindingOf('global', 'globalCmd', 'press:KeyS', { scope: 'global' }),
      bindingOf('modal', 'modalCmd', 'press:KeyS', { scope: 'modal' }),
    ]);
    harness.router.pushScope('modal');
    harness.router.popScope('modal');
    harness.feed(keyDown('KeyS', 0));
    expect(harness.triggers[0].binding.commandId).toBe('globalCmd');
    harness.dispose();
  });
});

describe('输入框焦点（设计验收 ⑫）', () => {
  test('allowInInput 为假时不触发', () => {
    const harness = createHarness([bindingOf('a', 'cmd', 'press:KeyS')]);
    harness.router.setInInput(true);
    harness.feed(keyDown('KeyS', 0));
    expect(harness.triggers).toHaveLength(0);
    harness.dispose();
  });

  test('allowInInput 为真时触发', () => {
    const harness = createHarness([bindingOf('a', 'cmd', 'press:KeyS', { allowInInput: true })]);
    harness.router.setInInput(true);
    harness.feed(keyDown('KeyS', 0));
    expect(harness.triggers).toHaveLength(1);
    harness.dispose();
  });
});

describe('连续手势（设计验收 ⑭）', () => {
  test('stream 绑定按 begin → update → end 回调', () => {
    const harness = createHarness([
      bindingOf('a', 'pan', 'drag:1:4', { mode: 'stream', swallow: true }),
    ]);
    harness.feed(pointerDown(1, 0, 0, 0));
    harness.feed(pointerMove(10, 0, 10, 0, 4, 16));
    harness.feed(pointerMove(10, 0, 20, 0, 4, 32));
    harness.feed(pointerUp(1, 20, 0, 48));

    const phases = harness.triggers.map((entry) => entry.trigger.phase);
    expect(phases).toEqual(['begin', 'update', 'end']);
    harness.dispose();
  });

  test('end 阶段的 delta 是累计位移', () => {
    const harness = createHarness([bindingOf('a', 'pan', 'drag:1:4', { mode: 'stream' })]);
    harness.feed(pointerDown(1, 0, 0, 0));
    harness.feed(pointerMove(10, 0, 10, 0, 4, 16));
    harness.feed(pointerMove(15, 5, 25, 5, 4, 32));
    harness.feed(pointerUp(1, 25, 5, 48));

    const end = harness.triggers.find((entry) => entry.trigger.phase === 'end');
    expect(end?.trigger.delta).toEqual({ dx: 25, dy: 5 });
    harness.dispose();
  });

  test('once 绑定在 end 阶段一次性触发', () => {
    const harness = createHarness([bindingOf('a', 'erase', 'drag:1:4')]);
    harness.feed(pointerDown(1, 0, 0, 0));
    harness.feed(pointerMove(10, 0, 10, 0, 4, 16));
    harness.feed(pointerUp(1, 10, 0, 32));
    expect(harness.triggers).toHaveLength(1);
    expect(harness.triggers[0].trigger.phase).toBe('end');
    harness.dispose();
  });
});

describe('触发上下文（设计验收 ⑬）', () => {
  test('命令收到 bindingId / gesture / phase', () => {
    const harness = createHarness([bindingOf('my-binding', 'cmd', 'press:KeyS')]);
    harness.feed(keyDown('KeyS', 0));
    const trigger = harness.triggers[0].trigger;
    expect(trigger.bindingId).toBe('my-binding');
    expect(trigger.gesture).toEqual({ kind: 'press', target: { code: 'KeyS' } });
    expect(trigger.phase).toBe('begin');
    expect(trigger.source).toBe('keyboard');
    harness.dispose();
  });
});

describe('录制态', () => {
  test('录制时既有绑定不触发', async () => {
    const harness = createHarness([bindingOf('a', 'cmd', 'press:KeyS')]);
    const pending = harness.router.captureOnce({ timeoutMs: 5000 });
    harness.feed(keyDown('KeyS', 0));
    const draft = await pending;
    expect(draft?.gesture).toEqual({ kind: 'press', target: { code: 'KeyS' } });
    expect(harness.triggers).toHaveLength(0);
    harness.dispose();
  });

  test('取消录制返回 null', async () => {
    const harness = createHarness([]);
    const pending = harness.router.captureOnce({ timeoutMs: 5000 });
    harness.router.cancelCapture();
    expect(await pending).toBeNull();
    harness.dispose();
  });

  test('录制超时返回 null', async () => {
    const harness = createHarness([]);
    const pending = harness.router.captureOnce({ timeoutMs: 100 });
    harness.advance(150);
    expect(await pending).toBeNull();
    harness.dispose();
  });
});

describe('诊断', () => {
  test('暴露 conflict 与 modifier-press', () => {
    const harness = createHarness([
      bindingOf('a', 'one', 'press:KeyS'),
      bindingOf('b', 'two', 'press:KeyS'),
      bindingOf('c', 'three', 'press:ShiftLeft'),
    ]);
    const codes = harness.router.diagnose().map((item) => item.code);
    expect(codes).toContain('conflict');
    expect(codes).toContain('modifier-press');
    harness.dispose();
  });
});

describe('注入时钟（无真实定时器）', () => {
  test('不使用真实 setTimeout', () => {
    vi.useFakeTimers();
    const harness = createHarness([bindingOf('a', 'one', 'press:KeyG')]);
    harness.feed(keyDown('KeyG', 0));
    expect(harness.triggers).toHaveLength(1);
    harness.dispose();
    vi.useRealTimers();
  });
});
