/**
 * 绑定 DSL 的行为契约测试。
 *
 * 三条必须守住的保证：
 * 1. **往返一致** —— `parseBinding(formatBinding(x))` 与 `normalizeBinding(x)` 等价；
 * 2. **旧写法是语法糖** —— `Ctrl+Shift+P` 与 `cmd+shift+press:KeyP` 归一为同一绑定；
 * 3. **错误结构化** —— 非法输入抛带 `code` 的错误，不静默降级。
 */
import { describe, expect, test } from 'vitest';
import {
  BindingParseError,
  countModifiers,
  draftFromText,
  formatBinding,
  normalizeBinding,
  parseBinding,
} from '../src/input/binding-dsl';
import { NO_MODIFIERS, type BindingDraft, type GesturePattern } from '../src/input/types';

const emptyChord = { mods: { ...NO_MODIFIERS }, modsMatch: 'exact' as const, buttons: [], keys: [] };

/** 便捷构造草稿。 */
const draft = (gesture: GesturePattern, overrides: Partial<BindingDraft> = {}): BindingDraft => ({
  chord: { ...emptyChord, mods: { ...NO_MODIFIERS }, buttons: [], keys: [] },
  gesture,
  ...overrides,
});

describe('parseBinding：五类手势', () => {
  test('单键 press', () => {
    expect(parseBinding('press:KeyF', 'mac').gesture).toEqual({ kind: 'press', target: { code: 'KeyF' } });
  });

  test('长按带阈值', () => {
    expect(parseBinding('hold:Space:250', 'mac').gesture).toEqual({
      kind: 'hold',
      target: { code: 'Space' },
      minMs: 250,
    });
  });

  test('轻点带上限', () => {
    expect(parseBinding('tap:KeyQ:200', 'mac').gesture).toEqual({
      kind: 'tap',
      target: { code: 'KeyQ' },
      maxMs: 200,
    });
  });

  test('抬起带按住区间', () => {
    expect(parseBinding('release:KeyQ:100-400', 'mac').gesture).toEqual({
      kind: 'release',
      target: { code: 'KeyQ' },
      heldMs: { min: 100, max: 400 },
    });
  });

  test('鼠标拖拽分轴带阈值', () => {
    expect(parseBinding('alt+drag:0:x:8', 'mac').gesture).toEqual({
      kind: 'drag',
      button: 0,
      axis: 'x',
      minPx: 8,
    });
  });

  test('滚轮方向', () => {
    expect(parseBinding('shift+wheel:up', 'mac').gesture).toEqual({ kind: 'wheel', dir: 'up', minDelta: 40 });
  });

  test('触控板捏合', () => {
    expect(parseBinding('cmd+pinch:out', 'mac').gesture).toEqual({ kind: 'pinch', dir: 'out', minScale: 0.02 });
  });

  test('触控板甩动', () => {
    expect(parseBinding('swipe:left:40:300', 'mac').gesture).toEqual({
      kind: 'swipe',
      dir: 'left',
      minPx: 40,
      maxMs: 300,
    });
  });

  test('双击', () => {
    expect(parseBinding('alt+click:1:2', 'mac').gesture).toEqual({ kind: 'click', button: 1, count: 2 });
  });
});

describe('parseBinding：组合与序列', () => {
  test('组合键把 Ctrl 归到 mac 主修饰键', () => {
    const parsed = parseBinding('ctrl+press:KeyS', 'mac');
    expect(parsed.chord.mods.meta).toBe(true);
    expect(parsed.chord.mods.ctrl).toBe(false);
  });

  test('非 mac 平台上 ctrl 即主修饰键', () => {
    const parsed = parseBinding('ctrl+press:KeyS', 'windows');
    expect(parsed.chord.mods.ctrl).toBe(true);
    expect(parsed.chord.mods.meta).toBe(false);
  });

  test('字面 Control 走 control 别名', () => {
    const parsed = parseBinding('control+press:KeyS', 'mac');
    expect(parsed.chord.mods.ctrl).toBe(true);
    expect(parsed.chord.mods.meta).toBe(false);
  });

  test('序列 G → G', () => {
    const parsed = parseBinding('press:KeyG then press:KeyG', 'mac');
    expect(parsed.sequence).toEqual([{ kind: 'press', target: { code: 'KeyG' } }]);
    expect(parsed.gesture).toEqual({ kind: 'press', target: { code: 'KeyG' } });
  });

  test('序列末段为滚轮', () => {
    const parsed = parseBinding('press:KeyG then wheel:up', 'mac');
    expect(parsed.sequence).toHaveLength(1);
    expect(parsed.gesture.kind).toBe('wheel');
  });

  test('atLeast 标记', () => {
    expect(parseBinding('shift+*+press:KeyA', 'mac').chord.modsMatch).toBe('atLeast');
  });

  test('chord 支持按住鼠标键', () => {
    const parsed = parseBinding('space+0+press:KeyA', 'mac');
    expect(parsed.chord.keys).toEqual(['Space']);
    expect(parsed.chord.buttons).toEqual([0]);
  });
});

describe('旧写法语法糖', () => {
  test('Ctrl+Shift+P 与 cmd+shift+press:KeyP 归一为同一绑定', () => {
    const legacy = draftFromText('Ctrl+Shift+P', 'mac');
    const modern = draftFromText('cmd+shift+press:KeyP', 'mac');
    expect(legacy).toEqual(modern);
  });

  test('单键 L 归一为物理键位', () => {
    expect(draftFromText('L', 'mac').gesture).toEqual({ kind: 'press', target: { code: 'KeyL' } });
  });

  test('Delete 走别名表', () => {
    expect(draftFromText('Delete', 'mac').gesture).toEqual({ kind: 'press', target: { code: 'Delete' } });
    expect(draftFromText('Del', 'mac').gesture).toEqual({ kind: 'press', target: { code: 'Delete' } });
  });
});

