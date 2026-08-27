import { describe, expect, test } from 'vitest';
import {
  clampFloatingGeometry,
  createMainUiCoreRuntime,
  createSingleGroupLayout,
  defaultEditorCapability,
  defaultTabPresentation,
  floatingWindowDefaults,
  migrateWorkbenchDocument,
  type EditorDescriptor,
  type MainUiViewLifecycle,
  type WorkspaceDescriptor,
} from '../../src/core';

const welcomeEditor: EditorDescriptor = {
  kind: 'welcome',
  title: 'Welcome',
  rendererKey: 'welcome-editor',
  capability: defaultEditorCapability,
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: ['demo'] },
};

const canvasEditor: EditorDescriptor = {
  kind: 'canvas',
  title: 'Canvas',
  rendererKey: 'canvas-editor',
  capability: { ...defaultEditorCapability, allowFloatingWindow: true },
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: ['demo'] },
};

const workspace: WorkspaceDescriptor = {
  id: 'demo',
  title: 'Demo',
  allowedEditorKinds: ['welcome', 'canvas'],
  recommendedEditorKinds: ['welcome', 'canvas'],
  defaultOpenRequests: [{ editorKind: 'welcome' }, { editorKind: 'canvas' }],
  createDefaultLayout: () => createSingleGroupLayout({ groupId: 'root-group', leafNodeId: 'root-leaf' }),
  allowUserReset: true,
};

const createRuntime = async () => {
  const runtime = createMainUiCoreRuntime({
    createId: (() => {
      let id = 0;
      return (prefix: string) => `${prefix}-${++id}`;
    })(),
    now: () => '2026-08-27T00:00:00.000Z',
  });
  runtime.registerEditor(welcomeEditor);
  runtime.registerEditor(canvasEditor);
  runtime.registerWorkspace(workspace);
  await runtime.boot();
  return runtime;
};

const findTabByKind = (runtime: Awaited<ReturnType<typeof createRuntime>>, kind: string): string => {
  const ws = runtime.getSnapshot().workspaceStates.demo;
  const tabId = Object.values(ws.tabs).find((tab) => ws.editors[tab.editorInstanceId]?.kind === kind)?.id;
  expect(tabId).toBeTruthy();
  return tabId ?? '';
};

const popoutCanvas = async (runtime: Awaited<ReturnType<typeof createRuntime>>) => {
  const tabId = findTabByKind(runtime, 'canvas');
  const result = await runtime.dispatch({ type: 'floatingWindow/popout', groupId: 'root-group', tabIds: [tabId] });
  expect(result.ok).toBe(true);
  const windows = runtime.getSnapshot().workspaceStates.demo.floatingWindows ?? {};
  const floatingWindow = Object.values(windows)[0];
  expect(floatingWindow).toBeDefined();
  return { tabId, floatingWindow };
};

