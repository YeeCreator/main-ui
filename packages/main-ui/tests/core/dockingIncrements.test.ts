import { describe, expect, test } from 'vitest';
import {
  checkInstanceQuota,
  createFiveZoneLayout,
  findBindingsByInstance,
  findBindingsByViewType,
  listSlotBindings,
  mergeAuxiliaryModels,
  normalizeAuxiliaryModel,
  type WorkbenchDocument,
} from '../../src/core';

/**
 * 构造含两个组的文档：主布局一个组 + 浮动窗口一个组，各挂一个实例。
 * 用于验证绑定查询能同时覆盖主树与浮动子树。
 */
const makeDoc = (): WorkbenchDocument => ({
  version: 4,
  activeWorkspaceId: 'ws',
  workspaceStates: {
    ws: {
      workspaceId: 'ws',
      layout: {
        version: 1,
        rootNodeId: 'leaf-1',
        nodes: { 'leaf-1': { id: 'leaf-1', type: 'leaf', groupId: 'g-main' } },
        groups: {
          'g-main': { id: 'g-main', tabIds: ['t-1'], activeTabId: 't-1', lastActiveTabId: 't-1' },
        },
        activeGroupId: 'g-main',
        maximizedNodeId: null,
      },
      floatingWindows: {
        'fw-1': {
          id: 'fw-1',
          geometry: { x: 0, y: 0, width: 400, height: 300 },
          layout: {
            version: 1,
            rootNodeId: 'leaf-2',
            nodes: { 'leaf-2': { id: 'leaf-2', type: 'leaf', groupId: 'g-float' } },
            groups: {
              'g-float': { id: 'g-float', tabIds: ['t-2'], activeTabId: 't-2', lastActiveTabId: 't-2' },
            },
            activeGroupId: 'g-float',
            maximizedNodeId: null,
          },
        } as never,
      },
      editors: {
        'e-main': { id: 'e-main', kind: 'view-world', payload: {}, createdAt: '', updatedAt: '' },
        'e-float': { id: 'e-float', kind: 'view-world', payload: {}, createdAt: '', updatedAt: '' },
      },
      tabs: {
        't-1': { id: 't-1', editorInstanceId: 'e-main', title: 'A', closable: true },
        't-2': { id: 't-2', editorInstanceId: 'e-float', title: 'B', closable: true },
      },
      overlays: {},
      recentlyClosed: [],
      focusHistory: [],
      dirtyFromPreset: false,
      updatedAt: '',
      tabHistory: [],
      chrome: { sidebarVisible: true, sidebarWidth: 240, bottomPanelVisible: false, bottomPanelHeight: 220 },
    },
  },
  theme: { mode: 'system', resolvedMode: 'light', themeId: 'main-ui-system' },
  settings: { density: 'compact' },
  recentWorkspaces: ['ws'],
  recentEditors: [],
}) as WorkbenchDocument;

describe('listSlotBindings · 实例绑定查询', () => {
  test('主树与浮动子树都覆盖', () => {
    const bindings = listSlotBindings(makeDoc());
    expect(bindings).toHaveLength(2);
    expect(bindings.map((b) => b.floating).sort()).toEqual([false, true]);
  });

  test('文档为 null 返回空数组', () => {
    expect(listSlotBindings(null)).toEqual([]);
  });

  test('按 workspaceId 过滤', () => {
    expect(listSlotBindings(makeDoc(), 'nope')).toEqual([]);
    expect(listSlotBindings(makeDoc(), 'ws')).toHaveLength(2);
  });

  test('findBindingsByInstance 定位到唯一实例', () => {
    const found = findBindingsByInstance(makeDoc(), 'e-float');
    expect(found).toHaveLength(1);
    expect(found[0].groupId).toBe('g-float');
  });

  test('findBindingsByViewType 返回同类型全部实例', () => {
    expect(findBindingsByViewType(makeDoc(), 'view-world')).toHaveLength(2);
    expect(findBindingsByViewType(makeDoc(), 'view-tree')).toHaveLength(0);
  });
});

describe('checkInstanceQuota · 实例独占校验', () => {
  test('未打开时 ok', () => {
    expect(checkInstanceQuota(makeDoc(), 'view-tree').status).toBe('ok');
  });

  test('默认 limit=1，已达上限时 duplicated 并给出已有绑定', () => {
    const result = checkInstanceQuota(makeDoc(), 'view-world');
    expect(result.status).toBe('duplicated');
    if (result.status === 'duplicated') {
      expect(result.existing).toHaveLength(2);
    }
  });

  test('提高 limit 后可再开', () => {
    expect(checkInstanceQuota(makeDoc(), 'view-world', 3).status).toBe('ok');
  });
});

