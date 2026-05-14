import type { WorkbenchAction } from './actions';
import type { CommandDescriptor } from './command/types';
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

  private document: WorkbenchDocument | null = null;
  private readonly listeners = new Set<RuntimeListener>();
  private readonly persistence?: PersistenceAdapter;
  private readonly activeWorkspaceId?: string;
  private readonly createId: IdFactory;
  private readonly now: () => string;

  constructor(options: CoreRuntimeOptions = {}) {
    this.persistence = options.persistence;
    this.activeWorkspaceId = options.activeWorkspaceId;
    this.createId = options.createId ?? createDefaultId;
    this.now = options.now ?? defaultNow;
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

  async boot(): Promise<WorkbenchDocument> {
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
