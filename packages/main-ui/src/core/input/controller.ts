/**
 * core/input/controller —— 输入系统对外的门面（命令桥 + 绑定库）。
 *
 * 分层原因：`@main-ui/core/input` 只认识「信号 → 手势 → 绑定」，
 * 不认识命令；命令系统在主包里。本类正是两者的接缝：
 *
 * - 注册/注销绑定（落到 {@link ShortcutStore} 的 `host` 层）；
 * - 把合并结果推给路由（`router.setBindings`）；
 * - 暴露诊断、录制、作用域、原生扩展点；
 * - 用户覆盖的读写与导入导出。
 */
import type {
  Binding,
  BindingDraft,
  BindingParseError,
  InputDiagnostic,
  InputRouter,
  InputScope,
  InputSourceProvider,
  InputSourceCapability,
} from '@main-ui/core/input';
import { draftFromText, formatBinding, parseBinding } from '@main-ui/core/input';
import type { CommandDescriptor } from '../command/types';
import { ShortcutStore, type ShortcutOverrideMap } from './shortcut-store';

/** 注册入参：完整绑定，或草稿 + 命令 id。 */
export type BindingRegistration = Binding | (BindingDraft & { commandId: string; id?: string });

/**
 * 旧式注册入参（0.7.0 及以前）：`{ commandId, keybinding: 'Ctrl+Shift+P' }`。
 *
 * 保留它是为了**下游零改动迁移**：`main-ui` 的下游里有多个仓库属只读依赖，
 * 上游不能要求它们与自己同批改动。旧写法在这里被解析为
 * `press:<key>` 草稿，语义与原先完全一致（`Ctrl` 在 mac 上仍是 ⌘）。
 *
 * 这是**解析层的兼容**，不是双引擎：进去即转成同一份 {@link Binding}，
 * 匹配与诊断只有一条路径。
 */
export type LegacyKeybindingRegistration = {
  commandId: string;
  keybinding: string;
  when?: string;
  weight?: number;
  source?: string;
  allowInInput?: boolean;
  id?: string;
};

/** 导入结果。 */
export type ShortcutImportResult = {
  applied: number;
  skipped: number;
  /** 跳过原因（未知命令 / 解析失败）。 */
  skippedIds: string[];
};

/** 用户覆盖补丁。 */
export type ShortcutPatch = {
  /** 新表达式；`null` 表示解绑；`undefined` 表示不改。 */
  binding?: string | null;
};

/** 输入门面。 */
export class InputController {
  private readonly router: InputRouter;
  private readonly store: ShortcutStore;
  private readonly listCommands: () => CommandDescriptor[];
  /** 绑定或覆盖变更后的回调（runtime 用之落盘与重推路由）。 */
  private onChange: (() => void) | undefined;

  constructor(router: InputRouter, store: ShortcutStore, listCommands: () => CommandDescriptor[]) {
    this.router = router;
    this.store = store;
    this.listCommands = listCommands;
  }

  /**
   * 设置变更监听。
   *
   * 由 runtime 注入「重推绑定 + 落盘」，使任何一处改动都不会忘记同步：
   * 面板、导入、宿主注册走的是同一条出口。
   *
   * @param handler 变更回调。
   */
  setChangeHandler(handler: () => void): void {
    this.onChange = handler;
  }

  /**
   * 注册绑定。
   *
   * 接受三种形态：
   *
   * 1. 完整 {@link Binding}；
   * 2. 草稿 + `commandId`；
   * 3. 旧式 `{ commandId, keybinding: 'Ctrl+Shift+P' }`（为下游零改动迁移保留）。
   *
   * @param registration 注册入参。
   * @returns 实际使用的绑定 id。
   * @example
   * runtime.input.register({ commandId: 'demo.run', keybinding: 'Ctrl+Shift+P' })
   * runtime.input.register({ commandId: 'demo.run', ...draftFromText('alt+drag:0:x:8') })
   */
  register(registration: BindingRegistration | LegacyKeybindingRegistration): string {
    const binding = this.materialize(registration);
    this.store.registerHost(binding);
    this.sync();
    return binding.id;
  }

  /** 注销绑定（按绑定 id 或命令 id）。 */
  unregister(idOrCommandId: string): void {
    this.store.unregister(idOrCommandId);
    this.sync();
  }

  /** 当前生效的绑定（三层合并结果）。 */
  list(): Binding[] {
    return this.store.resolve((text) => draftFromText(text));
  }

  /** 注册默认绑定（框架内置）。 */
  registerDefault(registration: BindingRegistration): string {
    const binding = this.materialize({ ...registration, origin: 'default' } as Binding);
    this.store.registerDefault(binding);
    this.sync();
    return binding.id;
  }

  /** 作用域栈操作。 */
  pushScope(scope: InputScope): void {
    this.router.pushScope(scope);
  }

  popScope(scope?: InputScope): void {
    this.router.popScope(scope);
  }

  scopes(): InputScope[] {
    return this.router.scopes();
  }

  /** 焦点是否在可编辑元素内。 */
  setInInput(inInput: boolean): void {
    this.router.setInInput(inInput);
  }

  /** 诊断（冲突 / 修饰键误用 / 不可达）。 */
  diagnose(): InputDiagnostic[] {
    return this.router.diagnose();
  }

  /** 进入录制态。 */
  captureOnce(options?: { timeoutMs?: number }): Promise<BindingDraft | null> {
    return this.router.captureOnce(options);
  }

  /** 取消录制。 */
  cancelCapture(): void {
    this.router.cancelCapture();
  }

  /** 注册原生输入源提供者（Electron 桥扩展点）。 */
  addProvider(provider: InputSourceProvider): () => void {
    return this.router.addProvider(provider);
  }

