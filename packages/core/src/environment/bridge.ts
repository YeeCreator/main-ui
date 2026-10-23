/**
 * environment/bridge —— 原生能力桥（Electron 经 preload 注入；浏览器降级为 none）。
 *
 * MUI 只定义**合约**；实现由下游宿主在 `electron/preload` 中注入到
 * `window.__mainUiRuntime.native`（键名见 `MAIN_UI_RUNTIME_KEY`）。
 */
import { MAIN_UI_RUNTIME_KEY, readRuntimePayload } from './detect';
import type { NativeBridge } from './types';

const NONE_BRIDGE: NativeBridge = { kind: 'none' };

/**
 * 读取原生能力桥。
 *
 * @param scope 自定义作用域（测试用；缺省为 window）。
 * @returns 原生桥；浏览器环境固定为 `{ kind: 'none' }`。
 * @example
 * const bridge = getNativeBridge();
 * if (bridge.kind === 'electron') bridge.window?.minimize();
 */
export function getNativeBridge(scope?: Record<string, unknown>): NativeBridge {
  const payload = readRuntimePayload(scope);
  if (!payload) return NONE_BRIDGE;
  const native = payload.native;
  if (!native) return { kind: 'none' };
  return {
    kind: 'electron',
    ...(native.window ? { window: native.window } : {}),
    ...(native.fs ? { fs: native.fs } : {}),
    ...(native.menu ? { menu: native.menu } : {}),
  };
}

/** 是否具备原生能力。 */
export function hasNativeBridge(scope?: Record<string, unknown>): boolean {
  return getNativeBridge(scope).kind === 'electron';
}

export { MAIN_UI_RUNTIME_KEY };
