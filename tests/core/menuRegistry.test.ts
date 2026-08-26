import {describe, expect, test} from 'vitest';
import {MenuRegistry, type CommandRunContext} from '../../src/core';

const context: CommandRunContext = {workspaceId: 'demo', activeGroupId: null};

describe('menu registry', () => {
  test('treats a flat menubar command item as a directly executable entry', () => {
    const registry = new MenuRegistry();
    registry.register({id: 'menu.file.save', location: 'menubar', label: '保存', commandId: 'file.save', order: 10});
    const items = registry.build('menubar', context, (commandId) => commandId === 'file.save');
    expect(items).toHaveLength(1);
    expect(items[0].commandId).toBe('file.save');
    expect(items[0].children).toBeUndefined();
    expect(items[0].enabled).toBe(true);
  });

  test('reflects command enablement on flat menubar items', () => {
    const registry = new MenuRegistry();
    registry.register({id: 'menu.file.save', location: 'menubar', label: '保存', commandId: 'file.save'});
    const disabled = registry.build('menubar', context, () => false);
    expect(disabled).toHaveLength(1);
    expect(disabled[0].enabled).toBe(false);
  });

  test('returns no items when no menubar contributions exist', () => {
    const registry = new MenuRegistry();
    registry.register({id: 'menu.file.save', location: 'context', label: '保存', commandId: 'file.save'});
    expect(registry.build('menubar', context, () => true)).toHaveLength(0);
  });
});
