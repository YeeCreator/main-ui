/**
 * 快捷键覆盖的持久化契约测试（设计验收 ⑯）。
 *
 * 核心判据：**重建 runtime + 适配器后，用户覆盖仍然生效** ——
 * 只验证「内存里改了」是无效的，必须跨实例。
 */
import { describe, expect, test } from 'vitest';
import { createMainUiCoreRuntime, createSingleGroupLayout } from '../../src/core';
import type { SettingsPersistenceAdapter, SettingsSnapshot, WorkspaceDescriptor } from '../../src/core';
import { draftFromText } from '@main-ui/core/input';

/** 最小 workspace：boot 前置条件。 */
const workspace: WorkspaceDescriptor = {
  id: 'demo',
  title: 'Demo',
  allowedEditorKinds: [],
  recommendedEditorKinds: [],
  defaultOpenRequests: [],
  createDefaultLayout: () => createSingleGroupLayout(),
  allowUserReset: true,
};

/** 内存设置适配器（模拟 localStorage）。 */
const createMemoryAdapter = (): SettingsPersistenceAdapter & { snapshot: SettingsSnapshot | null } => {
  let stored: SettingsSnapshot | null = null;
  return {
    get snapshot() {
      return stored;
    },
    load: async () => stored,
    save: async (snapshot) => {
      stored = structuredClone(snapshot);
    },
    clear: async () => {
      stored = null;
    },
  };
};

describe('快捷键覆盖持久化', () => {
  test('重建运行时后用户覆盖仍生效', async () => {
    const adapter = createMemoryAdapter();

    const first = createMainUiCoreRuntime({ settingsPersistence: adapter });
    first.registerWorkspace(workspace);
    await first.boot();
    first.registerCommand({ id: 'demo.run', title: 'Run', run: () => undefined });
    const id = first.input.register({ commandId: 'demo.run', ...draftFromText('press:KeyF', 'mac') });
    first.input.setUserOverride(id, { binding: 'press:KeyJ' });
    await first.persistShortcuts();

    const second = createMainUiCoreRuntime({ settingsPersistence: adapter });
    second.registerWorkspace(workspace);
    await second.boot();
    second.registerCommand({ id: 'demo.run', title: 'Run', run: () => undefined });
    second.input.register({ commandId: 'demo.run', id, ...draftFromText('press:KeyF', 'mac') });

    const resolved = second.input.list().find((binding) => binding.id === id);
    expect(resolved?.gesture).toEqual({ kind: 'press', target: { code: 'KeyJ' } });
    expect(resolved?.origin).toBe('user');
  });

  test('null 覆盖跨实例生效（解绑状态被保留）', async () => {
    const adapter = createMemoryAdapter();

    const first = createMainUiCoreRuntime({ settingsPersistence: adapter });
    first.registerWorkspace(workspace);
    await first.boot();
    first.registerCommand({ id: 'demo.run', title: 'Run', run: () => undefined });
    const id = first.input.register({ commandId: 'demo.run', ...draftFromText('press:KeyF', 'mac') });
    first.input.setUserOverride(id, { binding: null });
    await first.persistShortcuts();

    const second = createMainUiCoreRuntime({ settingsPersistence: adapter });
    second.registerWorkspace(workspace);
    await second.boot();
    second.registerCommand({ id: 'demo.run', title: 'Run', run: () => undefined });
    second.input.register({ commandId: 'demo.run', id, ...draftFromText('press:KeyF', 'mac') });

    expect(second.input.list()).toHaveLength(0);
  });

  test('清除覆盖后持久化也清除', async () => {
    const adapter = createMemoryAdapter();

    const first = createMainUiCoreRuntime({ settingsPersistence: adapter });
    first.registerWorkspace(workspace);
    await first.boot();
    first.registerCommand({ id: 'demo.run', title: 'Run', run: () => undefined });
    const id = first.input.register({ commandId: 'demo.run', ...draftFromText('press:KeyF', 'mac') });
    first.input.setUserOverride(id, { binding: 'press:KeyJ' });
    first.input.resetUserOverride(id);
    await first.persistShortcuts();

    const second = createMainUiCoreRuntime({ settingsPersistence: adapter });
    second.registerWorkspace(workspace);
    await second.boot();
    second.registerCommand({ id: 'demo.run', title: 'Run', run: () => undefined });
    second.input.register({ commandId: 'demo.run', id, ...draftFromText('press:KeyF', 'mac') });

    expect(second.input.list()[0].gesture).toEqual({ kind: 'press', target: { code: 'KeyF' } });
  });

  test('损坏的持久化数据不阻止启动', async () => {
    const adapter = createMemoryAdapter();
    await adapter.save({
      version: 1,
      user: { 'main-ui.shortcuts': { version: 1, overrides: { 'weird:id': { binding: 42 } } } as never },
      workspace: {},
      profile: {},
    });

    const runtime = createMainUiCoreRuntime({ settingsPersistence: adapter });
    runtime.registerWorkspace(workspace);
    await expect(runtime.boot()).resolves.toBeDefined();
    // 非法项被丢弃，不产生覆盖
    expect(runtime.shortcuts.listOverrides()).toEqual({});
  });
});
