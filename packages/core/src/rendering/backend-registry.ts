/**
 * rendering/backend-registry —— 渲染后端注册表（宿主注册、模板解析）。
 *
 * 设计 §十九 3 / §十九 9：维度能力**运行时探测已装后端**，不在 descriptor 上静态声明。
 * 因此注册表是"已装后端"的唯一运行时真相源，开关据此决定是否渲染。
 *
 * 模块级单例可被多个宿主共享，但每个宿主也可 `createBackendRegistry()` 拿独立实例
 * （demo / 测试与真实宿主互不污染）。
 */

import type {
  BackendCapabilities,
  BackendDimension,
  ViewportBackendFactory,
} from './backend';

/** 一条后端注册。 */
export interface BackendRegistration {
  /** 稳定键（`pixi-2d` / `three-3d` 等），用于设置持久化与诊断。 */
  key: string;
  /** 展示名（开关标签）。 */
  label: string;
  /** 后端工厂（每次挂载取新实例）。 */
  factory: ViewportBackendFactory;
  /** 能力声明（工厂的静态快照，供探测；不依赖实例）。 */
  capabilities: BackendCapabilities;
}

export interface BackendRegistry {
  /** 注册一条后端；同键覆盖（后注册生效）。 */
  register(registration: BackendRegistration): void;
  /** 注销。 */
  unregister(key: string): void;
  /** 按键取注册。 */
  get(key: string): BackendRegistration | undefined;
  /** 全部注册（按注册顺序）。 */
  list(): readonly BackendRegistration[];
  /** 是否有任一后端声明支持该维度。 */
  supportsDimension(dimension: BackendDimension): boolean;
  /** 已装后端声明的维度并集（升序）。 */
  supportedDimensions(): BackendDimension[];
  /** 清空（测试与宿主销毁用）。 */
  clear(): void;
}

/** 创建独立注册表（每宿主一份，互不污染）。 */
export function createBackendRegistry(): BackendRegistry {
  const map = new Map<string, BackendRegistration>();

  return {
    register(registration) {
      map.set(registration.key, registration);
    },
    unregister(key) {
      map.delete(key);
    },
    get(key) {
      return map.get(key);
    },
    list() {
      return Array.from(map.values());
    },
    supportsDimension(dimension) {
      for (const entry of map.values()) {
        if (entry.capabilities.dimensions.includes(dimension)) return true;
      }
      return false;
    },
    supportedDimensions() {
      const set = new Set<BackendDimension>();
      for (const entry of map.values()) {
        for (const dim of entry.capabilities.dimensions) set.add(dim);
      }
      return Array.from(set).sort((a, b) => a - b);
    },
    clear() {
      map.clear();
    },
  };
}

/** 默认注册表（进程级单例；宿主也可自建）。 */
export const defaultBackendRegistry: BackendRegistry = createBackendRegistry();
