import type { WorkbenchAction } from './actions';
import type { CommandDescriptor, CommandInvocation, CommandRunContext, CommandExecutionResult } from './command/types';
import { evaluateWhen } from '@main-ui/core/input';
import { detectEnvironment } from '@main-ui/core/environment';
import {
  createInputRouter,
  draftFromText,
  type Binding,
  type BindingDraft,
  type InputRouter,
  type InputScope,
  type InputSourceProvider,
  type InputTrigger,
} from '@main-ui/core/input';
import { InputController } from './input/controller';
import { ShortcutStore } from './input/shortcut-store';
import { loadShortcutOverrides, saveShortcutOverrides } from './input/persistence';
import { MenuRegistry } from './menu/registry';
import type { MenuContribution } from './menu/types';
import { SettingsStore } from './settings/store';
import type { SettingsPersistenceAdapter, SettingsMigration, SettingSchema } from './settings/types';
import { ContributionRegistry } from './contribution/registry';
import type { ActivityContribution, PanelContribution, StatusContribution, ViewContribution } from './contribution/types';
import type { EditorDescriptor } from './editor/types';
import { SlotRegistry } from './editor/slot';
import { ViewLifecycleRegistry } from './editor/lifecycle';
import type { MainUiViewLifecycle } from './editor/lifecycle';
import { createWorkbenchDocument } from './documentFactory';
import type { PersistenceAdapter } from './persistence/types';
import { CommandRegistry, EditorRegistry, WorkspaceRegistry } from './registry';
import { workbenchReducer } from './reducer';
import type { EditorInstanceId, IdFactory, Result } from './types';
import { fail, ok } from './types';
import type { WorkbenchDocument, WorkspaceDescriptor } from './workspace/types';
import { migrateWorkbenchDocument } from './persistence/migrations';

export type CoreRuntimeOptions = {
  persistence?: PersistenceAdapter;
  activeWorkspaceId?: string;
  createId?: IdFactory;
  now?: () => string;
  settingsPersistence?: SettingsPersistenceAdapter;
  settingsMigrations?: Record<number, SettingsMigration>;
};

export type RuntimeListener = (document: WorkbenchDocument) => void;

let defaultIdCounter = 0;

const createDefaultId: IdFactory = (prefix) => {
  defaultIdCounter += 1;
  return `${prefix}-${defaultIdCounter}`;
};

const defaultNow = () => new Date().toISOString();

export class MainUiCoreRuntime {
  readonly editors = new EditorRegistry();
  readonly slots = new SlotRegistry();
  /** 视图状态收集槽：持久化保存布局时可经此收集活跃表面的视图状态（完整串联在 v0.3）。 */
  readonly viewLifecycles = new ViewLifecycleRegistry();
  readonly workspaces = new WorkspaceRegistry();
  readonly commands = new CommandRegistry();
  /** 输入路由（信号 → 手势 → 绑定）；命令桥由 {@link input} 暴露。 */
  readonly inputRouter: InputRouter;
  /** 绑定库：默认 + 宿主 + 用户覆盖三层合并。 */
  readonly shortcuts: ShortcutStore;
  /** 命令桥：把输入命中转成 `executeCommand` 调用。 */
  readonly input: InputController;
  readonly menus = new MenuRegistry();
  readonly settings: SettingsStore;
  readonly contributions = new ContributionRegistry();

  private document: WorkbenchDocument | null = null;
  /** 快照中带回的视图状态待回放队列：实例表面挂载后按需回放。 */
  private readonly pendingViewStates = new Map<EditorInstanceId, Record<string, unknown>>();
  private readonly listeners = new Set<RuntimeListener>();
  private readonly persistence?: PersistenceAdapter;
  private readonly activeWorkspaceId?: string;
  private readonly createId: IdFactory;
  private readonly now: () => string;
  private readonly recentCommands: CommandInvocation[] = [];
  private focusScope = 'workbench';

