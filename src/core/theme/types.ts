import type { ThemeId } from '../types';

export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemeState = {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  themeId: ThemeId;
};

export type WorkbenchSettings = {
  density: 'compact' | 'comfortable';
};

export const createDefaultThemeState = (): ThemeState => ({
  mode: 'system',
  resolvedMode: 'light',
  themeId: 'main-ui-system',
});

export const createDefaultWorkbenchSettings = (): WorkbenchSettings => ({
  density: 'compact',
});
