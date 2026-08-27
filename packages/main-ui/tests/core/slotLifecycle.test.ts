import { describe, expect, test } from 'vitest';
import {
  SlotRegistry,
  ViewLifecycleRegistry,
  createMainUiCoreRuntime,
  defaultEditorCapability,
  defaultTabPresentation,
  slotCan,
} from '../../src/core';
import type { EditorDescriptor, MainUiViewLifecycle, SlotDescriptor } from '../../src/core';

const createSlot = (overrides: Partial<SlotDescriptor> = {}): SlotDescriptor => ({
  viewType: 'demo-view',
  constraints: { ...defaultEditorCapability },
  ...overrides,
});

describe('slot registry', () => {
  test('resolve 返回显式 registered/missing 结果，永不抛错', () => {
    const registry = new SlotRegistry();
    registry.register(createSlot());
    const registered = registry.resolve('demo-view');
    expect(registered.status).toBe('registered');
    if (registered.status === 'registered') {
      expect(registered.descriptor.viewType).toBe('demo-view');
    }
    const missing = registry.resolve('ghost-view');
    expect(missing).toEqual({ status: 'missing', viewType: 'ghost-view' });
  });

  test('unregister 后降级为 missing（快照降级占位的触发条件）', () => {
    const registry = new SlotRegistry();
    registry.register(createSlot());
    registry.unregister('demo-view');
    expect(registry.resolve('demo-view').status).toBe('missing');
  });

  test('slotCan 与能力标记一一对应', () => {
    const slot = createSlot({ constraints: { ...defaultEditorCapability, allowFloatingWindow: false, allowClose: true } });
    expect(slotCan(slot, 'floatingWindow')).toBe(false);
    expect(slotCan(slot, 'close')).toBe(true);
    expect(slotCan(slot, 'splitDrop')).toBe(defaultEditorCapability.allowSplitDrop);
  });

  test('can 对缺失插槽一律返回 false', () => {
    const registry = new SlotRegistry();
    expect(registry.can('ghost-view', 'close')).toBe(false);
    registry.register(createSlot());
    expect(registry.can('demo-view', 'close')).toBe(true);
  });

  test('editor 注册时同步登记类型化插槽（叠加层）', () => {
    const runtime = createMainUiCoreRuntime();
    const descriptor: EditorDescriptor = {
      kind: 'demo-editor',
      title: 'Demo',
      rendererKey: 'demo-editor',
      capability: defaultEditorCapability,
      presentation: defaultTabPresentation,
      availability: { allowedWorkspaceIds: [] },
    };
    runtime.registerEditor(descriptor);
    const lookup = runtime.slots.resolve('demo-editor');
    expect(lookup.status).toBe('registered');
    if (lookup.status === 'registered') {
      expect(lookup.descriptor.editorKind).toBe('demo-editor');
      expect(lookup.descriptor.constraints).toBe(descriptor.capability);
    }
  });
});

describe('view lifecycle registry', () => {
  const createLifecycle = (viewType = 'demo-view'): { lifecycle: MainUiViewLifecycle; destroyed: () => number } => {
    let destroyed = 0;
    let state: Record<string, unknown> = { initial: true };
    return {
      lifecycle: {
        viewType,
        getViewState: () => ({ ...state }),
        restoreViewState: (next) => { state = { ...next }; },
        onDestroy: () => { destroyed += 1; },
      },
      destroyed: () => destroyed,
    };
  };

  test('collect 收集已登记实例的视图状态', () => {
    const registry = new ViewLifecycleRegistry();
    const { lifecycle } = createLifecycle();
    registry.attach('editor-1', lifecycle);
    const collected = registry.collect();
    expect(collected['editor-1']).toEqual({ initial: true });
    expect(registry.collect(['editor-unknown'])).toEqual({});
  });

  test('restore 回放快照状态，未登记实例静默跳过', () => {
    const registry = new ViewLifecycleRegistry();
    const { lifecycle } = createLifecycle();
    registry.attach('editor-1', lifecycle);
    registry.restore('editor-1', { zoom: 2 });
    expect(lifecycle.getViewState()).toEqual({ zoom: 2 });
    expect(() => registry.restore('editor-unknown', { zoom: 3 })).not.toThrow();
  });

  test('detach 销毁句柄且幂等；重复 attach 会先销毁旧句柄', () => {
    const registry = new ViewLifecycleRegistry();
    const first = createLifecycle();
    const second = createLifecycle();
    registry.attach('editor-1', first.lifecycle);
    registry.attach('editor-1', second.lifecycle);
    expect(first.destroyed()).toBe(1);
    registry.detach('editor-1');
    registry.detach('editor-1');
    expect(second.destroyed()).toBe(1);
    expect(registry.get('editor-1')).toBeUndefined();
  });

  test('clear 销毁全部句柄', () => {
    const registry = new ViewLifecycleRegistry();
    const a = createLifecycle();
    const b = createLifecycle();
    registry.attach('editor-1', a.lifecycle);
    registry.attach('editor-2', b.lifecycle);
    registry.clear();
    expect(a.destroyed()).toBe(1);
    expect(b.destroyed()).toBe(1);
    expect(registry.collect()).toEqual({});
  });
});