  constructor(options: CoreRuntimeOptions = {}) {
    this.persistence = options.persistence;
    this.activeWorkspaceId = options.activeWorkspaceId;
    this.createId = options.createId ?? createDefaultId;
    this.now = options.now ?? defaultNow;
    this.shortcuts = new ShortcutStore();
    this.inputRouter = createInputRouter({
      evaluateWhen: (binding) => {
        // 用内部字段直读而非 getSnapshot()：后者在 boot 前会因未注册
        // workspace 而抛错，而绑定匹配随时可能发生在 boot 之前。
        const activeWorkspaceId = this.document?.activeWorkspaceId ?? '';
        const workspaceState = this.document?.workspaceStates[activeWorkspaceId];
        const overlayActive = workspaceState ? Object.keys(workspaceState.overlays).length > 0 : false;
        return evaluateWhen(binding.when, {
          keys: {
            workspaceId: activeWorkspaceId,
            activeGroupId: workspaceState?.layout?.activeGroupId ?? null,
            focusScope: this.focusScope,
            inputEmpty: this.inputRouter ? this.inputRouter.session().pressedKeys.size === 0 : true,
            overlayActive,
            platform: detectEnvironment().platform,
          },
        });
      },
      onTrigger: (trigger, binding) => {
        void this.executeCommand(binding.commandId, undefined, { trigger });
      },
    });
    this.input = new InputController(this.inputRouter, this.shortcuts, () => this.commands.list());
    // 任何绑定变更都走同一出口：重推路由 + 落盘。
    // 放在这里而不是各调用点，是为了避免「面板改了但忘了保存」这类遗漏。
    this.input.setChangeHandler(() => {
      this.syncInputBindings();
      void this.persistShortcuts();
    });
    this.settings = new SettingsStore({ persistence: options.settingsPersistence, migrations: options.settingsMigrations });
  }

  registerEditor(descriptor: EditorDescriptor): void {
    this.editors.register(descriptor);
    // Slot 叠加层：editor 注册时同步登记类型化插槽（viewType 取 editor kind）。
    this.slots.register({
      viewType: descriptor.kind,
      editorKind: descriptor.kind,
      title: descriptor.title,
      constraints: descriptor.capability,
    });
  }

  /** 纯视图插槽登记（模板库/插件消费），与 editor 注册互不替换。 */
  registerSlot(descriptor: Parameters<SlotRegistry['register']>[0]): void {
    this.slots.register(descriptor);
  }

  registerWorkspace(descriptor: WorkspaceDescriptor): void {
    this.workspaces.register(descriptor);
  }

  registerCommand(descriptor: CommandDescriptor): void {
    this.commands.register(descriptor);
  }

  /** 注册宿主绑定（写入 `host` 层，同 id 覆盖默认）。 */
  registerKeybinding(
    input:
      | Binding
      | (BindingDraft & { commandId: string; id?: string })
      | { commandId: string; keybinding: string; when?: string; weight?: number; allowInInput?: boolean },
  ): void {
    this.input.register(input);
  }

  registerMenu(contribution: MenuContribution): void {
    this.menus.register(contribution);
  }

  registerSettingSchema(schema: SettingSchema): void { this.settings.registerSchema(schema); }

  registerViewContribution(view: ViewContribution): void { this.contributions.registerView(view); }
  registerPanelContribution(panel: PanelContribution): void { this.contributions.registerPanel(panel); }
  registerActivityContribution(item: ActivityContribution): void { this.contributions.registerActivity(item); }
  registerStatusContribution(item: StatusContribution): void { this.contributions.registerStatus(item); }

  /**
   * 挂载视图生命周期句柄（渲染层表面挂载时调用）；
   * 若快照中带有该实例的待回放视图状态，挂载后立即回放。
   */
  attachViewLifecycle(editorInstanceId: EditorInstanceId, lifecycle: MainUiViewLifecycle): void {
    this.viewLifecycles.attach(editorInstanceId, lifecycle);
    const pending = this.pendingViewStates.get(editorInstanceId);
    if (pending) {
      this.pendingViewStates.delete(editorInstanceId);
      lifecycle.restoreViewState(pending);
    }
  }

  unregisterMenu(id: string): void {
    this.menus.unregister(id);
  }

  unregisterKeybinding(idOrCommandId: string): void {
    this.input.unregister(idOrCommandId);
  }

  setFocusScope(scope: string): void {
    this.focusScope = scope || 'workbench';
  }

