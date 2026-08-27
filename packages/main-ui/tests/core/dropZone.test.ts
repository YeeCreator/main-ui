import { describe, expect, test } from 'vitest';
import {
  createMainUiCoreRuntime,
  createSingleGroupLayout,
  defaultEditorCapability,
  defaultTabPresentation,
  dropZoneToSplitDirection,
  resolveDropZone,
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
  allowedEditorKinds: ['welcome', 'canvas'],
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
    now: () => '2026-08-27T00:00:00.000Z',
  });
  runtime.registerEditor(editor);
  runtime.registerWorkspace(workspace);
  await runtime.boot();
  return runtime;
};

const rect = { x: 100, y: 100, width: 400, height: 300 };

describe('drop zone resolution', () => {
  test('resolves the five zones from pointer position', () => {
    expect(resolveDropZone(rect, { x: 300, y: 120 })).toBe('top'); // 顶部边带内
    expect(resolveDropZone(rect, { x: 300, y: 380 })).toBe('bottom'); // 底部边带内
    expect(resolveDropZone(rect, { x: 130, y: 250 })).toBe('left'); // 左侧边带内
    expect(resolveDropZone(rect, { x: 470, y: 250 })).toBe('right'); // 右侧边带内
    expect(resolveDropZone(rect, { x: 300, y: 250 })).toBe('center'); // 中央堆叠
  });

  test('corners resolve to the horizontal band first', () => {
    expect(resolveDropZone(rect, { x: 105, y: 105 })).toBe('top');
    expect(resolveDropZone(rect, { x: 495, y: 395 })).toBe('bottom');
  });

  test('edge ratio widens or narrows the bands', () => {
    const point = { x: 300, y: 150 };
    expect(resolveDropZone(rect, point, 0.1)).toBe('center'); // 10% 边带不含该点
    expect(resolveDropZone(rect, point, 0.3)).toBe('top'); // 30% 边带命中
  });

  test('maps edge zones to split directions and center to null', () => {
    expect(dropZoneToSplitDirection('top')).toBe('up');
    expect(dropZoneToSplitDirection('bottom')).toBe('down');
    expect(dropZoneToSplitDirection('left')).toBe('left');
    expect(dropZoneToSplitDirection('right')).toBe('right');
    expect(dropZoneToSplitDirection('center')).toBeNull();
  });
});

