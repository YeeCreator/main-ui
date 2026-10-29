/**
 * core/theme/mode —— 主题模式的解析纯函数。
 *
 * 守护目标：`mode: 'system'` 必须真的跟随系统。
 *
 * 背景：`theme/setMode` 的 `resolvedMode` 是可选字段，reducer 在缺省时按
 * 「非 dark 即 light」兜底 —— 于是 `system` 会被解析成 `light`。
 * 此前只有 Provider 在 `matchMedia` 变化时补发正确值，导致「从浅色切到
 * 跟随系统」的首帧仍然错，且之后没有事件会纠正它。
 */
import { describe, expect, test } from 'vitest';
import { THEME_MODES, isSystemThemeMode, resolveThemeMode } from '../../src/core/theme/mode';

describe('resolveThemeMode', () => {
  test('显式 light / dark 无视系统偏好', () => {
    expect(resolveThemeMode('light', true)).toBe('light');
    expect(resolveThemeMode('light', false)).toBe('light');
    expect(resolveThemeMode('dark', true)).toBe('dark');
    expect(resolveThemeMode('dark', false)).toBe('dark');
  });

  test('system 跟随系统偏好', () => {
    expect(resolveThemeMode('system', true)).toBe('dark');
    expect(resolveThemeMode('system', false)).toBe('light');
  });

  test('返回值只能是 light / dark（不得再回传 system）', () => {
    for (const mode of THEME_MODES) {
      for (const prefersDark of [true, false]) {
        expect(['light', 'dark']).toContain(resolveThemeMode(mode, prefersDark));
      }
    }
  });
});

describe('isSystemThemeMode', () => {
  test('只有 system 为真', () => {
    expect(isSystemThemeMode('system')).toBe(true);
    expect(isSystemThemeMode('light')).toBe(false);
    expect(isSystemThemeMode('dark')).toBe(false);
  });
});

describe('THEME_MODES', () => {
  test('覆盖全部三种模式且顺序稳定（顺序即 UI 展示顺序）', () => {
    expect(THEME_MODES).toEqual(['light', 'dark', 'system']);
  });

  test('与 resolveThemeMode 的定义域一致（新增模式必须同时进本表）', () => {
    for (const mode of THEME_MODES) {
      expect(() => resolveThemeMode(mode, false)).not.toThrow();
    }
  });
});
