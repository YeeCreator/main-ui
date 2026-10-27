import { describe, expect, test } from 'vitest';
import {
  FocusService,
  deriveFocus,
  type WorkbenchDocument,
} from '../../src/core';

/**
 * 构造最小可用文档：一个 workspace、一个组、一个页签、一个编辑实例。
 *
 * 刻意手写而非用 documentFactory —— 这组测试要验证的是「从布局派生焦点」，
 * 用工厂会引入无关变量，读测试的人还得先理解工厂。
 */
const makeDoc = (overrides: {
  activeGroupId?: string | null;
  activeTabId?: string | null;
  groupInFloating?: boolean;
} = {}): WorkbenchDocument => {
  const groupId = 'group-1';
  const tabId = 'tab-1';
  const layout = {
    version: 1 as const,
    rootNodeId: 'leaf-1',
    nodes: { 'leaf-1': { id: 'leaf-1', type: 'leaf' as const, groupId } },
    groups: {
      [groupId]: {
        id: groupId,
        tabIds: [tabId],
        activeTabId: overrides.activeTabId === undefined ? tabId : overrides.activeTabId,
        lastActiveTabId: tabId,
      },
    },
    activeGroupId: overrides.activeGroupId === undefined ? groupId : overrides.activeGroupId,
    maximizedNodeId: null,
  };

  return {
    version: 4,
    activeWorkspaceId: 'ws',
    workspaceStates: {
      ws: {
        workspaceId: 'ws',
        layout: overrides.groupInFloating
          ? { ...layout, groups: {}, rootNodeId: 'leaf-1', nodes: {} }
          : layout,
        floatingWindows: overrides.groupInFloating
          ? { 'fw-1': { id: 'fw-1', layout, geometry: { x: 0, y: 0, width: 400, height: 300 } } as never }
          : {},
        editors: {
          'editor-1': {
            id: 'editor-1', kind: 'view-world', payload: {},
            createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
        tabs: {
          [tabId]: { id: tabId, editorInstanceId: 'editor-1', title: 'World', closable: true },
        },
        overlays: {},
        recentlyClosed: [],
        focusHistory: [],
        dirtyFromPreset: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
        tabHistory: [],
        chrome: { sidebarVisible: true, sidebarWidth: 240, bottomPanelVisible: false, bottomPanelHeight: 220 },
      },
    },
    theme: { mode: 'system', resolvedMode: 'light', themeId: 'main-ui-system' },
    settings: { density: 'compact' },
    recentWorkspaces: ['ws'],
    recentEditors: [],
  } as WorkbenchDocument;
};

describe('deriveFocus · 从布局派生焦点', () => {
  test('正常情况解析出实例 / 类型 / 组 / 页签', () => {
    const focus = deriveFocus(makeDoc());
    expect(focus.viewInstanceId).toBe('editor-1');
    expect(focus.viewType).toBe('view-world');
    expect(focus.groupId).toBe('group-1');
    expect(focus.tabId).toBe('tab-1');
    expect(focus.workspaceId).toBe('ws');
  });

  test('文档为 null → 无焦点，不抛错', () => {
    expect(deriveFocus(null).viewInstanceId).toBeNull();
  });

  test('activeGroupId 为 null → 无焦点', () => {
    expect(deriveFocus(makeDoc({ activeGroupId: null })).viewInstanceId).toBeNull();
  });

  test('组内无激活页签 → groupId 保留，实例为空', () => {
    const doc = makeDoc({ activeTabId: null });
    // 必须同时清空 lastActiveTabId，否则会按设计回退到它
    doc.workspaceStates.ws.layout.groups['group-1'].lastActiveTabId = null;
    const focus = deriveFocus(doc);
    expect(focus.viewInstanceId).toBeNull();
    expect(focus.groupId).toBe('group-1');
  });

  test('活动组位于浮动窗口子树内也能解析', () => {
    const focus = deriveFocus(makeDoc({ groupInFloating: true }));
    expect(focus.viewInstanceId).toBe('editor-1');
  });

  test('fallback 到 lastActiveTabId（activeTabId 为空时）', () => {
    const doc = makeDoc({ activeTabId: null });
    const group = doc.workspaceStates.ws.layout.groups['group-1'];
    group.lastActiveTabId = 'tab-1';
    expect(deriveFocus(doc).viewInstanceId).toBe('editor-1');
  });
});

describe('FocusService · 变更广播', () => {
  test('首次同步触发一次广播', () => {
    const service = new FocusService();
    const events: string[] = [];
    service.subscribe((next) => events.push(String(next.viewInstanceId)));
    expect(service.syncFrom(makeDoc(), 'restore')).toBe(true);
    expect(events).toEqual(['editor-1']);
  });

  test('事实未变化时不重复广播（reason 不同也不广播）', () => {
    const service = new FocusService();
    let count = 0;
    service.subscribe(() => { count += 1; });
    service.syncFrom(makeDoc(), 'restore');
    service.syncFrom(makeDoc(), 'click');
    service.syncFrom(makeDoc(), 'programmatic');
    expect(count).toBe(1);
  });

  test('焦点转移时广播，并携带前一份快照', () => {
    const service = new FocusService();
    const pairs: Array<[string | null, string | null]> = [];
    service.subscribe((next, previous) => pairs.push([previous.viewInstanceId, next.viewInstanceId]));
    service.syncFrom(makeDoc(), 'restore');
    const noFocus = makeDoc({ activeGroupId: null });
    service.syncFrom(noFocus, 'close');
    expect(pairs).toEqual([
      [null, 'editor-1'],
      ['editor-1', null],
    ]);
  });

  test('leave 后 viewInstanceId 为 null 但保留 workspaceId', () => {
    const service = new FocusService();
    service.syncFrom(makeDoc(), 'restore');
    service.leave();
    expect(service.current().viewInstanceId).toBeNull();
    expect(service.current().workspaceId).toBe('ws');
    expect(service.current().reason).toBe('leave');
  });

  test('订阅时不立即回调（避免挂载即触发假变更）', () => {
    const service = new FocusService();
    service.syncFrom(makeDoc(), 'restore');
    let called = false;
    service.subscribe(() => { called = true; });
    expect(called).toBe(false);
  });

  test('取消订阅后不再收到事件', () => {
    const service = new FocusService();
    let count = 0;
    const off = service.subscribe(() => { count += 1; });
    off();
    service.syncFrom(makeDoc(), 'restore');
    expect(count).toBe(0);
  });
});
