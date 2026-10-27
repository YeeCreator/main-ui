/**
 * input/router —— 输入路由：序列裁决 / 作用域栈 / 录制 / 诊断。
 *
 * 这是输入引擎的门面。它把「信号 → 识别 → 匹配 → 触发」串成一条链，
 * 并负责三件容易出错的事：
 *
 * 1. **序列裁决**：`G` 与 `G → G` 共存时，`G` 必须先等一个窗口；
 * 2. **作用域优先**：`modal` 层的绑定吞掉输入时，`global` 层不触发；
 * 3. **录制态**：面板捕获输入期间，既有绑定必须完全暂停。
 *
 * 本模块不认识命令：命中后通过 `onTrigger` 回调交给上层（主包的命令桥）。
 */
import type {
  Binding,
  BindingDraft,
  GesturePattern,
  InputDiagnostic,
  InputScope,
  InputSignal,
  InputTimings,
  InputTrigger,
} from './types';
import { DEFAULT_INPUT_TIMINGS, INPUT_SCOPE_DEPTH } from './types';
import { createInputSession, type InputSession } from './session';
import { createRecognizer, type RecognizedGesture, type Recognizer, settleSwipe } from './recognizer';
import {
  createInputSourceProviderRegistry,
  type InputSourceCapability,
  type InputSourceProvider,
  type InputSourceProviderRegistry,
} from './provider';
import { diagnoseBindings, filterCandidates, pickBest, sameGesture } from './matcher';

/** 序列挂起态。 */
type PendingSequence = {
  gestures: GesturePattern[];
  /** 窗口结束时刻。 */
  expiresAt: number;
  /** 窗口结束时的清理器。 */
  cancel: () => void;
};

/** 路由选项。 */
export type InputRouterOptions = {
  timings?: Partial<InputTimings>;
  now?: () => number;
  setTimeout?: (handler: () => void, ms: number) => () => void;
  /** `when` 求值；缺省恒真。 */
  evaluateWhen?: (binding: Binding) => boolean;
  /** 命中回调（由命令桥实现）。 */
  onTrigger?: (trigger: InputTrigger, binding: Binding) => void;
  /** 记录被浏览器吞掉的输入（诊断用）。 */
  onBlockedByBrowser?: (signal: InputSignal) => void;
};

/** 路由实例。 */
export type InputRouter = {
  /** 喂入信号。 */
  feed: (signal: InputSignal) => void;
  /** 替换绑定集合。 */
  setBindings: (bindings: Binding[]) => void;
  /** 读取当前绑定。 */
  listBindings: () => Binding[];
  /** 压入作用域。 */
  pushScope: (scope: InputScope) => void;
  /** 弹出作用域（缺省弹出最近一次压入的）。 */
  popScope: (scope?: InputScope) => void;
  /** 当前作用域栈。 */
  scopes: () => InputScope[];
  /** 设置焦点是否在可编辑元素内。 */
  setInInput: (inInput: boolean) => void;
  /** 进入录制态：忽略既有绑定，返回首个识别出的手势。 */
  captureOnce: (options?: { timeoutMs?: number }) => Promise<BindingDraft | null>;
  /** 取消录制。 */
  cancelCapture: () => void;
  /** 诊断。 */
  diagnose: () => InputDiagnostic[];
  /** 原生输入源注册表。 */
  providers: InputSourceProviderRegistry;
  /** 注册原生输入源提供者。 */
  addProvider: (provider: InputSourceProvider) => () => void;
  /** 已由原生桥覆盖的能力。 */
  nativeCapabilities: () => InputSourceCapability[];
  /** 输入会话（只读用途：面板展示已按住键等）。 */
  session: () => Readonly<InputSession>;
  /** 清空全部状态。 */
  reset: () => void;
  /** 销毁。 */
  dispose: () => void;
};

/** 默认时钟。 */
const defaultNow = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** 默认定时器。 */
const defaultSetTimeout = (handler: () => void, ms: number): (() => void) => {
  if (typeof setTimeout !== 'function') return () => undefined;
  const id = setTimeout(handler, ms);
  return () => clearTimeout(id);
};

/**
 * 创建输入路由。
 *
 * @param options 选项。
 * @returns 路由实例。
 * @example
 * const router = createInputRouter({
 *   evaluateWhen: (binding) => evaluateWhen(binding.when, { keys }),
 *   onTrigger: (trigger, binding) => runtime.core.executeCommand(binding.commandId),
 * })
 * router.setBindings(bindings)
 */
