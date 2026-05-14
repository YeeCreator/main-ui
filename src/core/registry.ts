import type { CommandDescriptor } from './command/types';
import type { EditorDescriptor } from './editor/types';
import type { EditorKind } from './types';
import type { WorkspaceDescriptor } from './workspace/types';

export class EditorRegistry {
  private readonly descriptors = new Map<EditorKind, EditorDescriptor>();

  register(descriptor: EditorDescriptor): void {
    this.descriptors.set(descriptor.kind, descriptor);
  }

  get(kind: EditorKind): EditorDescriptor | undefined {
    return this.descriptors.get(kind);
  }

  list(): EditorDescriptor[] {
    return [...this.descriptors.values()];
  }

  clear(): void {
    this.descriptors.clear();
  }
}

export class WorkspaceRegistry {
  private readonly descriptors = new Map<string, WorkspaceDescriptor>();

  register(descriptor: WorkspaceDescriptor): void {
    this.descriptors.set(descriptor.id, descriptor);
  }

  get(workspaceId: string): WorkspaceDescriptor | undefined {
    return this.descriptors.get(workspaceId);
  }

  list(): WorkspaceDescriptor[] {
    return [...this.descriptors.values()];
  }

  clear(): void {
    this.descriptors.clear();
  }
}

export class CommandRegistry {
  private readonly descriptors = new Map<string, CommandDescriptor>();

  register(descriptor: CommandDescriptor): void {
    this.descriptors.set(descriptor.id, descriptor);
  }

  get(commandId: string): CommandDescriptor | undefined {
    return this.descriptors.get(commandId);
  }

  list(): CommandDescriptor[] {
    return [...this.descriptors.values()];
  }

  clear(): void {
    this.descriptors.clear();
  }
}
