/**
 * 命令执行与输入系统的行为契约测试。
 *
 * 旧的「字符串键位 + KeybindingRegistry」已退场，本文件覆盖：
 *
 * - 命令注册与 `when` 求值（既有能力，不可回归）；
 * - 输入系统注册 / 三层覆盖 / 冲突诊断（新能力）；
 * - 触发上下文注入（设计验收 ⑬）。
 */
import { describe, expect, test, vi } from 'vitest';
import {
  createMainUiCoreRuntime,
  createSingleGroupLayout,
  defaultEditorCapability,
  defaultTabPresentation,
  type EditorDescriptor,
  type WorkspaceDescriptor,
} from '../../src/core';
import { draftFromText, NO_MODIFIERS, type InputSignal } from '@main-ui/core/input';

const editor: EditorDescriptor = {
  kind: 'welcome', title: 'Welcome', rendererKey: 'welcome', capability: defaultEditorCapability,
  presentation: defaultTabPresentation, availability: { allowedWorkspaceIds: ['demo'] },
};
const workspace: WorkspaceDescriptor = {
  id: 'demo', title: 'Demo', allowedEditorKinds: ['welcome'], recommendedEditorKinds: ['welcome'],
  defaultOpenRequests: [], createDefaultLayout: () => createSingleGroupLayout(), allowUserReset: true,
};

/** 按键信号。 */
const keyDown = (code: string, t = 0): InputSignal => ({
  phase: 'down',
  source: 'keyboard',
  code,
  key: code,
  mods: NO_MODIFIERS,
  repeat: false,
  t,
});

describe('命令执行（既有能力）', () => {
  test('保留旧描述符并求值 when 子句', async () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerEditor(editor); runtime.registerWorkspace(workspace);
    await runtime.boot();
    const run = vi.fn();
    runtime.registerCommand({ id: 'demo.run', title: 'Run', when: 'featureEnabled', run });
    expect((await runtime.executeCommand('demo.run')).ok).toBe(false);
    const result = await runtime.executeCommand('demo.run', undefined, { keys: { featureEnabled: true } });
    expect(result.ok).toBe(true); expect(run).toHaveBeenCalledTimes(1);
    expect(runtime.listRecentlyUsedCommands()).toHaveLength(1);
  });
});

describe('输入系统注册', () => {
  test('注册草稿 + 命令 id 自动生成 bindingId', () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerCommand({ id: 'demo.open', title: 'Open', run: () => undefined });
    const id = runtime.input.register({ commandId: 'demo.open', ...draftFromText('cmd+press:KeyO', 'mac') });
    expect(id).toMatch(/^default:demo\.open:/);
    expect(runtime.input.list()).toHaveLength(1);
  });

  test('完整绑定可直接注册', () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerCommand({ id: 'demo.open', title: 'Open', run: () => undefined });
    runtime.input.register({
      id: 'host:demo.open:0',
      commandId: 'demo.open',
      origin: 'host',
      ...draftFromText('press:KeyF', 'mac'),
    });
    expect(runtime.input.list()[0].id).toBe('host:demo.open:0');
  });

  test('按命令 id 注销', () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerCommand({ id: 'demo.open', title: 'Open', run: () => undefined });
    runtime.input.register({ commandId: 'demo.open', ...draftFromText('press:KeyF', 'mac') });
    runtime.input.unregister('demo.open');
    expect(runtime.input.list()).toHaveLength(0);
  });

  test('注册即生效：喂信号可触发命令（设计验收 ⑬）', async () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerEditor(editor);
    runtime.registerWorkspace(workspace);
    await runtime.boot();
    const run = vi.fn();
    runtime.registerCommand({ id: 'demo.run', title: 'Run', run });
    runtime.input.register({ commandId: 'demo.run', ...draftFromText('press:KeyF', 'mac') });

    runtime.feedInput(keyDown('KeyF'));
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
  });

  test('触发上下文注入 trigger', async () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerEditor(editor);
    runtime.registerWorkspace(workspace);
    await runtime.boot();
    let captured: { bindingId?: string; phase?: string } = {};
    runtime.registerCommand({
      id: 'demo.run',
      title: 'Run',
      run: (context) => {
        captured = { bindingId: context.trigger?.bindingId, phase: context.trigger?.phase };
      },
    });
    runtime.input.register({ commandId: 'demo.run', ...draftFromText('press:KeyF', 'mac') });
    runtime.feedInput(keyDown('KeyF'));
    await Promise.resolve();
    expect(captured.phase).toBe('begin');
    expect(captured.bindingId).toBeDefined();
  });

  test('未注册绑定的按键不触发任何命令（设计验收 ⑮）', async () => {
    const runtime = createMainUiCoreRuntime();
    const run = vi.fn();
    runtime.registerCommand({ id: 'demo.run', title: 'Run', run });
    runtime.input.register({ commandId: 'demo.run', ...draftFromText('press:KeyF', 'mac') });
    runtime.feedInput(keyDown('KeyQ'));
    await Promise.resolve();
    expect(run).not.toHaveBeenCalled();
  });
});

