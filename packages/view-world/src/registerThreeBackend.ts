/**
 * view-world/registerThreeBackend —— 三维后端的注册辅助（供宿主 `createXXXRuntime.ts` 使用）。
 *
 * 设计 §十九 9：宿主注册**一次**即可用两档。本函数只做三件事：
 * 1. 把 `@main-ui/render-3d` 的工厂包成 `ViewportBackendFactory`；
 * 2. 写进全局 `BackendRegistry`（键固定 `three-3d`）；
 * 3. 返回 `backends` 集合与 `useWorldDimension` 可直接消费的形状。
 *
 * 之所以不直接在 `view-world` 里 import `@main-ui/render-3d`：
 * 那会让 `view-world` 硬依赖 three，破坏"模板不 import 渲染库"这条硬规矩。
 * 故三维后端由**宿主**注入，本文件只给一个不触发依赖的注册辅助。
 */
import type { ViewportBackendFactory } from '@main-ui/core/rendering';
import { defaultBackendRegistry } from '@main-ui/core/rendering';
import { THREE_BACKEND_KEY } from './WorldView';

/** 三维后端注册选项。 */
export interface RegisterThreeBackendOptions {
  /** 后端工厂（通常为 `@main-ui/render-3d` 的 `createThreeBackend`）。 */
  factory: ViewportBackendFactory;
  /** 覆盖注册键（缺省 `three-3d`）。 */
  key?: string;
  /** 展示名（缺省 `3D`）。 */
  label?: string;
}

/**
 * 把三维后端注册进全局注册表。
 *
 * @param options 工厂与可选键名。
 * @returns 供 `WorldView` 的 `backends` prop 与 `useWorldDimension` 使用的映射。
 * @example
 * ```ts
 * import { createThreeBackend } from '@main-ui/render-3d';
 * import { registerThreeBackend } from '@main-ui/view-world';
 *
 * const backends = registerThreeBackend({ factory: createThreeBackend });
 * ```
 */
export function registerThreeBackend(
  options: RegisterThreeBackendOptions,
): Record<string, ViewportBackendFactory> {
  const key = options.key ?? THREE_BACKEND_KEY;
  defaultBackendRegistry.register({
    key,
    label: options.label ?? '3D',
    factory: options.factory,
    // 三维后端声明 [2,3]：二维档是其内部预设，故两档都能由它承担。
    capabilities: { dimensions: [2, 3], wideLines: true, extrude: true, msdfText: true, instancing: true, name: key },
  });
  return { [key]: options.factory };
}

/**
 * 合并宿主已有的后端映射（二维内置后端由 `view-world` 自动兜底，无需显式登记）。
 *
 * @param extra 额外后端（如多个三维实现）。
 * @returns 可直接传给 `WorldView` 的 `backends` prop。
 */
export function mergeBackends(
  ...extra: Array<Record<string, ViewportBackendFactory> | null | undefined>
): Record<string, ViewportBackendFactory> {
  const out: Record<string, ViewportBackendFactory> = {};
  for (const group of extra) {
    if (!group) continue;
    Object.assign(out, group);
  }
  return out;
}
