import { describe, expect, test } from 'vitest';
import { createSingleGroupLayout, migrateWorkbenchDocument } from '../../src/core';

describe('workbench persistence migration', () => {
  test('migrates v1 documents without losing tabs or layout', () => {
    const migrated = migrateWorkbenchDocument({ version: 1, activeWorkspaceId: 'demo', workspaceStates: { demo: { workspaceId: 'demo', layout: createSingleGroupLayout(), editors: {}, tabs: {}, overlays: {}, recentlyClosed: [], focusHistory: [], dirtyFromPreset: false, updatedAt: '2026-01-01T00:00:00.000Z' } }, theme: { mode: 'system', resolvedMode: 'light', themeId: 'main-ui-system' }, settings: { density: 'compact' } });
    expect(migrated?.version).toBe(3);
    expect(migrated?.workspaceStates.demo.chrome.sidebarWidth).toBe(240);
    expect(migrated?.workspaceStates.demo.floatingWindows).toEqual({});
    expect(migrated?.recentWorkspaces).toEqual(['demo']);
  });
});
