import type { JsonValue } from '../types';
import { fail, ok, type Result } from '../types';
import type { SettingChange, SettingSchema, SettingScope, SettingsMigration, SettingsPersistenceAdapter, SettingsSnapshot } from './types';

const clone = <T>(value: T): T => structuredClone(value);

export class SettingsStore {
  private readonly schemas = new Map<string, SettingSchema>();
  private snapshot: SettingsSnapshot = { version: 1, user: {}, workspace: {}, profile: {} };
  private readonly migrations = new Map<number, SettingsMigration>();
  private readonly persistence?: SettingsPersistenceAdapter;
  private readonly listeners = new Set<(change: SettingChange) => void>();

  constructor(options: { persistence?: SettingsPersistenceAdapter; migrations?: Record<number, SettingsMigration> } = {}) {
    this.persistence = options.persistence;
    for (const [version, migration] of Object.entries(options.migrations ?? {})) this.migrations.set(Number(version), migration);
  }

  registerSchema(schema: SettingSchema): void { this.schemas.set(schema.id, { ...schema }); }
  unregisterSchema(id: string): void { this.schemas.delete(id); }
  getSchema(id: string): SettingSchema | undefined { return this.schemas.get(id); }
  listSchemas(): SettingSchema[] { return [...this.schemas.values()].sort((a, b) => (a.category ?? '').localeCompare(b.category ?? '') || a.title.localeCompare(b.title)); }
  search(query: string, category?: string): SettingSchema[] {
    const needle = query.trim().toLowerCase();
    return this.listSchemas().filter((schema) => (!category || schema.category === category) && (!needle || `${schema.id} ${schema.title} ${schema.description ?? ''} ${schema.category ?? ''}`.toLowerCase().includes(needle)));
  }

  async load(): Promise<SettingsSnapshot> {
    const loaded = await this.persistence?.load();
    if (loaded) {
      this.snapshot = this.migrate(loaded);
    }
    return this.snapshotSnapshot();
  }

  async save(): Promise<void> { await this.persistence?.save(this.snapshotSnapshot()); }
  async clear(): Promise<void> { await this.persistence?.clear?.(); this.snapshot = { version: 1, user: {}, workspace: {}, profile: {} }; }

  get(id: string, context: { workspaceId?: string; profileId?: string } = {}): JsonValue {
    const schema = this.schemas.get(id);
    const scopes = this.allowedScopes(schema);
    if (scopes.includes('profile') && context.profileId && id in (this.snapshot.profile[context.profileId] ?? {})) return this.snapshot.profile[context.profileId][id];
    if (scopes.includes('workspace') && context.workspaceId && id in (this.snapshot.workspace[context.workspaceId] ?? {})) return this.snapshot.workspace[context.workspaceId][id];
    if (id in this.snapshot.user) return this.snapshot.user[id];
    return schema?.defaultValue ?? null;
  }

  set(change: SettingChange): Result<void> {
    const schema = this.schemas.get(change.id);
    if (!schema) return fail('settings.schemaNotFound', `Setting ${change.id} is not registered.`);
    const allowed = this.allowedScopes(schema);
    if (!allowed.includes(change.scope)) return fail('settings.scopeNotAllowed', `Setting ${change.id} does not allow ${change.scope} scope.`);
    if (change.scope !== 'user' && ((change.scope === 'workspace' && !change.workspaceId) || (change.scope === 'profile' && !change.profileId))) return fail('settings.contextRequired', `${change.scope} settings require an id.`);
    const validation = this.validate(schema, change.value);
    if (validation) return fail('settings.invalidValue', validation);
    if (change.scope === 'user') this.snapshot.user[change.id] = clone(change.value);
    if (change.scope === 'workspace' && change.workspaceId) (this.snapshot.workspace[change.workspaceId] ??= {})[change.id] = clone(change.value);
    if (change.scope === 'profile' && change.profileId) (this.snapshot.profile[change.profileId] ??= {})[change.id] = clone(change.value);
    for (const listener of this.listeners) listener({ ...change, value: clone(change.value) });
    return ok(undefined);
  }

  reset(id: string, context: { scope: SettingScope; workspaceId?: string; profileId?: string }): Result<void> {
    const schema = this.schemas.get(id); if (!schema) return fail('settings.schemaNotFound', `Setting ${id} is not registered.`);
    const target = context.scope === 'user' ? this.snapshot.user : context.scope === 'workspace' ? this.snapshot.workspace[context.workspaceId ?? ''] : this.snapshot.profile[context.profileId ?? ''];
    if (target) delete target[id];
    return ok(undefined);
  }

  validate(schema: SettingSchema, value: JsonValue): string | undefined {
    if (schema.type === 'string' || schema.type === 'color') { if (typeof value !== 'string') return `${schema.title} must be a string.`; }
    if (schema.type === 'number') { if (typeof value !== 'number' || Number.isNaN(value)) return `${schema.title} must be a number.`; if (schema.min !== undefined && value < schema.min) return `${schema.title} must be at least ${schema.min}.`; if (schema.max !== undefined && value > schema.max) return `${schema.title} must be at most ${schema.max}.`; }
    if (schema.type === 'boolean' && typeof value !== 'boolean') return `${schema.title} must be boolean.`;
    if (schema.type === 'enum' && (!schema.enumValues?.some((option) => option.value === value))) return `${schema.title} has an invalid option.`;
    return schema.validate?.(value);
  }

  subscribe(listener: (change: SettingChange) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  snapshotSnapshot(): SettingsSnapshot { return clone(this.snapshot); }
  private allowedScopes(schema?: SettingSchema): SettingScope[] { const scopes = schema?.scope ?? 'user'; return Array.isArray(scopes) ? scopes : [scopes]; }
  private migrate(snapshot: SettingsSnapshot): SettingsSnapshot { let next = clone(snapshot); while (next.version < 1) { const migration = this.migrations.get(next.version); if (!migration) break; next = migration(next); } return { version: 1, user: next.user ?? {}, workspace: next.workspace ?? {}, profile: next.profile ?? {} }; }
}

export const createMemorySettingsPersistenceAdapter = (initial: SettingsSnapshot | null = null): SettingsPersistenceAdapter => { let stored = initial; return { async load() { return stored ? clone(stored) : null; }, async save(snapshot) { stored = clone(snapshot); }, async clear() { stored = null; } }; };