describe('moveTabToNewSplit docking drop', () => {
  test('edge drop splits the target leaf and moves the tab', async () => {
    const runtime = await createRuntime();
    // 先开第二个 editor 实例，保证有两个可拖页签
    await runtime.dispatch({ type: 'editor/open', request: { editorKind: 'welcome' } });
    const before = runtime.getSnapshot();
    const sourceTabId = before.workspaceStates.demo.layout.groups['root-group'].tabIds[0];
    // 先分割出右侧空组，作为「拖到另一个组边缘」的目标
    await runtime.dispatch({ type: 'layout/splitLeaf', leafNodeId: 'root-leaf', direction: 'right' });
    const layout = runtime.getSnapshot().workspaceStates.demo.layout;
    const targetLeaf = Object.values(layout.nodes).find((node) => node.type === 'leaf' && node.groupId !== 'root-group');
    expect(targetLeaf).toBeTruthy();

    const result = await runtime.dispatch({
      type: 'editor/moveTabToNewSplit',
      fromGroupId: 'root-group',
      targetLeafNodeId: targetLeaf!.id,
      tabId: sourceTabId,
      direction: 'down',
    });
    expect(result.ok).toBe(true);
    const after = runtime.getSnapshot().workspaceStates.demo;
    expect(after.layout.groups['root-group'].tabIds).not.toContain(sourceTabId);
    // 新建分割组持有被拖页签
    const newGroup = Object.values(after.layout.groups).find((group) => group.tabIds.includes(sourceTabId));
    expect(newGroup).toBeTruthy();
    expect(Object.values(after.layout.nodes).filter((node) => node.type === 'leaf')).toHaveLength(3);
  });

  test('edge drop inside a floating window splits its layout subtree', async () => {
    const runtime = await createRuntime();
    // 再注册一个允许浮动的 editor 用于 popout（默认能力不开浮动窗口）
    runtime.registerEditor({
      kind: 'canvas',
      title: 'Canvas',
      rendererKey: 'canvas-editor',
      capability: { ...defaultEditorCapability, allowFloatingWindow: true },
      presentation: defaultTabPresentation,
      availability: { allowedWorkspaceIds: ['demo'] },
    });
    await runtime.dispatch({ type: 'editor/open', request: { editorKind: 'canvas' } });
    const canvasTabId = runtime.getSnapshot().workspaceStates.demo.layout.groups['root-group'].activeTabId;
    await runtime.dispatch({ type: 'floatingWindow/popout', groupId: 'root-group', tabIds: [canvasTabId ?? ''] });
    const popped = runtime.getSnapshot().workspaceStates.demo;
    const windowId = Object.keys(popped.floatingWindows ?? {})[0];
    expect(windowId).toBeTruthy();
    // 主树再开一个页签作为拖拽来源
    await runtime.dispatch({ type: 'editor/open', request: { editorKind: 'welcome' } });
    const mainGroup = runtime.getSnapshot().workspaceStates.demo.layout.groups['root-group'];
    const sourceTabId = mainGroup.tabIds.at(-1);
    expect(sourceTabId).toBeTruthy();

    const floatingLayout = runtime.getSnapshot().workspaceStates.demo.floatingWindows?.[windowId].layout;
    const floatingLeaf = Object.values(floatingLayout?.nodes ?? {}).find((node) => node.type === 'leaf');
    expect(floatingLeaf).toBeTruthy();

    const result = await runtime.dispatch({
      type: 'editor/moveTabToNewSplit',
      fromGroupId: 'root-group',
      targetLeafNodeId: floatingLeaf!.id,
      tabId: sourceTabId ?? '',
      direction: 'right',
      floatingWindowId: windowId,
    });
    expect(result.ok).toBe(true);
    const after = runtime.getSnapshot().workspaceStates.demo;
    // 浮动窗口子树内新增叶子与组，且持有被拖页签
    const windowLayout = after.floatingWindows?.[windowId].layout;
    expect(Object.values(windowLayout?.nodes ?? {}).filter((node) => node.type === 'leaf')).toHaveLength(2);
    const holder = Object.values(windowLayout?.groups ?? {}).find((group) => group.tabIds.includes(sourceTabId ?? ''));
    expect(holder).toBeTruthy();
    // 主布局树不受影响
    expect(Object.values(after.layout.nodes).filter((node) => node.type === 'leaf')).toHaveLength(1);
  });

  test('center drop between groups stacks the tab without splitting', async () => {
    const runtime = await createRuntime();
    await runtime.dispatch({ type: 'editor/open', request: { editorKind: 'welcome' } });
    await runtime.dispatch({ type: 'layout/splitLeaf', leafNodeId: 'root-leaf', direction: 'right' });
    const before = runtime.getSnapshot().workspaceStates.demo;
    const sourceTabId = before.layout.groups['root-group'].tabIds.at(-1);
    const targetGroupId = Object.keys(before.layout.groups).find((id) => id !== 'root-group');
    expect(sourceTabId && targetGroupId).toBeTruthy();

    const result = await runtime.dispatch({
      type: 'editor/moveTabToGroup',
      fromGroupId: 'root-group',
      toGroupId: targetGroupId ?? '',
      tabId: sourceTabId ?? '',
    });
    expect(result.ok).toBe(true);
    const after = runtime.getSnapshot().workspaceStates.demo;
    expect(after.layout.groups[targetGroupId ?? ''].tabIds).toContain(sourceTabId);
    expect(Object.values(after.layout.nodes).filter((node) => node.type === 'leaf')).toHaveLength(2); // 无新增分割
  });
});
