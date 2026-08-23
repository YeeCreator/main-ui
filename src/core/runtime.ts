import type { WorkbenchAction } from './actions';
import type { CommandDescriptor, CommandInvocation, CommandRunContext, CommandExecutionResult, KeybindingDescriptor } from './command/types';
import { evaluateWhen, KeybindingRegistry } from './command/keybindings';
import { MenuRegistry } from './menu/registry';
import type { MenuContribution } from './menu/types';
import { SettingsStore } from './settings/store';
import type { SettingsPersistenceAdapter, SettingsMigration, SettingSchema } from './settings/types';
import { ContributionRegistry } from './contribution/registry';
import type { ActivityContribution, PanelContribution, StatusContribution, ViewContribution } from './contribution/types';
import type { EditorDescriptor } from './editor/types';
import { createWorkbenchDocument } from './documentFactory';
import type { PersistenceAdapter } from './persistence/types';
import { CommandRegistry, EditorRegistry, WorkspaceRegistry } from './registry';
import { workbenchReducer } from './reducer';
import type { IdFactory, Result } from './types';
import { fail, ok } from './types';
import type { WorkbenchDocument, WorkspaceDescriptor } from './workspace/types';

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
  readonly workspaces = new WorkspaceRegistry();
  readonly commands = new CommandRegistry();
  readonly keybindings: KeybindingRegistry;
  readonly menus = new MenuRegistry();
  readonly settings: SettingsStore;
  readonly contributions = new ContributionRegistry();

  private document: WorkbenchDocument | null = null;
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
    this.keybindings = new KeybindingRegistry();
    this.settings = new SettingsStore({ persistence: options.settingsPersistence, migrations: options.settingsMigrations });
  }

  registerEditor(descriptor: EditorDescriptor): void {
    this.editors.register(descriptor);
  }

  registerWorkspace(descriptor: WorkspaceDescriptor): void {
    this.workspaces.register(descriptor);
  }

  registerCommand(descriptor: CommandDescriptor): void {
    this.commands.register(descriptor);
  }

  registerKeybinding(descriptor: KeybindingDescriptor): void {
    this.keybindings.register(descriptor);
  }

  registerMenu(contribution: MenuContribution): void {
    this.menus.register(contribution);
  }

  registerSettingSchema(schema: SettingSchema): void { this.settings.registerSchema(schema); }

  registerViewContribution(view: ViewContribution): void { this.contributions.registerView(view); }
  registerPanelContribution(panel: PanelContribution): void { this.contributions.registerPanel(panel); }
  registerActivityContribution(item: ActivityContribution): void { this.contributions.registerActivity(item); }
  registerStatusContribution(item: StatusContribution): void { this.contributions.registerStatus(item); }

  unregisterMenu(id: string): void {
    this.menus.unregister(id);
  }

  unregisterKeybinding(commandId: string, keybinding?: string): void {
    this.keybindings.unregister(commandId, keybinding);
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

  async handleKeydown(event: KeyboardEvent): Promise<Result<CommandExecutionResult> | null> {
    const context = this.createCommandContext(undefined);
    const binding = this.keybindings.resolve(event, context);
    if (!binding) return null;
    event.preventDefault();
    return this.executeCommand(binding.commandId, undefined, context);
  }

  async boot(): Promise<WorkbenchDocument> {
    await this.settings.load();
    const loaded = await this.persistence?.load();
    if (loaded && loaded.version === 1) {
      this.document = this.ensureRegisteredWorkspaces(loaded);
    } else {
      this.document = this.createFreshDocument();
    }
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

    this.document = result.value;
    await this.persistence?.save(this.document);
    this.emit();
    return ok(this.document, result.warnings);
  }

  async resetPersistence(): Promise<void> {
    await this.persistence?.clear?.();
    this.document = this.createFreshDocument();
    this.emit();
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
