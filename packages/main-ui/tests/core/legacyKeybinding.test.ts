/**
 * 旧式键位注册的兼容契约测试（设计验收 ㉑）。
 *
 * 背景：`main-ui` 的下游里有多个仓库属**只读依赖**，上游不能要求它们
 * 与主包同批改动。因此 `{ commandId, keybinding: 'Ctrl+X' }` 必须继续可用，
 * 且语义与 0.7.0 完全一致（`Ctrl` 在 mac 上仍是 ⌘）。
 *
 * 这不是「双引擎」：旧写法进到 `register` 立刻被解析为同一份 `Binding`，
 * 匹配、诊断、面板只有一条路径。
 */
import { describe, expect, test, vi } from 'vitest';
import { createMainUiCoreRuntime, createSingleGroupLayout } from '../../src/core';
import type { WorkspaceDescriptor } from '../../src/core';
import { NO_MODIFIERS, type InputSignal } from '@main-ui/core/input';

const workspace: WorkspaceDescriptor = {
  id: 'demo',
  title: 'Demo',
  allowedEditorKinds: [],
  recommendedEditorKinds: [],
  defaultOpenRequests: [],
  createDefaultLayout: () => createSingleGroupLayout(),
  allowUserReset: true,
};

const keyDown = (code: string, mods = NO_MODIFIERS): InputSignal => ({
  phase: 'down',
  source: 'keyboard',
  code,
  key: code,
  mods,
  repeat: false,
  t: 0,
});

describe('旧式 registerKeybinding 兼容', () => {
  test('字符串键位被解析为 press 手势', () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerCommand({ id: 'gallery.refreshTree', title: '刷新', run: () => undefined });
    runtime.registerKeybinding({ commandId: 'gallery.refreshTree', keybinding: 'Cmd+R' });

    const binding = runtime.input.list()[0];
    expect(binding.commandId).toBe('gallery.refreshTree');
    expect(binding.gesture).toEqual({ kind: 'press', target: { code: 'KeyR' } });
    expect(binding.chord.mods.meta).toBe(true);
    expect(binding.origin).toBe('host');
  });

  test('Ctrl 在 mac 上落到主修饰键（与 0.7.0 语义一致）', () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerCommand({ id: 'a.run', title: 'A', run: () => undefined });
    runtime.registerKeybinding({ commandId: 'a.run', keybinding: 'Ctrl+Shift+K' });

    const binding = runtime.input.list()[0];
    expect(binding.chord.mods.meta).toBe(true);
    expect(binding.chord.mods.shift).toBe(true);
    expect(binding.chord.mods.ctrl).toBe(false);
  });

  test('单键写法（L / Delete / Backspace）', () => {
    const runtime = createMainUiCoreRuntime();
    for (const id of ['a', 'b', 'c']) runtime.registerCommand({ id, title: id, run: () => undefined });
    runtime.registerKeybinding({ commandId: 'a', keybinding: 'L' });
    runtime.registerKeybinding({ commandId: 'b', keybinding: 'Delete' });
    runtime.registerKeybinding({ commandId: 'c', keybinding: 'Backspace' });

    const targets = runtime.input.list().map((binding) => binding.gesture);
    expect(targets).toContainEqual({ kind: 'press', target: { code: 'KeyL' } });
    expect(targets).toContainEqual({ kind: 'press', target: { code: 'Delete' } });
    expect(targets).toContainEqual({ kind: 'press', target: { code: 'Backspace' } });
  });

  test('allowInInput 与 weight 被保留', () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerCommand({ id: 'a.run', title: 'A', run: () => undefined });
    runtime.registerKeybinding({ commandId: 'a.run', keybinding: 'Cmd+R', allowInInput: false, weight: 5 });

    const binding = runtime.input.list()[0];
    expect(binding.allowInInput).toBe(false);
    expect(binding.weight).toBe(5);
  });

  test('旧式注册的绑定能被真实触发（端到端）', async () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerWorkspace(workspace);
    await runtime.boot();
    const run = vi.fn();
    runtime.registerCommand({ id: 'gallery.refreshTree', title: '刷新', run });
    runtime.registerKeybinding({ commandId: 'gallery.refreshTree', keybinding: 'Cmd+R' });

    runtime.feedInput(keyDown('KeyR', { ...NO_MODIFIERS, meta: true }));
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
  });

  test('多个快捷键指向同一命令（Canvas 的 Delete/Backspace 场景）', () => {
    const runtime = createMainUiCoreRuntime();
    runtime.registerCommand({ id: 'canvas.delete', title: '删除', run: () => undefined });
    runtime.registerKeybinding({ commandId: 'canvas.delete', keybinding: 'Delete' });
    runtime.registerKeybinding({ commandId: 'canvas.delete', keybinding: 'Backspace' });

    const bindings = runtime.input.list().filter((binding) => binding.commandId === 'canvas.delete');
    expect(bindings).toHaveLength(2);
  });
});