describe('三层覆盖与持久化（设计验收 ⑯）', () => {
  test('用户覆盖替换表达式', () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerCommand({ id: 'demo.run', title: 'Run', run: () => undefined });
    const id = runtime.input.register({ commandId: 'demo.run', ...draftFromText('press:KeyF', 'mac') });

    runtime.input.setUserOverride(id, { binding: 'press:KeyJ' });
    const resolved = runtime.input.list()[0];
    expect(resolved.gesture).toEqual({ kind: 'press', target: { code: 'KeyJ' } });
    expect(resolved.origin).toBe('user');
  });

  test('null 覆盖表示解绑', () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerCommand({ id: 'demo.run', title: 'Run', run: () => undefined });
    const id = runtime.input.register({ commandId: 'demo.run', ...draftFromText('press:KeyF', 'mac') });
    runtime.input.setUserOverride(id, { binding: null });
    expect(runtime.input.list()).toHaveLength(0);
  });

  test('清除覆盖后回落原绑定', () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerCommand({ id: 'demo.run', title: 'Run', run: () => undefined });
    const id = runtime.input.register({ commandId: 'demo.run', ...draftFromText('press:KeyF', 'mac') });
    runtime.input.setUserOverride(id, { binding: 'press:KeyJ' });
    runtime.input.resetUserOverride(id);
    expect(runtime.input.list()[0].gesture).toEqual({ kind: 'press', target: { code: 'KeyF' } });
  });

  test('导出/导入往返', () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerCommand({ id: 'demo.run', title: 'Run', run: () => undefined });
    const id = runtime.input.register({ commandId: 'demo.run', ...draftFromText('press:KeyF', 'mac') });
    runtime.input.setUserOverride(id, { binding: 'press:KeyJ' });
    const exported = runtime.input.exportJson();

    const other = createMainUiCoreRuntime();
    other.registerCommand({ id: 'demo.run', title: 'Run', run: () => undefined });
    other.input.register({ commandId: 'demo.run', ...draftFromText('press:KeyF', 'mac') });
    const result = other.input.importJson(exported);
    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);
  });

  test('导入未知绑定 id 被跳过并计数（设计验收 ⑰）', () => {
    const runtime = createMainUiCoreRuntime();
    const result = runtime.input.importJson(
      JSON.stringify({ version: 1, overrides: { 'ghost:id': { binding: 'press:KeyZ' } } }),
    );
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.skippedIds).toContain('ghost:id');
  });

  test('导入非法 JSON 不抛异常', () => {
    const runtime = createMainUiCoreRuntime();
    const result = runtime.input.importJson('{ not json');
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
  });

  test('导入非法表达式被跳过', () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerCommand({ id: 'demo.run', title: 'Run', run: () => undefined });
    const id = runtime.input.register({ commandId: 'demo.run', ...draftFromText('press:KeyF', 'mac') });
    const result = runtime.input.importJson(
      JSON.stringify({ version: 1, overrides: { [id]: { binding: 'wiggle:KeyX' } } }),
    );
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
  });
});

describe('诊断', () => {
  test('冲突可诊断', () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerCommand({ id: 'a.run', title: 'A', run: () => undefined });
    runtime.registerCommand({ id: 'b.run', title: 'B', run: () => undefined });
    runtime.input.register({ commandId: 'a.run', ...draftFromText('press:KeyF', 'mac') });
    runtime.input.register({ commandId: 'b.run', ...draftFromText('press:KeyF', 'mac') });
    const codes = runtime.input.diagnose().map((item) => item.code);
    expect(codes).toContain('conflict');
  });
});

describe('作用域', () => {
  test('push/pop 作用域栈', () => {
    const runtime = createMainUiCoreRuntime();
    expect(runtime.input.scopes()).toEqual(['global']);
    runtime.input.pushScope('modal');
    expect(runtime.input.scopes()).toEqual(['global', 'modal']);
    runtime.input.popScope('modal');
    expect(runtime.input.scopes()).toEqual(['global']);
  });
});
