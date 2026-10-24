import { describe, expect, test } from 'vitest';
import type { ViewContribution } from '../../src/core';
import { activeViewOf, resolveActiveViewId, resolveControlledViewId, resolveSidebarActiveViewId } from '../../src/core';

const view = (id: string, extra: Partial<ViewContribution> = {}): ViewContribution => ({
  id,
  title: id,
  ...extra,
});

/**
 * 侧栏激活项收敛。
 *
 * 这类逻辑最容易出的 bug 是「切 workspace 后激活 id 不在新列表里，`find` 返回 undefined，
 * 非空断言让它继续往下渲染而崩溃」。以下用例把该场景钉死。
 */
describe('resolveActiveViewId', () => {
  test('空列表返回 null（不渲染侧栏）', () => {
    expect(resolveActiveViewId([], 'anything')).toBeNull();
  });

  test('激活项仍在列表内时保留用户选择', () => {
    const views = [view('a'), view('b', { defaultVisible: true })];
    expect(resolveActiveViewId(views, 'a')).toBe('a');
  });

  test('激活项不在列表内时退回 defaultVisible（切 workspace 场景）', () => {
    const views = [view('x'), view('y', { defaultVisible: true }), view('z')];
    expect(resolveActiveViewId(views, 'stale-id-from-other-workspace')).toBe('y');
  });

  test('无 defaultVisible 时退回首个', () => {
    const views = [view('x'), view('y')];
    expect(resolveActiveViewId(views, null)).toBe('x');
  });

  test('多个 defaultVisible 时取排序后的第一个', () => {
    const registryOrder = [view('first', { defaultVisible: true }), view('second', { defaultVisible: true })];
    expect(resolveActiveViewId(registryOrder, null)).toBe('first');
  });
});

describe('activeViewOf', () => {
  test('返回对象而非 id，供直接交给 ContributionSurface', () => {
    const views = [view('a', { title: 'A 面板' }), view('b')];
    expect(activeViewOf(views, 'a')?.title).toBe('A 面板');
  });

  test('列表为空时返回 undefined（调用方跳过渲染）', () => {
    expect(activeViewOf([], 'a')).toBeUndefined();
  });
});

/** 受控模式：宿主按视角预设面板时必须能覆盖用户上次点击。 */
describe('resolveControlledViewId', () => {
  test('受控值在列表内时优先于用户选择', () => {
    const views = [view('a'), view('b')];
    expect(resolveControlledViewId(views, 'b', 'a')).toBe('b');
  });

  test('受控值不在列表内时退回用户选择（切视角后旧预设失效）', () => {
    const views = [view('a'), view('c')];
    expect(resolveControlledViewId(views, 'b', 'c')).toBe('c');
  });

  test('受控值为 null 时完全让位给既有规则', () => {
    const views = [view('a'), view('b', { defaultVisible: true })];
    expect(resolveControlledViewId(views, null, 'a')).toBe('a');
    expect(resolveControlledViewId(views, null, null)).toBe('b');
  });
});

/**
 * 宿主建议 vs 用户点击的分权。
 *
 * 旧实现让受控值永久优先，表现为「rail 点了没反应」——切到某视角后
 * 无论点哪个 rail 按钮都跳回视角默认面板。以下用例把该行为钉死。
 */
describe('resolveSidebarActiveViewId', () => {
  test('用户在当前视角内点过 → 听用户的（不被建议值压制）', () => {
    const views = [view('inspector'), view('structure')];
    expect(resolveSidebarActiveViewId(views, { userActive: 'inspector', suggestedId: 'structure' })).toBe('inspector');
  });

  test('用户尚未点过 → 用宿主的建议', () => {
    const views = [view('inspector'), view('structure')];
    expect(resolveSidebarActiveViewId(views, { userActive: null, suggestedId: 'structure' })).toBe('structure');
  });

  test('建议值不在当前视角 → 退回 defaultVisible', () => {
    const views = [view('inspector'), view('symbols', { defaultVisible: true })];
    expect(resolveSidebarActiveViewId(views, { suggestedId: 'structure' })).toBe('symbols');
  });

  test('用户选择与建议都失效 → 首个', () => {
    const views = [view('a'), view('b')];
    expect(resolveSidebarActiveViewId(views, { userActive: 'gone', suggestedId: 'also-gone' })).toBe('a');
  });
});