describe('floating window reducer', () => {
  test('popout is rejected when editor capability disallows floating window', async () => {
    const runtime = await createRuntime();
    const welcomeTabId = findTabByKind(runtime, 'welcome');
    const result = await runtime.dispatch({ type: 'floatingWindow/popout', groupId: 'root-group', tabIds: [welcomeTabId] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('floatingWindow.notAllowed');
    expect(Object.keys(runtime.getSnapshot().workspaceStates.demo.floatingWindows ?? {})).toHaveLength(0);
  });

  test('popout moves the tab reference into a floating window without recreating the editor instance', async () => {
    const runtime = await createRuntime();
    const tabId = findTabByKind(runtime, 'canvas');
    const editorInstanceIdBefore = runtime.getSnapshot().workspaceStates.demo.tabs[tabId].editorInstanceId;

    const { floatingWindow } = await popoutCanvas(runtime);
    const ws = runtime.getSnapshot().workspaceStates.demo;
    const floatingGroup = Object.values(floatingWindow.layout.groups)[0];
    expect(floatingGroup.tabIds).toContain(tabId);
    // 只搬引用：页签与编辑实例身份不变
    expect(ws.tabs[tabId].editorInstanceId).toBe(editorInstanceIdBefore);
    expect(ws.layout.groups['root-group'].tabIds).not.toContain(tabId);
    expect(floatingWindow.size).toEqual({ width: floatingWindowDefaults.width, height: floatingWindowDefaults.height });
  });

  test('popout without tabIds uses the source group active tab', async () => {
    const runtime = await createRuntime();
    const canvasTabId = findTabByKind(runtime, 'canvas');
    // 后开的 canvas 是默认活动页签
    expect(runtime.getSnapshot().workspaceStates.demo.layout.groups['root-group'].activeTabId).toBe(canvasTabId);
    const result = await runtime.dispatch({ type: 'floatingWindow/popout', groupId: 'root-group' });
    expect(result.ok).toBe(true);
    const floatingWindow = Object.values(runtime.getSnapshot().workspaceStates.demo.floatingWindows ?? {})[0];
    expect(Object.values(floatingWindow.layout.groups)[0].activeTabId).toBe(canvasTabId);
  });

  test('dockBack pushes tabs back to the target group and restores the active tab', async () => {
    const runtime = await createRuntime();
    const { tabId, floatingWindow } = await popoutCanvas(runtime);

    const dock = await runtime.dispatch({ type: 'floatingWindow/dockBack', windowId: floatingWindow.id, targetGroupId: 'root-group' });
    expect(dock.ok).toBe(true);
    const ws = runtime.getSnapshot().workspaceStates.demo;
    expect(Object.keys(ws.floatingWindows ?? {})).toHaveLength(0);
    expect(ws.layout.groups['root-group'].tabIds).toContain(tabId);
    expect(ws.layout.groups['root-group'].activeTabId).toBe(tabId);
  });

  test('updateGeometry patches position and clamps size to minimums', async () => {
    const runtime = await createRuntime();
    const { floatingWindow } = await popoutCanvas(runtime);

    const result = await runtime.dispatch({
      type: 'floatingWindow/updateGeometry',
      windowId: floatingWindow.id,
      position: { x: 10, y: 20 },
      size: { width: 50, height: 50 },
    });
    expect(result.ok).toBe(true);
    const updated = (runtime.getSnapshot().workspaceStates.demo.floatingWindows ?? {})[floatingWindow.id];
    expect(updated.position).toEqual({ x: 10, y: 20 });
    expect(updated.size).toEqual({ width: floatingWindowDefaults.minWidth, height: floatingWindowDefaults.minHeight });
  });

  test('closing a floating window recycles its tabs into recentlyClosed', async () => {
    const runtime = await createRuntime();
    const { tabId, floatingWindow } = await popoutCanvas(runtime);
    const editorInstanceId = runtime.getSnapshot().workspaceStates.demo.tabs[tabId].editorInstanceId;

    const close = await runtime.dispatch({ type: 'floatingWindow/close', windowId: floatingWindow.id });
    expect(close.ok).toBe(true);
    const ws = runtime.getSnapshot().workspaceStates.demo;
    expect(Object.keys(ws.floatingWindows ?? {})).toHaveLength(0);
    expect(ws.tabs[tabId]).toBeUndefined();
    expect(ws.editors[editorInstanceId]).toBeUndefined();
    expect(ws.recentlyClosed).toHaveLength(1);
  });

  test('moving the last tab back via moveTabToGroup prunes the empty floating window', async () => {
    const runtime = await createRuntime();
    const { tabId, floatingWindow } = await popoutCanvas(runtime);
    const floatingGroupId = Object.keys(floatingWindow.layout.groups)[0];

    const move = await runtime.dispatch({ type: 'editor/moveTabToGroup', fromGroupId: floatingGroupId, toGroupId: 'root-group', tabId });
    expect(move.ok).toBe(true);
    expect(Object.keys(runtime.getSnapshot().workspaceStates.demo.floatingWindows ?? {})).toHaveLength(0);
    expect(runtime.getSnapshot().workspaceStates.demo.layout.groups['root-group'].tabIds).toContain(tabId);
  });
});

describe('clampFloatingGeometry', () => {
  const viewport = { width: 1280, height: 800 };

  test('clamps out-of-viewport coordinates back while keeping the title bar visible', () => {
    const result = clampFloatingGeometry({ position: { x: 2400, y: 1600 }, size: { width: 640, height: 420 } }, viewport);
    expect(result.changed).toBe(true);
    expect(result.position).toEqual({ x: 1280 - 32, y: 800 - 32 });
  });

  test('clamps far-negative x to keep part of the window reachable', () => {
    const result = clampFloatingGeometry({ position: { x: -1200, y: 0 }, size: { width: 640, height: 420 } }, viewport);
    expect(result.changed).toBe(true);
    expect(result.position.x).toBe(-(640 - 32));
  });

  test('clamps oversized windows to the viewport', () => {
    const result = clampFloatingGeometry({ position: { x: 64, y: 64 }, size: { width: 3000, height: 2000 } }, viewport);
    expect(result.changed).toBe(true);
    expect(result.size).toEqual({ width: 1280, height: 800 });
  });

  test('reports no change for a healthy geometry', () => {
    const result = clampFloatingGeometry({ position: { x: 64, y: 64 }, size: { width: 640, height: 420 } }, viewport);
    expect(result.changed).toBe(false);
  });
});

describe('floating window migration', () => {
  test('migrating a v2 document yields version 3 with an empty floatingWindows slot', () => {
    const migrated = migrateWorkbenchDocument({
      version: 2,
      activeWorkspaceId: 'demo',
      workspaceStates: {
        demo: { workspaceId: 'demo', layout: createSingleGroupLayout({ groupId: 'g', leafNodeId: 'l' }) },
      },
    });
    expect(migrated).not.toBeNull();
    expect(migrated?.version).toBe(3);
    expect(migrated?.workspaceStates.demo.floatingWindows).toEqual({});
  });
});

describe('view lifecycle wiring', () => {
  const createLifecycle = (state: Record<string, unknown>): MainUiViewLifecycle & { restored: Record<string, unknown> | null; destroyed: number } => ({
    viewType: 'canvas-editor',
    restored: null,
    destroyed: 0,
    getViewState: () => ({ ...state }),
    restoreViewState(next: Record<string, unknown>) { this.restored = next; },
    onDestroy() { this.destroyed += 1; },
  });

  test('saving captures view state into the editor instance slot', async () => {
    const runtime = await createRuntime();
    const tabId = findTabByKind(runtime, 'canvas');
    const editorInstanceId = runtime.getSnapshot().workspaceStates.demo.tabs[tabId].editorInstanceId;
    runtime.attachViewLifecycle(editorInstanceId, createLifecycle({ camera: { x: 1, y: 2, zoom: 3 } }));

    // 任意 dispatch 触发保存
    const { floatingWindow } = await popoutCanvas(runtime);
    const editor = runtime.getSnapshot().workspaceStates.demo.editors[editorInstanceId];
    expect(editor.viewState).toEqual({ camera: { x: 1, y: 2, zoom: 3 } });

    // 关闭实例时句柄被销毁（幂等销毁验证）
    await runtime.dispatch({ type: 'floatingWindow/close', windowId: floatingWindow.id });
    expect(runtime.viewLifecycles.get(editorInstanceId)).toBeUndefined();
  });

  test('boot collects snapshot view state and replays on attach', async () => {
    const runtime = await createRuntime();
    const tabId = findTabByKind(runtime, 'canvas');
    const editorInstanceId = runtime.getSnapshot().workspaceStates.demo.tabs[tabId].editorInstanceId;
    runtime.attachViewLifecycle(editorInstanceId, createLifecycle({ camera: { zoom: 5 } }));
    await runtime.dispatch({ type: 'layout/setChromeState', workspaceId: 'demo', patch: { sidebarWidth: 280 } });
    const saved = runtime.getSnapshot().workspaceStates.demo.editors[editorInstanceId].viewState;
    expect(saved).toEqual({ camera: { zoom: 5 } });

    // 模拟重启：新 runtime 从同一快照启动（无持久化适配器，直接注入文档）
    const revived = createMainUiCoreRuntime({
      createId: (() => {
        let id = 100;
        return (prefix: string) => `${prefix}-${++id}`;
      })(),
      now: () => '2026-08-27T00:00:00.000Z',
      persistence: {
        load: async () => runtime.getSnapshot(),
        save: async () => undefined,
      },
    });
    revived.registerEditor(welcomeEditor);
    revived.registerEditor(canvasEditor);
    revived.registerWorkspace(workspace);
    await revived.boot();

    const revivedTabId = Object.values(revived.getSnapshot().workspaceStates.demo.tabs).find((tab) => revived.getSnapshot().workspaceStates.demo.editors[tab.editorInstanceId]?.kind === 'canvas')?.id;
    expect(revivedTabId).toBeTruthy();
    const revivedInstanceId = revived.getSnapshot().workspaceStates.demo.tabs[revivedTabId ?? ''].editorInstanceId;
    const lifecycle = createLifecycle({});
    revived.attachViewLifecycle(revivedInstanceId, lifecycle);
    expect(lifecycle.restored).toEqual({ camera: { zoom: 5 } });
  });
});
