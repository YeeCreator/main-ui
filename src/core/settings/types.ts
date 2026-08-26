import type { JsonValue } from '../types';

export type SettingType = 'string' | 'number' | 'boolean' | 'enum' | 'color';
export type SettingScope = 'user' | 'workspace' | 'profile';

export type SettingSchema = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  type: SettingType;
  defaultValue: JsonValue;
  scope?: SettingScope | SettingScope[];
  enumValues?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  validate?: (value: JsonValue) => string | undefined;
};

export type SettingsSnapshot = {
  version: number;
  user: Record<string, JsonValue>;
  workspace: Record<string, Record<string, JsonValue>>;
  profile: Record<string, Record<string, JsonValue>>;
};

export type SettingsPersistenceAdapter = {
  load: () => Promise<SettingsSnapshot | null>;
  save: (snapshot: SettingsSnapshot) => Promise<void>;
  clear?: () => Promise<void>;
};

export type SettingsMigration = (snapshot: SettingsSnapshot) => SettingsSnapshot;

export type SettingChange = {
  id: string;
  value: JsonValue;
  scope: SettingScope;
  workspaceId?: string;
  profileId?: string;
};