describe('格式化', () => {
  test('mac 上主修饰键输出 cmd', () => {
    expect(formatBinding(draftFromText('ctrl+shift+press:KeyP', 'mac'), 'mac')).toBe('cmd+shift+press:KeyP');
  });

  test('windows 上主修饰键输出 ctrl', () => {
    expect(formatBinding(draftFromText('ctrl+shift+press:KeyP', 'windows'), 'windows')).toBe(
      'ctrl+shift+press:KeyP',
    );
  });

  test('序列使用 then 连接', () => {
    expect(formatBinding(draftFromText('press:KeyG then press:KeyG', 'mac'), 'mac')).toBe(
      'press:KeyG then press:KeyG',
    );
  });

  test('拖拽分轴', () => {
    expect(formatBinding(draftFromText('alt+drag:0:x:8', 'mac'), 'mac')).toBe('alt+drag:0:x:8');
  });
});

describe('往返一致（设计验收 ①）', () => {
  const samples = [
    'press:KeyF',
    'hold:Space:250',
    'tap:KeyQ:200',
    'release:KeyQ',
    'release:KeyQ:100-400',
    'ctrl+press:KeyS',
    'cmd+shift+press:KeyP',
    'alt+click:0',
    'alt+click:1:2',
    'alt+drag:0:x:8',
    'drag:1:12',
    'shift+wheel:up',
    'cmd+pinch:out',
    'swipe:left:40:300',
    'rotate:cw:15',
    'press:KeyG then press:KeyG',
    'press:KeyG then wheel:up',
    'space+0+press:KeyA',
  ];

  test.each(samples)('%s 往返一致', (sample) => {
    const first = draftFromText(sample, 'mac');
    const text = formatBinding(first, 'mac');
    const second = draftFromText(text, 'mac');
    expect(second).toEqual(first);
    expect(formatBinding(second, 'mac')).toBe(text);
  });
});

describe('错误结构化（设计验收 ③）', () => {
  test('空表达式', () => {
    expect(() => parseBinding('   ', 'mac')).toThrow(BindingParseError);
    try {
      parseBinding('', 'mac');
    } catch (error) {
      expect((error as BindingParseError).code).toBe('empty');
    }
  });

  test('未知手势', () => {
    try {
      parseBinding('wiggle:KeyA', 'mac');
      throw new Error('should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BindingParseError);
      expect((error as BindingParseError).code).toBe('unknown-gesture');
    }
  });

  test('缺少目标', () => {
    try {
      parseBinding('press:', 'mac');
      throw new Error('should throw');
    } catch (error) {
      expect((error as BindingParseError).code).toBe('missing-target');
    }
  });

  test('参数非数值', () => {
    try {
      parseBinding('hold:Space:abc', 'mac');
      throw new Error('should throw');
    } catch (error) {
      expect((error as BindingParseError).code).toBe('invalid-parameter');
    }
  });

  test('方向非法', () => {
    try {
      parseBinding('wheel:sideways', 'mac');
      throw new Error('should throw');
    } catch (error) {
      expect((error as BindingParseError).code).toBe('invalid-parameter');
    }
  });

  test('click 的 count 越界', () => {
    try {
      parseBinding('click:0:3', 'mac');
      throw new Error('should throw');
    } catch (error) {
      expect((error as BindingParseError).code).toBe('invalid-parameter');
    }
  });

  test('修饰键重复', () => {
    try {
      parseBinding('shift+shift+press:KeyA', 'mac');
      throw new Error('should throw');
    } catch (error) {
      expect((error as BindingParseError).code).toBe('duplicate-modifier');
    }
  });
});

describe('normalizeBinding', () => {
  test('补齐 swallow 与 mode 默认值', () => {
    const normalized = normalizeBinding(draft({ kind: 'press', target: { code: 'KeyA' } }), 'mac');
    expect(normalized.swallow).toBe(true);
    expect(normalized.mode).toBe('once');
  });

  test('不修改入参', () => {
    const original = draft({ kind: 'press', target: { code: 'KeyA' } });
    const snapshot = JSON.parse(JSON.stringify(original));
    normalizeBinding(original, 'mac');
    expect(JSON.parse(JSON.stringify(original))).toEqual(snapshot);
  });

  test('单字符 key 引用归一为物理键位', () => {
    const normalized = normalizeBinding(draft({ kind: 'press', target: { key: 'a' } }), 'mac');
    expect(normalized.gesture).toEqual({ kind: 'press', target: { code: 'KeyA' } });
  });

  test('非字母字符保留字符语义', () => {
    const normalized = normalizeBinding(draft({ kind: 'press', target: { key: '?' } }), 'mac');
    expect(normalized.gesture).toEqual({ kind: 'press', target: { key: '?' } });
  });

  test('鼠标键与 keys 排序', () => {
    const normalized = normalizeBinding(
      { chord: { mods: { ...NO_MODIFIERS }, modsMatch: 'exact', buttons: [2, 0], keys: ['KeyB', 'KeyA'] }, gesture: { kind: 'press', target: { code: 'KeyC' } } },
      'mac',
    );
    expect(normalized.chord.buttons).toEqual([0, 2]);
    expect(normalized.chord.keys).toEqual(['KeyA', 'KeyB']);
  });
});

describe('countModifiers', () => {
  test('统计修饰键数量', () => {
    expect(countModifiers({ ...NO_MODIFIERS })).toBe(0);
    expect(countModifiers({ ctrl: false, alt: false, shift: true, meta: true })).toBe(2);
  });
});
