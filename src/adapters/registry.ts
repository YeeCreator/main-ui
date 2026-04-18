import type { AdapterRegistry } from './types';

/**
 * 当前运行时适配器注册表。
 */
let currentRegistry: AdapterRegistry = {};

/**
 * 设置适配器注册表。
 *
 * @param registry 需要注册的适配器集合。
 */
export function setAdapterRegistry(registry: AdapterRegistry): void {
  currentRegistry = { ...registry };
}

/**
 * 合并注册适配器。
 *
 * @param partialRegistry 需要追加或覆盖的适配器集合。
 */
export function mergeAdapterRegistry(partialRegistry: AdapterRegistry): void {
  currentRegistry = {
    ...currentRegistry,
    ...partialRegistry,
  };
}

/**
 * 读取当前适配器注册表。
 *
 * @returns 当前可用的适配器集合。
 */
export function getAdapterRegistry(): Readonly<AdapterRegistry> {
  return currentRegistry;
}
