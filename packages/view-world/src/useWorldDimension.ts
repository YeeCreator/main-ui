/**
 * useWorldDimension —— 维度开关的宿主侧控制器（WP4）。
 *
 * 设计 §十九 9：维度能力**运行时探测已装后端**（不读 descriptor 静态声明），
 * 当前选择入 `SettingsStore`（沿用 `cg-wheel-mode` 这类视口设置先例）。
 *
 * 用法（宿主）：
 * ```ts
 * const dim = useWorldDimension({ store, backends: { 'three-3d': createThree3DBackend } });
 * // 模板里：<WorldView :dimension="dim.dimension.value" :backends="dim.backends" />
 * // 工具栏里：dim.canToggle ? <button @click="dim.toggle()">{{ dim.label }}</button> : null
 * ```
 *
 * 纪律：只装二维后端时 `canToggle === false` —— 开关不渲染，且不报错。
 */
import { computed, ref, watch, type Ref } from 'vue';
import type { BackendDimension, ViewportBackendFactory } from '@main-ui/core/rendering';

/** `SettingsStore` 的最小读写契约（避免把整个 store 类型拖进模板包）。 */
export interface DimensionSettingsStore {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

export interface UseWorldDimensionOptions {
  /** 设置存储（可选；缺省只在内存里保持）。 */
  store?: DimensionSettingsStore;
  /** 设置键（缺省 `view-world:dimension`）。 */
  storageKey?: string;
  /** 宿主注入的后端工厂集合（键 → 工厂）。 */
  backends?: Record<string, ViewportBackendFactory> | null;
  /** 三维后端对应的键（缺省 `three-3d`）；只有该键存在时开关才可用。 */
  threeBackendKey?: string;
  /** 初始维度（缺省读 store，再缺省 2）。 */
  initial?: BackendDimension;
}

export interface WorldDimensionController {
  /** 当前维度（给模板 `:dimension`）。 */
  dimension: Ref<BackendDimension>;
  /** 后端集合（给模板 `:backends`）。 */
  backends: Record<string, ViewportBackendFactory> | null;
  /** 是否装了三维后端（决定开关是否渲染）。 */
  canToggle: Readonly<Ref<boolean>>;
  /** 开关标签（`3D 视图` / `2D 视图`）。 */
  label: Readonly<Ref<string>>;
  /** 在二维与三维之间切换（未装三维后端时是空操作）。 */
  toggle: () => void;
  /** 直接设定维度（未装三维后端时设 3 会被拒）。 */
  setDimension: (next: BackendDimension) => void;
}

const DEFAULT_STORAGE_KEY = 'view-world:dimension';
const DEFAULT_THREE_KEY = 'three-3d';

/**
 * 创建维度控制器。
 *
 * @param options 配置（store / backends / 初始维度）。
 * @returns 供模板与工具栏消费的响应式控制器。
 * @example
 * ```ts
 * const dim = useWorldDimension({ store: settings, backends });
 * dim.canToggle.value; // false = 只装了二维后端，开关不渲染
 * ```
 */
export function useWorldDimension(options: UseWorldDimensionOptions = {}): WorldDimensionController {
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const threeKey = options.threeBackendKey ?? DEFAULT_THREE_KEY;
  const backends = options.backends ?? null;

  const hasThreeBackend = Boolean(backends && backends[threeKey]);
  const canToggle = computed(() => hasThreeBackend);

  const readInitial = (): BackendDimension => {
    if (hasThreeBackend === false) return 2; // 未装三维后端时强制二维，避免残留非法值
    const raw = options.store?.get(storageKey);
    if (raw === 3 || raw === 2) return raw;
    return options.initial ?? 2;
  };

  const dimension = ref<BackendDimension>(readInitial());

  // 持久化：仅在可切换时落盘（只装二维的宿主不写无意义键）。
  // `flush: 'sync'` —— 维度是"用户点了就该记住"的设置，异步 flush 会在快速切换/卸载时丢写入。
  watch(
    dimension,
    (next) => {
      if (!canToggle.value) return;
      options.store?.set(storageKey, next);
    },
    { flush: 'sync' },
  );

  const setDimension = (next: BackendDimension): void => {
    if (next === 3 && !canToggle.value) return; // 拒绝无后端的三维档
    dimension.value = next;
  };

  const toggle = (): void => {
    if (!canToggle.value) return;
    dimension.value = dimension.value === 3 ? 2 : 3;
  };

  const label = computed(() => {
    if (!canToggle.value) return '2D 视图';
    return dimension.value === 3 ? '2D 视图' : '3D 视图';
  });

  return { dimension, backends, canToggle, label, toggle, setDimension };
}
