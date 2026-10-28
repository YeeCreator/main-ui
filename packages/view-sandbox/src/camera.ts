/**
 * view-sandbox/camera —— 沙盘相机的归一化与旧格式迁移。
 *
 * 沙盘相机现为 `Camera2D`（`{ scale, pan }`），与全库内部唯一可计算表示一致
 * （design-main-ui §二十 5）。此前的 `{ x, y, zoom }` 只是命名不同，却使
 * 两套桥接函数必须同时存在。
 *
 * **存量快照兼容**：旧版 `getViewState` 产出的是 `{ x, y, zoom }`，可能已被
 * 持久化在宿主文档里。读取时必须归一化，否则 `camera.scale` 为 `undefined`
 * 会让世界层变换串变成非法值（浏览器静默丢弃）。
 */
import type { Camera2D } from '@main-ui/core/rendering';

/** 旧版沙盘相机形状（仅为迁移保留，不得在新代码中使用）。 */
export type LegacySandboxCamera = { x: number; y: number; zoom: number };

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * 把任意形态的沙盘相机归一化为 `Camera2D`。
 *
 * 接受：`Camera2D`（原样）、旧版 `{ x, y, zoom }`（迁移）、无效值（回退默认）。
 *
 * @param raw 待归一化的相机值（可能来自存量持久化快照）。
 * @returns 一定合法的 `Camera2D`。
 * @example
 * normalizeSandboxCamera({ x: 10, y: 20, zoom: 2 })
 * // → { scale: 2, pan: { x: 10, y: 20 } }
 * normalizeSandboxCamera({ scale: 2, pan: { x: 0, y: 0 } })
 * // → { scale: 2, pan: { x: 0, y: 0 } }
 * normalizeSandboxCamera(null)
 * // → { scale: 1, pan: { x: 0, y: 0 } }
 */
export function normalizeSandboxCamera(raw: unknown): Camera2D {
  if (!raw || typeof raw !== 'object') return { scale: 1, pan: { x: 0, y: 0 } };

  const candidate = raw as Partial<Camera2D> & Partial<LegacySandboxCamera>;

  // 现行形状
  if (isFiniteNumber(candidate.scale) && candidate.pan && isFiniteNumber(candidate.pan.x) && isFiniteNumber(candidate.pan.y)) {
    const out: Camera2D = { scale: candidate.scale, pan: { x: candidate.pan.x, y: candidate.pan.y } };
    if (isFiniteNumber(candidate.rotation) && candidate.rotation !== 0) out.rotation = candidate.rotation;
    return out;
  }

  // 旧版形状 → 迁移
  if (isFiniteNumber(candidate.x) && isFiniteNumber(candidate.y) && isFiniteNumber(candidate.zoom)) {
    return { scale: candidate.zoom, pan: { x: candidate.x, y: candidate.y } };
  }

  return { scale: 1, pan: { x: 0, y: 0 } };
}
