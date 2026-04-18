import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyLayoutPresetThemeVariables,
  getDefaultResolvedThemeForPreset,
  getLayoutPresetStyles,
  type LayoutPreset,
  type ResolvedTheme,
} from './tokens';

/**
 * 主题模式。
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * 主题上下文值。
 */
export type ThemeContextValue = {
  /** 当前主题模式。 */
  themeMode: ThemeMode;
  /** 当前实际生效主题。 */
  resolvedTheme: ResolvedTheme;
  /** 是否已挂载主题 Provider。 */
  hasProvider: boolean;
  /** 更新主题模式。 */
  setThemeMode: (mode: ThemeMode) => void;
};

/**
 * 主题 Provider 属性。
 */
export type ThemeProviderProps = {
  /** 子节点。 */
  children: React.ReactNode;
  /** 受控主题模式。 */
  mode?: ThemeMode;
  /** 非受控默认模式。 */
  defaultMode?: ThemeMode;
  /** 本地存储键。 */
  storageKey?: string;
  /** 模式变化回调。 */
  onModeChange?: (mode: ThemeMode) => void;
};

/**
 * 空主题上下文默认值。
 */
const DEFAULT_THEME_CONTEXT: ThemeContextValue = {
  themeMode: 'system',
  resolvedTheme: 'light',
  hasProvider: false,
  setThemeMode: () => undefined,
};

/**
 * 主题上下文对象。
 */
const ThemeContext = createContext<ThemeContextValue>(DEFAULT_THEME_CONTEXT);

/**
 * 判断是否为合法主题模式。
 *
 * @param value 待判断字符串。
 * @returns 是否为合法主题模式。
 */
function isThemeMode(value: string): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * 读取系统主题。
 *
 * @returns 系统实际主题。
 */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * 读取本地缓存主题模式。
 *
 * @param storageKey 存储键。
 * @returns 缓存主题模式。
 */
function readStoredThemeMode(storageKey?: string): ThemeMode | undefined {
  if (!storageKey || typeof window === 'undefined') {
    return undefined;
  }
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    return rawValue && isThemeMode(rawValue) ? rawValue : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 解析实际主题。
 *
 * @param mode 主题模式。
 * @param systemTheme 当前系统主题。
 * @returns 解析后的实际主题。
 */
function resolveTheme(mode: ThemeMode, systemTheme: ResolvedTheme): ResolvedTheme {
  return mode === 'system' ? systemTheme : mode;
}

/**
 * 主题 Provider。
 *
 * 提供 light/dark/system 三态主题，并在 system 模式下跟随系统主题变化。
 *
 * @param props Provider 属性。
 * @returns React 节点。
 */
export function ThemeProvider(props: ThemeProviderProps): React.JSX.Element {
  const { children, mode, defaultMode = 'light', storageKey, onModeChange } = props;

  const [internalMode, setInternalMode] = useState<ThemeMode>(() => readStoredThemeMode(storageKey) ?? defaultMode);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  const themeMode = mode ?? internalMode;
  const resolvedTheme = resolveTheme(themeMode, systemTheme);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (eventOrQuery: MediaQueryList | MediaQueryListEvent) => {
      setSystemTheme(eventOrQuery.matches ? 'dark' : 'light');
    };

    handleThemeChange(mediaQuery);

    if ('addEventListener' in mediaQuery) {
      mediaQuery.addEventListener('change', handleThemeChange);
      return () => mediaQuery.removeEventListener('change', handleThemeChange);
    }

    const legacyMediaQuery = mediaQuery as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    legacyMediaQuery.addListener?.(handleThemeChange);
    return () => legacyMediaQuery.removeListener?.(handleThemeChange);
  }, []);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(storageKey, themeMode);
    } catch {
      // 忽略只读存储环境。
    }
  }, [storageKey, themeMode]);

  useEffect(() => {
    applyLayoutPresetThemeVariables(resolvedTheme);
  }, [resolvedTheme]);

  /**
   * 更新主题模式。
   *
   * @param nextMode 下一主题模式。
   */
  const setThemeMode = useCallback(
    (nextMode: ThemeMode) => {
      if (mode === undefined) {
        setInternalMode(nextMode);
      }
      onModeChange?.(nextMode);
    },
    [mode, onModeChange]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      resolvedTheme,
      hasProvider: true,
      setThemeMode,
    }),
    [resolvedTheme, setThemeMode, themeMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * 获取主题上下文。
 *
 * @returns 主题上下文值。
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * 读取当前主题下的预设样式。
 *
 * @param preset 预设名称。
 * @returns 预设样式。
 */
export function useLayoutPresetStyles(preset: LayoutPreset = 'default') {
  return getLayoutPresetStyles(preset);
}

/**
 * 读取当前解析主题。
 *
 * @param preset 预设名称。
 * @returns 当前解析主题。
 */
export function useResolvedTheme(preset: LayoutPreset = 'default'): ResolvedTheme {
  const { resolvedTheme, hasProvider } = useTheme();
  return hasProvider ? resolvedTheme : getDefaultResolvedThemeForPreset(preset);
}
