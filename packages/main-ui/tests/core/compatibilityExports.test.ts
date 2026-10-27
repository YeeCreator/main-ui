import { describe, expect, test } from 'vitest';
import * as core from '../../src/core';
import * as vue from '../../src/vue';

describe('0.1.0 compatibility exports', () => {
  test('exports legacy and new entry points', () => {
    expect(core.createMainUiCoreRuntime).toBeTypeOf('function');
    expect(core.migrateWorkbenchDocument).toBeTypeOf('function');
    // 输入系统入口（取代 0.7.0 及以前的 KeybindingRegistry）
    expect(core.InputController).toBeTypeOf('function');
    expect(core.ShortcutStore).toBeTypeOf('function');
    expect(vue.WorkbenchShell).toBeDefined();
    expect(vue.CommandPalette).toBeDefined();
    expect(vue.SettingsEditor).toBeDefined();
    expect(vue.ShortcutEditor).toBeDefined();
  });
});
