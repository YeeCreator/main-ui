/**
 * environment/detect —— 环境探测（纯函数 + 可注入覆盖）。
 *
 * 判定顺序：
 * 1. 已注入的 **preload 合约**（`window.__mainUiRuntime`，最可信）
 * 2. 显式覆盖（`setEnvironmentProvider`，供宿主/测试注入）
 * 3. 启发式（`process.versions.electron` / `navigator.userAgent`）
 */
import type { MainUiRuntimePayload, RuntimeEnvironment, RuntimePlatform } from './types';

/** preload 合约在 window 上的键名（`__` 前缀表内部约定，避免与下游自有键冲突）。 */
export const MAIN_UI_RUNTIME_KEY = '__mainUiRuntime';

type EnvironmentOverrides = Partial<Omit<RuntimeEnvironment, 'source'>>;

let cached: RuntimeEnvironment | null = null;
let overrides: EnvironmentOverrides | null = null;

/** 读取 window 上 preload 注入的合约载荷；无则返回 null。 */
export function readRuntimePayload(scope?: { [MAIN_UI_RUNTIME_KEY]?: unknown }): MainUiRuntimePayload | null {
  const target: unknown = scope ?? (typeof window !== 'undefined' ? window : undefined);
  if (!target || typeof target !== 'object') return null;
  const payload = (target as Record<string, unknown>)[MAIN_UI_RUNTIME_KEY];
  if (!payload || typeof payload !== 'object') return null;
  const candidate = payload as Partial<MainUiRuntimePayload>;
  if (candidate.kind !== 'electron') return null;
  return candidate as MainUiRuntimePayload;
}

/** 从平台字符串归一化到 RuntimePlatform。 */
export function normalizePlatform(raw: string | undefined): RuntimePlatform {
  const value = (raw ?? '').toLowerCase();
  if (value.startsWith('darwin') || value.includes('mac')) return 'mac';
  if (value.startsWith('win')) return 'windows';
  return 'linux';
}

/** 启发式平台判定（浏览器无 preload 时）。 */
function detectPlatformHeuristic(): RuntimePlatform {
  if (typeof navigator !== 'undefined') {
    const ua = `${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`;
    if (/Mac/i.test(ua)) return 'mac';
    if (/Win/i.test(ua)) return 'windows';
  }
  return 'linux';
}

/** 启发式判断是否运行于 Electron（无 preload 注入时的兜底）。 */
function detectElectronHeuristic(scope?: Record<string, unknown>): { electron: boolean; version?: string } {
  const target = scope ?? (typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : undefined);
  const proc = target?.process as { versions?: Record<string, string> } | undefined;
  const version = proc?.versions?.electron;
  if (typeof version === 'string' && version.length > 0) return { electron: true, version };
  return { electron: false };
}

/**
 * 探测当前运行环境。
 *
 * @param options.force 强制重算（忽略缓存）。
 * @param options.scope 自定义作用域（测试用；缺省为 window/globalThis）。
 * @returns 运行环境描述。
 * @example
 * const env = detectEnvironment();
 * if (env.kind === 'electron') console.log(env.electronVersion);
 */
export function detectEnvironment(options: { force?: boolean; scope?: Record<string, unknown> } = {}): RuntimeEnvironment {
  if (cached && !options.force && !options.scope) return cached;

  const scope = options.scope;
  const payload = readRuntimePayload(scope);
  if (payload) {
    const env: RuntimeEnvironment = {
      kind: 'electron',
      platform: normalizePlatform(payload.platform),
      native: Boolean(payload.native),
      source: 'preload',
    };
    if (payload.electronVersion) env.electronVersion = payload.electronVersion;
    if (!options.scope) cached = env;
    return env;
  }

  if (overrides) {
    const env: RuntimeEnvironment = {
      kind: overrides.kind ?? 'browser',
      platform: overrides.platform ?? detectPlatformHeuristic(),
      native: overrides.native ?? false,
      source: 'override',
    };
    if (overrides.electronVersion) env.electronVersion = overrides.electronVersion;
    if (!options.scope) cached = env;
    return env;
  }

  const heuristic = detectElectronHeuristic(scope);
  const env: RuntimeEnvironment = {
    kind: heuristic.electron ? 'electron' : 'browser',
    platform: detectPlatformHeuristic(),
    native: false, // 无 preload 则无原生能力（即便在 Electron 内）
    source: 'heuristic',
  };
  if (heuristic.version) env.electronVersion = heuristic.version;
  if (!options.scope) cached = env;
  return env;
}

/**
 * 注入环境覆盖（供宿主/测试使用；传 null 清除）。
 *
 * @example
 * setEnvironmentProvider({ kind: 'electron', platform: 'mac', native: true });
 */
export function setEnvironmentProvider(value: EnvironmentOverrides | null): void {
  overrides = value;
  cached = null;
}

/** 清除探测缓存（环境变化后调用）。 */
export function resetEnvironmentCache(): void {
  cached = null;
}
