/**
 * input/provider —— 原生输入源扩展点。
 *
 * 网页层拿不到三类输入：三/四指滑动（macOS 系统独占）、Chromium 的触控板旋转、
 * 以及被操作系统或 Electron 主进程抢先消费的按键（`before-input-event`、
 * `globalShortcut`、`NSEvent` 触摸阶段）。
 *
 * 本模块只定义**接口与注册表**，不实现任何原生桥。宿主在自己仓库里实现 provider，
 * 注入后即可参与同一套匹配与分发 —— 绑定语法与匹配算法因此无需改动。
 */
import type { InputSignal } from './types';

/** 原生输入源提供者。 */
export type InputSourceProvider = {
  /** 稳定标识（用于诊断与去重），例：`'electron-before-input'`。 */
  id: string;
  /**
   * 启动提供者：把产生的信号推给 `emit`，返回卸载函数。
   *
   * 卸载必须幂等：宿主可能因热重载或布局重建而重复调用。
   */
  start: (emit: (signal: InputSignal) => void) => () => void;
  /** 本提供者能覆盖的能力声明（供面板与诊断标注「已由原生桥接管」）。 */
  capabilities?: InputSourceCapability[];
};

/** 原生桥能力声明。 */
export type InputSourceCapability =
  | 'multi-finger-gesture'
  | 'trackpad-rotation'
  | 'global-shortcut'
  | 'intercepted-key';

/** 提供者注册表。 */
export type InputSourceProviderRegistry = {
  /** 注册提供者，返回注销函数。 */
  register: (provider: InputSourceProvider) => () => void;
  /** 列出已注册提供者。 */
  list: () => InputSourceProvider[];
  /** 已声明覆盖的能力（面板据此把「不可达」标为「由原生桥接管」）。 */
  capabilities: () => InputSourceCapability[];
};

/**
 * 创建提供者注册表。
 *
 * @returns 注册表实例。
 * @example
 * const registry = createInputSourceProviderRegistry()
 * registry.register({ id: 'native', start: (emit) => { /* ... *\/ return () => {} } })
 */
export function createInputSourceProviderRegistry(): InputSourceProviderRegistry {
  const providers = new Map<string, InputSourceProvider>();

  return {
    register(provider) {
      providers.set(provider.id, provider);
      return () => {
        if (providers.get(provider.id) === provider) providers.delete(provider.id);
      };
    },
    list: () => [...providers.values()],
    capabilities() {
      const set = new Set<InputSourceCapability>();
      for (const provider of providers.values()) {
        for (const capability of provider.capabilities ?? []) set.add(capability);
      }
      return [...set];
    },
  };
}
