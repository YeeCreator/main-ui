import { describe, expect, test } from 'vitest';
import { SettingsStore, createMemorySettingsPersistenceAdapter } from '../../src/core';

describe('settings schema store', () => {
  test('merges user/workspace/profile scopes and validates values', async () => {
    const store = new SettingsStore({ persistence: createMemorySettingsPersistenceAdapter() });
    store.registerSchema({ id: 'editor.fontSize', title: 'Font size', type: 'number', defaultValue: 14, scope: ['user', 'workspace', 'profile'], min: 8, max: 40 });
    expect(store.get('editor.fontSize')).toBe(14);
    expect(store.set({ id: 'editor.fontSize', value: 16, scope: 'user' }).ok).toBe(true);
    expect(store.set({ id: 'editor.fontSize', value: 18, scope: 'workspace', workspaceId: 'demo' }).ok).toBe(true);
    expect(store.get('editor.fontSize', { workspaceId: 'demo' })).toBe(18);
    expect(store.set({ id: 'editor.fontSize', value: 3, scope: 'user' }).ok).toBe(false);
    expect(store.search('font')).toHaveLength(1);
    await store.save();
  });

  test('loads a versioned snapshot and supports reset', async () => {
    const persistence = createMemorySettingsPersistenceAdapter({ version: 1, user: { 'ui.theme': 'dark' }, workspace: {}, profile: {} });
    const store = new SettingsStore({ persistence });
    store.registerSchema({ id: 'ui.theme', title: 'Theme', type: 'enum', defaultValue: 'light', enumValues: [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] });
    await store.load();
    expect(store.get('ui.theme')).toBe('dark');
    expect(store.reset('ui.theme', { scope: 'user' }).ok).toBe(true);
    expect(store.get('ui.theme')).toBe('light');
  });
});
