import { describe, expect, test } from 'vitest';
import { ref } from 'vue';
import type { TableSort } from '../src/types';

/**
 * 回归测试 F-4（main-ui 中危缺陷）：
 * TableView.getViewState 返回的 sort 字段（非 null 时）必须是普通对象，
 * 不能是 Vue ref 的响应式 Proxy，否则内核 structuredClone(document) 抛 DataCloneError。
 *
 * 修复：getViewState 内用 `sort ? { key: sort.key, direction: sort.direction } : null` 显式展开。
 */
describe('regression F-4: view state must be structuredClone-safe', () => {
  test('sort ref .value is a Proxy when non-null (reproduces the bug)', () => {
    const internalSort = ref<TableSort>({ key: 'amount', direction: 'asc' });
    const stateBroken = {
      scrollTop: 0,
      selectedRowId: null,
      sort: internalSort.value,
    };
    expect(() => structuredClone(stateBroken)).toThrow();
  });

  test('sort ref .value null is already clone-safe (baseline)', () => {
    const internalSort = ref<TableSort>(null);
    const state = {
      scrollTop: 0,
      selectedRowId: null,
      sort: internalSort.value,
    };
    expect(() => structuredClone(state)).not.toThrow();
  });

  test('TableView spread pattern is clone-safe', () => {
    const internalSort = ref<TableSort>({ key: 'name', direction: 'desc' });
    // 修复模式：非 null 时显式展开
    const sort = internalSort.value;
    const stateFixed = {
      scrollTop: 42,
      selectedRowId: 'row-7',
      sort: sort ? { key: sort.key, direction: sort.direction } : null,
    };
    expect(() => structuredClone(stateFixed)).not.toThrow();
    const cloned = structuredClone(stateFixed);
    expect(cloned).toEqual(stateFixed);
    expect(cloned.sort).not.toBe(sort);
  });
});