  /** 已由原生桥覆盖的能力。 */
  nativeCapabilities(): InputSourceCapability[] {
    return this.router.nativeCapabilities();
  }

  /** 直接喂信号（非 DOM 环境或测试）。 */
  feed(signal: Parameters<InputRouter['feed']>[0]): void {
    this.router.feed(signal);
  }

  /**
   * 输入会话快照（只读）：面板展示已按住键、绘制录制态调试条。
   *
   * @returns 已按住键、鼠标键与修饰键状态。
   */
  sessionSnapshot(): {
    pressedKeys: ReadonlySet<string>;
    pressedButtons: ReadonlySet<number>;
    mods: { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean };
  } {
    const session = this.router.session();
    return {
      pressedKeys: new Set(session.pressedKeys),
      pressedButtons: new Set(session.pressedButtons),
      mods: { ...session.mods },
    };
  }

  // ---- 用户覆盖 ----

  /** 设置用户覆盖。 */
  setUserOverride(bindingId: string, patch: ShortcutPatch): void {
    const current = this.store.listOverrides()[bindingId] ?? {};
    const next = { ...current };
    if (patch.binding !== undefined) next.binding = patch.binding;
    this.store.setOverride(bindingId, next as { binding: string | null });
    this.sync();
  }

  /** 清除单个覆盖。 */
  resetUserOverride(bindingId: string): void {
    this.store.clearOverride(bindingId);
    this.sync();
  }

  /** 清除全部覆盖。 */
  resetAll(): void {
    this.store.clearAllOverrides();
    this.sync();
  }

  /** 导出（供持久化或分享）。 */
  exportJson(): string {
    return JSON.stringify({ version: 1, overrides: this.store.listOverrides() }, null, 2);
  }

  /**
   * 导入覆盖。
   *
   * 逐条校验：命令不存在、表达式非法、绑定 id 不存在 → 跳过并计数，
   * 不抛异常、不破坏既有绑定。
   *
   * @param text JSON 文本。
   * @returns 应用与跳过的条数。
   */
  importJson(text: string): ShortcutImportResult {
    const result: ShortcutImportResult = { applied: 0, skipped: 0, skippedIds: [] };
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { applied: 0, skipped: 1, skippedIds: ['<invalid-json>'] };
    }
    const container = parsed as { overrides?: unknown };
    const overrides = container?.overrides;
    if (!overrides || typeof overrides !== 'object') {
      return { applied: 0, skipped: 1, skippedIds: ['<missing-overrides>'] };
    }

    const knownIds = new Set(this.list().map((binding) => binding.id));
    const knownCommands = new Set(this.listCommands().map((command) => command.id));

    for (const [id, raw] of Object.entries(overrides as Record<string, unknown>)) {
      const entry = raw as { binding?: unknown };
      const bindingText = entry?.binding;
      if (bindingText !== null && typeof bindingText !== 'string') {
        result.skipped += 1;
        result.skippedIds.push(id);
        continue;
      }
      if (!knownIds.has(id)) {
        result.skipped += 1;
        result.skippedIds.push(id);
        continue;
      }
      if (typeof bindingText === 'string') {
        try {
          parseBinding(bindingText);
        } catch (error) {
          void (error as BindingParseError);
          result.skipped += 1;
          result.skippedIds.push(id);
          continue;
        }
      }
      this.store.setOverride(id, { binding: bindingText as string | null });
      result.applied += 1;
    }

    // 未知命令的绑定在 list() 里不会被触发，但为可读性仍记录一次
    for (const binding of this.list()) {
      if (!knownCommands.has(binding.commandId)) {
        result.skippedIds.push(`<unknown-command>:${binding.commandId}`);
      }
    }

    this.sync();
    return result;
  }

  /** 导出某绑定的人类可读文本（面板展示用）。 */
  format(bindingId: string): string | null {
    const binding = this.list().find((item) => item.id === bindingId);
    return binding ? formatBinding(binding) : null;
  }

  /** 把最新绑定推给路由。 */
  private sync(): void {
    this.router.setBindings(this.list());
    this.onChange?.();
  }

  /** 把注册入参物化为完整绑定。 */
  private materialize(registration: BindingRegistration | LegacyKeybindingRegistration): Binding {
    if (isCompleteBinding(registration)) return registration;
    if (isLegacyRegistration(registration)) {
      const { commandId, keybinding, id, when, weight, allowInInput } = registration;
      const draft = draftFromText(keybinding);
      const binding: Binding = {
        ...draft,
        id: id ?? this.store.nextId(commandId),
        commandId,
        origin: 'host',
        swallow: draft.swallow ?? true,
        mode: draft.mode ?? 'once',
      };
      if (when !== undefined) binding.when = when;
      if (weight !== undefined) binding.weight = weight;
      if (allowInInput !== undefined) binding.allowInInput = allowInInput;
      return binding;
    }
    const { commandId, id, ...draft } = registration;
    return {
      ...draft,
      id: id ?? this.store.nextId(commandId),
      commandId,
      origin: 'host',
      swallow: draft.swallow ?? true,
      mode: draft.mode ?? 'once',
    };
  }
}

/** 判断入参是否已是完整绑定。 */
function isCompleteBinding(input: BindingRegistration | LegacyKeybindingRegistration): input is Binding {
  return typeof (input as Binding).origin === 'string' && typeof (input as Binding).gesture === 'object';
}

/** 判断入参是否为旧式字符串键位。 */
function isLegacyRegistration(
  input: BindingRegistration | LegacyKeybindingRegistration,
): input is LegacyKeybindingRegistration {
  return typeof (input as LegacyKeybindingRegistration).keybinding === 'string';
}

export type { ShortcutOverrideMap };