import { describe, expect, test, vi } from 'vitest';
import {
  createMainUiCoreRuntime,
  createSingleGroupLayout,
  defaultEditorCapability,
  defaultTabPresentation,
  parseKeybinding,
  type EditorDescriptor,
  type WorkspaceDescriptor,
} from '../../src/core';

const editor: EditorDescriptor = {
  kind: 'welcome', title: 'Welcome', rendererKey: 'welcome', capability: defaultEditorCapability,
  presentation: defaultTabPresentation, availability: { allowedWorkspaceIds: ['demo'] },
};
const workspace: WorkspaceDescriptor = {
  id: 'demo', title: 'Demo', allowedEditorKinds: ['welcome'], recommendedEditorKinds: ['welcome'],
  defaultOpenRequests: [], createDefaultLayout: () => createSingleGroupLayout(), allowUserReset: true,
};

describe('command execution and keybindings', () => {
  test('keeps legacy descriptors and evaluates when clauses', async () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerEditor(editor); runtime.registerWorkspace(workspace);
    await runtime.boot();
    const run = vi.fn();
    runtime.registerCommand({ id: 'demo.run', title: 'Run', when: 'featureEnabled', run });
    expect((await runtime.executeCommand('demo.run')).ok).toBe(false);
    const result = await runtime.executeCommand('demo.run', undefined, { keys: { featureEnabled: true } });
    expect(result.ok).toBe(true); expect(run).toHaveBeenCalledTimes(1);
    expect(runtime.listRecentlyUsedCommands()).toHaveLength(1);
  });

  test('normalizes platform shortcuts and reports conflicts', () => {
    expect(parseKeybinding('Ctrl+Shift+P').canonical).toBe('ctrl+shift+P');
    const runtime = createMainUiCoreRuntime();
    runtime.registerKeybinding({ commandId: 'one', keybinding: 'Ctrl+K', weight: 1 });
    runtime.registerKeybinding({ commandId: 'two', keybinding: 'Ctrl+K', weight: 0 });
    expect(runtime.keybindings.conflicts()).toHaveLength(1);
    expect(runtime.keybindings.getForKeybinding('Ctrl+K')[0].commandId).toBe('one');
  });
});