describe('normalizeAuxiliaryModel · 微件规范化', () => {
  test('丢弃缺 id / 缺 commandId 的条目', () => {
    const model = normalizeAuxiliaryModel({
      toolbar: [
        { id: '', commandId: 'a' },
        { id: 'b', commandId: '' },
        { id: 'ok', commandId: 'cmd' },
      ],
    });
    expect(model.toolbar).toHaveLength(1);
    expect(model.toolbar?.[0].id).toBe('ok');
  });

  test('id 重复时保留首次出现', () => {
    const model = normalizeAuxiliaryModel({
      toolbar: [
        { id: 'dup', commandId: 'first', label: 'A' },
        { id: 'dup', commandId: 'second', label: 'B' },
      ],
    });
    expect(model.toolbar).toHaveLength(1);
    expect(model.toolbar?.[0].commandId).toBe('first');
  });

  test('按 group 再按 order 排序', () => {
    const model = normalizeAuxiliaryModel({
      toolbar: [
        { id: 'c', commandId: 'x', group: 1, order: 1 },
        { id: 'b', commandId: 'x', group: 0, order: 2 },
        { id: 'a', commandId: 'x', group: 0, order: 1 },
      ],
    });
    expect(model.toolbar?.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  test('空模型与 null 返回空对象', () => {
    expect(normalizeAuxiliaryModel(null)).toEqual({});
    expect(normalizeAuxiliaryModel({ toolbar: [] })).toEqual({});
  });
});

describe('mergeAuxiliaryModels · 多视图微件合并', () => {
  test('id 冲突时后者加视图前缀，互不覆盖', () => {
    const merged = mergeAuxiliaryModels([
      { viewInstanceId: 'v1', model: { toolbar: [{ id: 'reset', commandId: 'r1' }] } },
      { viewInstanceId: 'v2', model: { toolbar: [{ id: 'reset', commandId: 'r2' }] } },
    ]);
    expect(merged.toolbar).toHaveLength(2);
    expect(merged.toolbar?.[0].id).toBe('reset');
    expect(merged.toolbar?.[1].id).toBe('v2:reset');
  });

  test('不同位置各自合并', () => {
    const merged = mergeAuxiliaryModels([
      { viewInstanceId: 'v1', model: { toolbar: [{ id: 'a', commandId: 'c' }], status: [{ id: 's', commandId: 'c' }] } },
    ]);
    expect(Object.keys(merged).sort()).toEqual(['status', 'toolbar']);
  });
});

describe('createFiveZoneLayout · 五区布局模板', () => {
  test('默认生成 5 个组，中心为 activeGroup', () => {
    const layout = createFiveZoneLayout();
    expect(Object.keys(layout.groups)).toHaveLength(5);
    expect(layout.activeGroupId).toBe('five-group-center');
  });

  test('根为水平分割，三个孩子', () => {
    const layout = createFiveZoneLayout();
    const root = layout.nodes[layout.rootNodeId];
    expect(root.type).toBe('split');
    if (root.type === 'split') {
      expect(root.orientation).toBe('horizontal');
      expect(root.children).toHaveLength(3);
    }
  });

  test('weights 归一化到和为 1', () => {
    const layout = createFiveZoneLayout({ weights: { top: 2, center: 6, bottom: 2 } });
    const split = Object.values(layout.nodes).find((node) => node.type === 'split' && node.id === 'five-split-main');
    expect(split?.type).toBe('split');
    if (split?.type === 'split') {
      const sum = split.weights.reduce((acc, value) => acc + value, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  test('withSides=false 只生成三个组', () => {
    const layout = createFiveZoneLayout({ withSides: false });
    expect(Object.keys(layout.groups)).toHaveLength(3);
    expect(layout.activeGroupId).toBe('five-group-center');
  });

  test('每个组初始无页签，可作为默认布局直接装配', () => {
    const layout = createFiveZoneLayout();
    for (const group of Object.values(layout.groups)) {
      expect(group.tabIds).toEqual([]);
      expect(group.activeTabId).toBeNull();
    }
  });

  test('prefix 隔离多份模板的 id', () => {
    const a = createFiveZoneLayout({ prefix: 'a' });
    const b = createFiveZoneLayout({ prefix: 'b' });
    expect(a.activeGroupId).toBe('a-group-center');
    expect(b.activeGroupId).toBe('b-group-center');
  });
});
