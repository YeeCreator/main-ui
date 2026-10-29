/**
 * theme/mode —— 主题模式的**解析纯函数**（框架无关、零 DOM 依赖）。
 *
 * 为什么需要这一层：`theme/setMode` action 的 `resolvedMode` 是可选项，
 * reducer 在缺省时按「非 dark 即 light」兜底 —— 于是 `mode: 'system'` 会被
 * 解析成 `light`，**不跟随系统**。此前只有 `MainUiProvider` 在 `matchMedia`
 * 变化时补发一次正确值，导致「从浅色切到跟随系统」的**首帧仍然错**，
 * 且首帧之后没有任何事件会纠正它（除非用户改变系统外观）。
 *
 * 把解析规则收成一个纯函数后，所有「发出 setMode」的地方都必须用它，
 * 不再依赖某个组件是否恰好监听了媒体查询。
 */
import type { ThemeMode } from './types';

/** 系统是否偏好深色（由调用方从 `matchMedia` 取值后传入，便于单测）。 */
export type SystemPrefersDark = boolean;

/**
 * 把主题模式解析为**实际生效**的明暗。
 *
 * @param mode 用户选择的模式（`light` / `dark` / `system`）。
 * @param prefersDark 系统当前是否偏好深色（`system` 模式下才有意义）。
 * @returns 实际生效的明暗。
 * @example
 * resolveThemeMode('light', true)   // 'light' —— 显式浅色，无视系统
 * resolveThemeMode('dark', false)   // 'dark'  —— 显式深色，无视系统
 * resolveThemeMode('system', true)  // 'dark'  —— 跟随系统
 * resolveThemeMode('system', false) // 'light'
 */
export function resolveThemeMode(mode: ThemeMode, prefersDark: SystemPrefersDark): 'light' | 'dark' {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return prefersDark ? 'dark' : 'light';
}

/**
 * 判断主题模式是否为「跟随系统」。
 *
 * @param mode 主题模式。
 * @returns 是否为 system。
 * @example
 * isSystemThemeMode('system') // true
 * isSystemThemeMode('dark')   // false
 */
export function isSystemThemeMode(mode: ThemeMode): boolean {
  return mode === 'system';
}

/** 全部主题模式（供 UI 渲染选项，顺序即展示顺序）。 */
export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];
