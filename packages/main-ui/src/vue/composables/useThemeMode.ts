/**
 * useThemeMode —— 主题模式的读写（**唯一正确的切换入口**）。
 *
 * ## 为什么需要这个 composable
 *
 * `theme/setMode` 的 `resolvedMode` 是可选字段，reducer 在缺省时按
 * 「非 dark 即 light」兜底 —— 于是 `mode: 'system'` 会被解析成 `light`，
 * **不跟随系统**。
 *
 * 正确发法是 `resolvedMode: resolveThemeMode(mode, matchMedia(...).matches)`。
 * 但这个「正确发法」如果由每个宿主各写一遍，就必然有人漏 —— 实测多处宿主
 * 直接 `dispatch({ type: 'theme/setMode', mode })`，症状是「选了跟随系统却没反应」，
 * 且没有报错。
 *
 * 故把「读系统偏好 + 解析 + dispatch」收成一个 composable：宿主不再需要
 * 知道 `resolvedMode` 的存在。
 *
 * ## 用法
 *
 * ```ts
 * const { themeMode, resolvedMode, setThemeMode } = useThemeMode()
 * setThemeMode('system')   // 内部已带上正确的 resolvedMode
 * ```
 *
 * 必须在 `MainUiProvider` 子树内调用。
 */
import { computed } from 'vue';
import type { ThemeMode } from '../../core/theme/types';
import { THEME_MODES, resolveThemeMode } from '../../core/theme/mode';
import { useWorkbench } from './useWorkbench';

/** `useThemeMode` 的返回形态。 */
export type ThemeModeApi = {
  /** 用户选择的模式（`light` / `dark` / `system`）。 */
  themeMode: Readonly<{ value: ThemeMode }>;
  /** 实际生效的明暗（`light` / `dark`）。 */
  resolvedMode: Readonly<{ value: 'light' | 'dark' }>;
  /** 全部可选模式（顺序即 UI 展示顺序）。 */
  modes: readonly ThemeMode[];
  /** 切换模式（内部已解析 `resolvedMode`，宿主无需关心）。 */
  setThemeMode: (mode: ThemeMode) => void;
};

/**
 * 读取系统是否偏好深色。
 *
 * 非浏览器环境（SSR / Node 测试）返回 `false`，与「跟随系统」在浅色下的
 * 表现一致，不抛错。
 *
 * @returns 系统是否偏好深色。
 */
export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * 构造 `theme/setMode` 的 action（**已带正确的 `resolvedMode`**）。
 *
 * 与 {@link useThemeMode} 的区别：本函数**不需要 `MainUiProvider` 上下文**，
 * 因此可用于 Provider 之外的 setup、普通函数或应用启动时的一次性初始化。
 *
 * 宿主凡是自行 dispatch `theme/setMode`，都应经本函数构造 action ——
 * 否则 `mode: 'system'` 会被 reducer 兜底成 `light`。
 *
 * @param mode 目标主题模式。
 * @param prefersDark 系统是否偏好深色；缺省时现读 `matchMedia`。
 * @returns 可直接交给 `dispatch` 的 action。
 * @example
 * void runtime.core.dispatch(createSetThemeModeAction('system'))
 */
export function createSetThemeModeAction(
  mode: ThemeMode,
  prefersDark: boolean = systemPrefersDark(),
): { type: 'theme/setMode'; mode: ThemeMode; resolvedMode: 'light' | 'dark' } {
  return { type: 'theme/setMode', mode, resolvedMode: resolveThemeMode(mode, prefersDark) };
}

/**
 * 主题模式读写（必须在 `MainUiProvider` 子树内调用）。
 *
 * @returns 当前模式、生效明暗、可选模式列表与切换函数。
 * @example
 * const { themeMode, setThemeMode, modes } = useThemeMode()
 * setThemeMode(modes[2])   // 'system'
 */
export function useThemeMode(): ThemeModeApi {
  const { document, runtime } = useWorkbench();

  const themeMode = computed<ThemeMode>(() => document.value.theme.mode);
  const resolvedMode = computed<'light' | 'dark'>(() => {
    const theme = document.value.theme;
    // 优先用文档里的解析结果（Provider 会随系统变化同步）；
    // 缺省时按模式现算，避免首帧读到空值。
    if (theme.resolvedMode === 'light' || theme.resolvedMode === 'dark') return theme.resolvedMode;
    return resolveThemeMode(theme.mode, systemPrefersDark());
  });

  const setThemeMode = (mode: ThemeMode): void => {
    void runtime.core.dispatch(createSetThemeModeAction(mode));
  };

  return { themeMode, resolvedMode, modes: THEME_MODES, setThemeMode };
}
