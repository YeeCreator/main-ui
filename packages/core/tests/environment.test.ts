import { describe, expect, test } from 'vitest';
import {
  BROWSER_SHELL_POLICY,
  ELECTRON_SHELL_POLICY,
  MAIN_UI_RUNTIME_KEY,
  detectEnvironment,
  getNativeBridge,
  hasNativeBridge,
  normalizePlatform,
  readRuntimePayload,
  resetEnvironmentCache,
  resolveShellPolicy,
  setEnvironmentProvider,
} from '../src/environment';

describe('core/environment detect', () => {
  test('normalizePlatform maps raw strings', () => {
    expect(normalizePlatform('darwin')).toBe('mac');
    expect(normalizePlatform('MacIntel')).toBe('mac');
    expect(normalizePlatform('win32')).toBe('windows');
    expect(normalizePlatform('linux')).toBe('linux');
    expect(normalizePlatform(undefined)).toBe('linux');
  });

  test('readRuntimePayload only accepts kind=electron', () => {
    expect(readRuntimePayload({ [MAIN_UI_RUNTIME_KEY]: { kind: 'electron', platform: 'darwin' } })).toEqual({
      kind: 'electron',
      platform: 'darwin',
    });
    expect(readRuntimePayload({ [MAIN_UI_RUNTIME_KEY]: { kind: 'browser' } })).toBeNull();
    expect(readRuntimePayload({})).toBeNull();
  });

  test('detectEnvironment prefers preload payload', () => {
    const env = detectEnvironment({
      scope: { [MAIN_UI_RUNTIME_KEY]: { kind: 'electron', platform: 'darwin', electronVersion: '39.2.7', native: { window: {} } } },
    });
    expect(env.kind).toBe('electron');
    expect(env.platform).toBe('mac');
    expect(env.native).toBe(true);
    expect(env.source).toBe('preload');
    expect(env.electronVersion).toBe('39.2.7');
  });

  test('detectEnvironment falls back to heuristic (no native)', () => {
    const env = detectEnvironment({ scope: { process: { versions: { electron: '37.2.6' } } } });
    expect(env.kind).toBe('electron');
    expect(env.native).toBe(false);
    expect(env.source).toBe('heuristic');
  });

  test('detectEnvironment honours override provider', () => {
    setEnvironmentProvider({ kind: 'electron', platform: 'windows', native: true });
    const env = detectEnvironment({ scope: {} });
    expect(env.kind).toBe('electron');
    expect(env.platform).toBe('windows');
    expect(env.source).toBe('override');
    setEnvironmentProvider(null);
    resetEnvironmentCache();
  });
});

describe('core/environment policy', () => {
  test('browser vs electron defaults differ where expected', () => {
    const browser = resolveShellPolicy({ kind: 'browser', platform: 'mac', native: false, source: 'heuristic' });
    expect(browser.suppressContextMenu).toBe(true);
    expect(browser.interceptShortcuts.length).toBeGreaterThan(0);

    const electron = resolveShellPolicy({ kind: 'electron', platform: 'mac', native: true, source: 'preload' });
    expect(electron.suppressContextMenu).toBe(false);
    expect(electron.suppressTextSelection).toBe(false);
    expect(electron.interceptShortcuts).toEqual([]);
    expect(electron.canvasGestureGuard).toBe(true);
  });

  test('resolveShellPolicy applies overrides', () => {
    const policy = resolveShellPolicy({ kind: 'browser', platform: 'mac', native: false, source: 'heuristic' }, { interceptShortcuts: [] });
    expect(policy.interceptShortcuts).toEqual([]);
    expect(policy.preventPageZoom).toBe(BROWSER_SHELL_POLICY.preventPageZoom);
  });

  test('policy constants are frozen-by-value snapshots', () => {
    expect(ELECTRON_SHELL_POLICY.canvasGestureGuard).toBe(true);
    expect(BROWSER_SHELL_POLICY.canvasGestureGuard).toBe(true);
  });
});

describe('core/environment bridge', () => {
  test('no payload -> none bridge', () => {
    expect(getNativeBridge({})).toEqual({ kind: 'none' });
    expect(hasNativeBridge({})).toBe(false);
  });

  test('electron payload exposes native capabilities', () => {
    const scope = {
      [MAIN_UI_RUNTIME_KEY]: {
        kind: 'electron',
        native: { window: { minimize: () => {}, maximize: () => {}, close: () => {} } },
      },
    };
    const bridge = getNativeBridge(scope);
    expect(bridge.kind).toBe('electron');
    expect(bridge.window).toBeDefined();
    expect(bridge.fs).toBeUndefined();
    expect(hasNativeBridge(scope)).toBe(true);
  });
});