  getFocusScope(): string {
    return this.focusScope;
  }

  listRecentlyUsedCommands(): CommandInvocation[] {
    return this.recentCommands.map((entry) => ({ ...entry, context: { ...entry.context }, result: { ...entry.result } }));
  }

  isCommandEnabled(commandId: string, payload?: CommandRunContext['payload']): boolean {
    const descriptor = this.commands.get(commandId);
    if (!descriptor) return false;
    const context = this.createCommandContext(payload);
    return evaluateWhen(descriptor.when, context) && (descriptor.enablement ? descriptor.enablement(context) : true);
  }

  async executeCommand(commandId: string, payload?: CommandRunContext['payload'], overrides: Partial<CommandRunContext> = {}): Promise<Result<CommandExecutionResult>> {
    const descriptor = this.commands.get(commandId);
    if (!descriptor) return fail('command.notFound', `Command ${commandId} is not registered.`);
    const context = { ...this.createCommandContext(payload), ...overrides };
    if (!evaluateWhen(descriptor.when, context) || (descriptor.enablement && !descriptor.enablement(context))) {
      return fail('command.disabled', `Command ${commandId} is disabled in the current context.`);
    }
    const started = Date.now();
    try {
      const returned = await descriptor.run(context);
      const result: CommandExecutionResult = returned && typeof returned === 'object' && 'commandId' in returned
        ? returned as CommandExecutionResult
        : { commandId, executed: true, durationMs: Date.now() - started };
      const invocation = { commandId, context, result, invokedAt: this.now() };
      this.recentCommands.unshift(invocation);
      this.recentCommands.splice(30);
      return ok(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail('command.executionFailed', message);
    }
  }

  /**
   * 向输入系统喂入一个信号（由渲染层的事件源调用）。
   *
   * 保留此方法是给宿主在非 DOM 环境（测试、Electron 原生桥）直接注入信号的能力。
   *
   * @param signal 归一化输入信号。
   */
  feedInput(signal: Parameters<InputRouter['feed']>[0]): void {
    this.inputRouter.feed(signal);
  }

  async boot(): Promise<WorkbenchDocument> {
    await this.settings.load();
    // 快捷键覆盖也住在设置库里（命名空间 main-ui.shortcuts）：
    // 它是「用户设置」的一部分，独立存储会造出第二套设置中心。
    loadShortcutOverrides(this.settings, this.shortcuts);
    this.syncInputBindings();
    const loaded = await this.persistence?.load();
    const migrated = migrateWorkbenchDocument(loaded);
    if (migrated) {
      this.document = this.ensureRegisteredWorkspaces(migrated);
    } else {
      this.document = this.createFreshDocument();
    }
    this.collectPendingViewStates(this.document);
    this.emit();
    return this.document;
  }

  getSnapshot(): WorkbenchDocument {
    if (!this.document) {
      this.document = this.createFreshDocument();
    }
    return this.document;
  }

  subscribe(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  async dispatch(action: WorkbenchAction): Promise<Result<WorkbenchDocument>> {
    const current = this.getSnapshot();
    const result = workbenchReducer(current, action, {
      editors: new Map(this.editors.list().map((descriptor) => [descriptor.kind, descriptor])),
      workspaces: new Map(this.workspaces.list().map((descriptor) => [descriptor.id, descriptor])),
      createId: this.createId,
      now: this.now,
    });

    if (!result.ok) {
      return result;
    }

    const next = result.value;
    this.pruneDetachedViewLifecycles(current, next);
    this.captureViewStates(next);
    this.document = next;
    await this.persistence?.save(this.document);
    this.emit();
    return ok(this.document, result.warnings);
  }

  async resetPersistence(): Promise<void> {
    await this.persistence?.clear?.();
    this.viewLifecycles.clear();
    this.pendingViewStates.clear();
    this.document = this.createFreshDocument();
    this.emit();
  }

  /** 把当前三层合并结果重新推给路由（覆盖变更后必须调用）。 */
  syncInputBindings(): void {
    this.inputRouter.setBindings(
      this.shortcuts.resolve((text) => draftFromText(text, detectEnvironment().platform)),
    );
  }

  /** 持久化当前快捷键覆盖（面板保存后调用）。 */
  async persistShortcuts(): Promise<void> {
    await saveShortcutOverrides(this.settings, this.shortcuts);
  }

  /** 保存前收集全部活跃表面的视图状态，写入实例旁的 viewState 槽。 */
  private captureViewStates(document: WorkbenchDocument): void {
    const collected = this.viewLifecycles.collect();
    if (Object.keys(collected).length === 0) {
      return;
    }
    for (const workspace of Object.values(document.workspaceStates)) {
      for (const [editorId, viewState] of Object.entries(collected)) {
        const editor = workspace.editors[editorId];
        if (editor) {
          editor.viewState = viewState;
        }
      }
    }
  }

  /** 实例被移除（关闭页签等）时销毁对应句柄并丢弃待回放状态。 */
  private pruneDetachedViewLifecycles(previous: WorkbenchDocument, next: WorkbenchDocument): void {
    for (const [workspaceId, workspace] of Object.entries(previous.workspaceStates)) {
      const nextWorkspace = next.workspaceStates[workspaceId];
      for (const editorId of Object.keys(workspace.editors)) {
        if (!nextWorkspace?.editors[editorId]) {
          this.viewLifecycles.detach(editorId);
          this.pendingViewStates.delete(editorId);
        }
      }
    }
  }

  /** boot 后从快照收集各编辑实例的 viewState，进入待回放队列。 */
  private collectPendingViewStates(document: WorkbenchDocument): void {
    for (const workspace of Object.values(document.workspaceStates)) {
      for (const editor of Object.values(workspace.editors)) {
        if (editor.viewState) {
          this.pendingViewStates.set(editor.id, editor.viewState);
        }
      }
    }
  }

  private emit(): void {
    if (!this.document) {
      return;
    }

    for (const listener of this.listeners) {
      listener(this.document);
    }
  }

  private createFreshDocument(): WorkbenchDocument {
    const workspaceDescriptors = this.workspaces.list();
    if (workspaceDescriptors.length === 0) {
      throw new Error('MainUiCoreRuntime needs at least one registered workspace before boot.');
    }

    return createWorkbenchDocument(
      workspaceDescriptors,
      this.editors.list(),
      this.activeWorkspaceId,
      this.createId,
      this.now,
    );
  }

  private createCommandContext(payload?: CommandRunContext['payload']): CommandRunContext {
    const snapshot = this.getSnapshot();
    const workspace = snapshot.workspaceStates[snapshot.activeWorkspaceId];
    return {
      workspaceId: snapshot.activeWorkspaceId,
      activeGroupId: workspace?.layout.activeGroupId ?? null,
      payload,
      scope: this.focusScope,
    };
  }

  private ensureRegisteredWorkspaces(document: WorkbenchDocument): WorkbenchDocument {
    const next = structuredClone(document);
    const editorMap = new Map(this.editors.list().map((descriptor) => [descriptor.kind, descriptor]));
    for (const descriptor of this.workspaces.list()) {
      if (!next.workspaceStates[descriptor.id]) {
        next.workspaceStates[descriptor.id] = createWorkbenchDocument(
          [descriptor],
          this.editors.list(),
          descriptor.id,
          this.createId,
          this.now,
        ).workspaceStates[descriptor.id];
      }
    }

    if (!next.workspaceStates[next.activeWorkspaceId]) {
      const firstWorkspace = this.workspaces.list()[0];
      if (!firstWorkspace) {
        return document;
      }
      next.activeWorkspaceId = firstWorkspace.id;
      next.workspaceStates[firstWorkspace.id] ??= createWorkbenchDocument(
        [firstWorkspace],
        [...editorMap.values()],
        firstWorkspace.id,
        this.createId,
        this.now,
      ).workspaceStates[firstWorkspace.id];
    }

    return next;
  }

  assertReady(): Result<WorkbenchDocument> {
    try {
      return ok(this.getSnapshot());
    } catch (error) {
      return fail('runtime.notReady', error instanceof Error ? error.message : 'Runtime is not ready.');
    }
  }
}

export const createMainUiCoreRuntime = (options: CoreRuntimeOptions = {}) => new MainUiCoreRuntime(options);