export function createInputRouter(options: InputRouterOptions = {}): InputRouter {
  const timings: InputTimings = { ...DEFAULT_INPUT_TIMINGS, ...options.timings };
  const now = options.now ?? defaultNow;
  const setTimer = options.setTimeout ?? defaultSetTimeout;
  const evaluate = options.evaluateWhen ?? (() => true);

  const session = createInputSession();
  const registrations = new Map<string, number>();
  let registrationCounter = 0;

  let bindings: Binding[] = [];
  const scopeStack: InputScope[] = ['global'];
  let inInput = false;

  const recognizer: Recognizer = createRecognizer({ session, timings });
  const providers = createInputSourceProviderRegistry();
  const activeProviderStops = new Map<string, () => void>();

  let pending: PendingSequence | null = null;
  let capture: {
    resolve: (draft: BindingDraft | null) => void;
    cancel: () => void;
  } | null = null;

  const inCapture = (): boolean => capture !== null;

  /** 构建匹配上下文。 */
  const matchContext = () => ({
    scopes: new Set(scopeStack),
    pressedKeys: session.pressedKeys,
    pressedButtons: session.pressedButtons,
    mods: session.mods,
    inInput,
  });

  /** 触发一条绑定。 */
  const fire = (binding: Binding, gesture: GesturePattern, phase: 'begin' | 'update' | 'end', signal: InputSignal, delta?: RecognizedGesture['delta']) => {
    const trigger: InputTrigger = {
      bindingId: binding.id,
      source: signal.source,
      gesture,
      phase,
    };
    if (delta) trigger.delta = { dx: delta.dx, dy: delta.dy, scale: delta.scale };
    options.onTrigger?.(trigger, binding);
  };

  /** 清空序列挂起。 */
  const clearPending = (): void => {
    if (!pending) return;
    pending.cancel();
    pending = null;
  };

  /** 挂起一个序列前缀。 */
  const scheduleSequence = (gestures: GesturePattern[], signal: InputSignal): void => {
    clearPending();
    const cancelTimer = setTimer(() => {
      pending = null;
      // 超时：把**前缀首段**当作完整手势尝试触发独立绑定
      // （"G 与 GG 共存" 时，窗口过后 G 应执行单键绑定）。
      const standalone = gestures[0];
      const candidates = filterCandidates(bindings, standalone, matchContext(), evaluate).filter(
        (binding) => (binding.sequence ?? []).length === 0,
      );
      const best = pickBest(candidates, registrations);
      if (best) fire(best, standalone, 'begin', signal);
    }, timings.sequenceTimeoutMs);
    pending = { gestures, expiresAt: now() + timings.sequenceTimeoutMs, cancel: cancelTimer };
  };

  /** 处理一个已识别手势。 */
  const handleGesture = (recognized: RecognizedGesture): void => {
    const { gesture, phase, delta, signal } = recognized;

    // 录制态：只捕获，不分发
    if (capture) {
      if (gesture.kind === 'press' || gesture.kind === 'click' || gesture.kind === 'wheel') {
        const draft = captureDraft(gesture);
        const resolve = capture.resolve;
        exitCapture();
        resolve(draft);
      }
      return;
    }

    // 连续手势的 update/end 直接分发给已命中的流式绑定
    if (phase === 'update' || phase === 'end') {
      const streamCandidates = filterCandidates(bindings, gesture, matchContext(), evaluate).filter(
        (binding) => binding.mode === 'stream',
      );
      const best = pickBest(streamCandidates, registrations);
      if (best) fire(best, gesture, phase, signal, delta);
      else if (phase === 'end') {
        // 非流式绑定只在 end 一次性触发：begin 阶段不触发，否则会双发
        const candidates = filterCandidates(bindings, gesture, matchContext(), evaluate).filter(
          (binding) => binding.mode !== 'stream',
        );
        const fallback = pickBest(candidates, registrations);
        if (fallback) fire(fallback, gesture, 'end', signal, delta);
      }
      return;
    }

    // 非流式绑定若该手势还存在 update/end 阶段（拖拽/捏合），
    // begin 阶段不触发 —— 等 end 一次性结算，避免同一次手势双发。
    const hasContinuousPhase =
      gesture.kind === 'drag' || gesture.kind === 'pinch' || gesture.kind === 'rotate' || gesture.kind === 'swipe';
    const candidatesForPhase = filterCandidates(bindings, gesture, matchContext(), evaluate);
    if (hasContinuousPhase) {
      const streamable = candidatesForPhase.filter((binding) => binding.mode === 'stream');
      if (streamable.length > 0) {
        const best = pickBest(streamable, registrations);
        if (best) fire(best, gesture, 'begin', signal, delta);
        return;
      }
      // 只剩非流式绑定：begin 静默，等 end
      if (candidatesForPhase.some((binding) => binding.mode !== 'stream')) return;
    }

    // 序列补全：先看能否接上已挂起的前缀
    if (pending) {
      const extended = [...pending.gestures, gesture];
      const sequenceMatches = bindings.filter((binding) => {
        const full = [...(binding.sequence ?? []), binding.gesture];
        if (full.length !== extended.length) return false;
        if (!full.every((item, index) => sameGesture(item, extended[index]))) return false;
        if (binding.scope && !matchContext().scopes.has(binding.scope)) return false;
        if (!binding.allowInInput && inInput) return false;
        return evaluate(binding);
      });
      if (sequenceMatches.length > 0) {
        clearPending();
        const best = pickBest(sequenceMatches, registrations);
        if (best) fire(best, gesture, 'begin', signal, delta);
        return;
      }
      clearPending();
    }

    // 存在以该手势为前缀的序列 → 挂起
    const prefixes = bindings.filter((binding) => {
      const full = [...(binding.sequence ?? []), binding.gesture];
      if (full.length <= 1) return false;
      if (!sameGesture(full[0], gesture)) return false;
      if (binding.scope && !matchContext().scopes.has(binding.scope)) return false;
      if (!binding.allowInInput && inInput) return false;
      return evaluate(binding);
    });

    if (prefixes.length > 0) {
      scheduleSequence([gesture], signal);
      return;
    }

    const candidates = filterCandidates(bindings, gesture, matchContext(), evaluate);
    const best = pickBest(candidates, registrations);
    if (best) fire(best, gesture, phase, signal, delta);
  };

  /** 由手势构造可持久化草稿（录制态用）。 */
  const captureDraft = (gesture: GesturePattern): BindingDraft => ({
    chord: {
      mods: { ...session.mods },
      modsMatch: 'exact',
      buttons: [...session.pressedButtons],
      keys: [...session.pressedKeys].filter((code) => !isModifierLike(code)),
    },
    gesture,
    swallow: true,
    mode: 'once',
  });

  const isModifierLike = (code: string): boolean =>
    code === 'ShiftLeft' || code === 'ShiftRight' || code === 'ControlLeft' || code === 'ControlRight' ||
    code === 'AltLeft' || code === 'AltRight' || code === 'MetaLeft' || code === 'MetaRight';

  const exitCapture = (): void => {
    if (!capture) return;
    const current = capture;
    capture = null;
    current.cancel();
  };

  /** 定期结算甩动（空闲后触发）。 */
  const tick = (): void => {
    const swipe = settleSwipe(session, timings, now());
    if (!swipe) return;
    handleGesture({
      gesture: { kind: 'swipe', dir: swipe.dir, minPx: timings.swipeMinPx, maxMs: timings.swipeMaxMs },
      phase: 'begin',
      signal: { phase: 'wheel', source: 'wheel', kind: 'pan', dx: 0, dy: 0, mods: session.mods, pos: { x: 0, y: 0 }, t: now() },
    });
  };

  return {
    feed(signal) {
      for (const recognized of recognizer.feed(signal)) handleGesture(recognized);
      tick();
    },
    setBindings(next) {
      bindings = [...next];
      for (const binding of bindings) {
        if (!registrations.has(binding.id)) registrations.set(binding.id, registrationCounter++);
      }
    },
    listBindings: () => [...bindings],
    pushScope(scope) {
      if (scopeStack[scopeStack.length - 1] === scope) return;
      scopeStack.push(scope);
    },
    popScope(scope) {
      if (scopeStack.length <= 1) return;
      if (!scope) {
        scopeStack.pop();
        return;
      }
      const index = scopeStack.lastIndexOf(scope);
      if (index > 0) scopeStack.splice(index, 1);
    },
    scopes: () => [...scopeStack],
    setInInput(next) {
      inInput = next;
    },
    captureOnce(captureOptions) {
      exitCapture();
      const timeoutMs = captureOptions?.timeoutMs ?? 8000;
      return new Promise<BindingDraft | null>((resolve) => {
        const cancelTimer = setTimer(() => {
          if (!capture) return;
          capture = null;
          resolve(null);
        }, timeoutMs);
        capture = {
          resolve: (draft) => resolve(draft),
          cancel: () => {
            cancelTimer();
          },
        };
      });
    },
    cancelCapture() {
      if (!capture) return;
      const current = capture;
      exitCapture();
      current.resolve(null);
    },
    diagnose: () => diagnoseBindings(bindings),
    providers,
    addProvider(provider) {
      const unregister = providers.register(provider);
      const stop = provider.start((signal) => this.feed(signal));
      activeProviderStops.set(provider.id, stop);
      return () => {
        const existing = activeProviderStops.get(provider.id);
        if (existing) {
          existing();
          activeProviderStops.delete(provider.id);
        }
        unregister();
      };
    },
    nativeCapabilities: () => providers.capabilities(),
    session: () => session,
    reset() {
      clearPending();
      recognizer.reset();
      session.reset();
    },
    dispose() {
      clearPending();
      for (const stop of activeProviderStops.values()) stop();
      activeProviderStops.clear();
      session.reset();
    },
  };
}

/**
 * 作用域深度（供上层判断「深者胜」时的可读比较）。
 *
 * @param scope 作用域。
 * @returns 深度值。
 */
export function scopeDepth(scope: InputScope): number {
  return INPUT_SCOPE_DEPTH[scope];
}
