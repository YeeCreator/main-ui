import { describe, expect, test } from 'vitest';
import {
  createMainUiCoreRuntime,
  createSingleGroupLayout,
  createThreePaneLayout,
  defaultEditorCapability,
  defaultTabPresentation,
  type EditorDescriptor,
  type WorkspaceDescriptor,
} from '../../src/core';

const editor: EditorDescriptor = {
  kind: 'welcome',
  title: 'Welcome',
  rendererKey: 'welcome-editor',
  capability: defaultEditorCapability,
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: ['demo'] },
};

const workspace: WorkspaceDescriptor = {
  id: 'demo',
  title: 'Demo',
  allowedEditorKinds: ['welcome'],
  recommendedEditorKinds: ['welcome'],
  defaultOpenRequests: [{ editorKind: 'welcome' }],
  createDefaultLayout: () => createSingleGroupLayout({ groupId: 'root-group', leafNodeId: 'root-leaf' }),
  allowUserReset: true,
};

const createRuntime = async () => {
  const runtime = createMainUiCoreRuntime({
    createId: (() => {
      let id = 0;
      return (prefix: string) => `${prefix}-${++id}`;
    })(),
    now: () => '2026-04-30T00:00:00.000Z',
  });
  runtime.registerEditor(editor);
  runtime.registerWorkspace(workspace);
  await runtime.boot();
  return runtime;
};

describe('main-ui core reducer', () => {
  test('splits a leaf and creates a new empty group', async () => {
    const runtime = await createRuntime();
    const result = await runtime.dispatch({ type: 'layout/splitLeaf', leafNodeId: 'root-leaf', direction: 'right' });

    expect(result.ok).toBe(true);
    const snapshot = runtime.getSnapshot();
    const activeWorkspace = snapshot.workspaceStates.demo;
    expect(Object.values(activeWorkspace.layout.nodes).filter((node) => node.type === 'leaf')).toHaveLength(2);
    expect(Object.keys(activeWorkspace.layout.groups)).toHaveLength(2);
    expect(activeWorkspace.layout.rootNodeId).not.toBe('root-leaf');
    expect(Object.values(activeWorkspace.layout.groups).find((group) => group.id !== 'root-group')?.tabIds ?? []).toHaveLength(0);
  });

  test('closes and reopens a tab', async () => {
    const runtime = await createRuntime();
    const snapshot = runtime.getSnapshot();
    const group = snapshot.workspaceStates.demo.layout.groups['root-group'];
    const tabId = group.activeTabId;
    expect(tabId).toBeTruthy();

    const closeResult = await runtime.dispatch({ type: 'editor/closeTab', groupId: 'root-group', tabId: tabId ?? '' });
    expect(closeResult.ok).toBe(true);
    expect(runtime.getSnapshot().workspaceStates.demo.layout.groups['root-group']).toBeDefined();
    expect(runtime.getSnapshot().workspaceStates.demo.layout.groups['root-group'].tabIds).toHaveLength(0);
    expect(runtime.getSnapshot().workspaceStates.demo.layout.groups['root-group'].activeTabId).toBeNull();
    expect(runtime.getSnapshot().workspaceStates.demo.recentlyClosed).toHaveLength(1);

    const reopenResult = await runtime.dispatch({ type: 'editor/reopenRecentlyClosed', targetGroupId: 'root-group' });
    expect(reopenResult.ok).toBe(true);
    expect(runtime.getSnapshot().workspaceStates.demo.layout.groups['root-group'].tabIds).toHaveLength(1);
  });

  test('resets workspace to descriptor layout', async () => {
    const runtime = await createRuntime();
    await runtime.dispatch({ type: 'layout/splitLeaf', leafNodeId: 'root-leaf', direction: 'down' });
    expect(Object.keys(runtime.getSnapshot().workspaceStates.demo.layout.groups)).toHaveLength(2);

    const reset = await runtime.dispatch({ type: 'layout/resetWorkspace', workspaceId: 'demo' });
    expect(reset.ok).toBe(true);
    expect(Object.keys(runtime.getSnapshot().workspaceStates.demo.layout.groups)).toHaveLength(1);
  });

  test('can express a three-pane host profile layout', () => {
    const layout = createThreePaneLayout('profile');
    expect(Object.values(layout.nodes).filter((node) => node.type === 'leaf')).toHaveLength(3);
    expect(layout.activeGroupId).toBe('profile-group-center');
  });

  test('closing a leaf does not leave orphan tabs', async () => {
    const runtime = await createRuntime();
    await runtime.dispatch({ type: 'layout/splitLeaf', leafNodeId: 'root-leaf', direction: 'right' });
    const snapshot = runtime.getSnapshot();
    const sourceTabId = snapshot.workspaceStates.demo.layout.groups['root-group'].activeTabId;
    expect(sourceTabId).toBeTruthy();
    const result = await runtime.dispatch({ type: 'layout/closeLeaf', leafNodeId: 'root-leaf' });
    expect(result.ok).toBe(true);
    expect(sourceTabId ? runtime.getSnapshot().workspaceStates.demo.tabs[sourceTabId] : undefined).toBeUndefined();
  });
});
