import { describe, expect, test } from 'vitest';
import { ContributionRegistry } from '../../src/core';

describe('contribution registry', () => {
  test('filters by location/context and preserves ordering', () => {
    const registry = new ContributionRegistry();
    registry.registerView({ id: 'explorer', title: 'Explorer', order: 2 });
    registry.registerView({ id: 'inspector', title: 'Inspector', order: 1, when: 'showInspector' });
    registry.registerPanel({ id: 'output', title: 'Output' });
    expect(registry.listViews({ workspaceId: 'demo' }).map((item) => item.id)).toEqual(['explorer']);
    expect(registry.listViews({ workspaceId: 'demo', keys: { showInspector: true } }).map((item) => item.id)).toEqual(['inspector', 'explorer']);
    expect(registry.listPanels()).toHaveLength(1);
  });
});
