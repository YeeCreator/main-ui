/**
 * view-world/world-state —— 纯函数：相机状态净化 / 视图状态构建 / CSS 颜色解析。
 *
 * 关键纪律（对齐 F-3 缺陷教训）：getViewState 必须返回**普通值**，
 * 绝不返回 Vue ref 的响应式 Proxy，否则内核 structuredClone(document) 会抛
 * DataCloneError 崩工作台。这里所有构造函数都产出全新普通对象。
 */
import type { Camera2D } from '@main-ui/core/rendering';
import type { WorldCameraState, WorldViewState } from './types';

/** 把任意输入净化为合法的相机状态；非法返回 null。 */
export function sanitizeCameraState(raw: unknown): WorldCameraState | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<WorldCameraState>;
  const scale = candidate.scale;
  const pan = candidate.pan;
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) return null;
  if (!pan || typeof pan !== 'object') return null;
  const px = (pan as { x?: unknown }).x;
  const py = (pan as { y?: unknown }).y;
  if (typeof px !== 'number' || typeof py !== 'number' || !Number.isFinite(px) || !Number.isFinite(py)) return null;
  return { scale, pan: { x: px, y: py } };
}

/** 从 Camera2D 构建视图状态（全新普通对象，可安全 structuredClone）。 */
export function buildWorldViewState(camera: Camera2D | null | undefined): WorldViewState {
  const safe = camera && Number.isFinite(camera.scale) && Number.isFinite(camera.pan.x) && Number.isFinite(camera.pan.y)
    ? camera
    : { scale: 1, pan: { x: 0, y: 0 } };
  return { camera: { scale: safe.scale, pan: { x: safe.pan.x, y: safe.pan.y } } };
}

/** 视图状态相机 -> Camera2D。 */
export function toCamera2D(state: WorldCameraState): Camera2D {
  return { scale: state.scale, pan: { x: state.pan.x, y: state.pan.y } };
}

/**
 * 解析 CSS 颜色字符串为 0xRRGGBB 数值；无法解析返回 null。
 * 支持 #rgb / #rrggbb / rgb(r,g,b) / rgba(r,g,b,a)。
 */
export function parseCssColorToNumber(css: string | null | undefined): number | null {
  if (!css) return null;
  const value = css.trim();
  if (!value) return null;

  if (value.startsWith('#')) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if ([r, g, b].every((n) => Number.isFinite(n))) return (r << 16) | (g << 8) | b;
      return null;
    }
    if (hex.length === 6 || hex.length === 8) {
      const n = parseInt(hex.slice(0, 6), 16);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (match) {
    const parts = match[1].split(',').map((p) => parseFloat(p.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
      const r = clampByte(parts[0]);
      const g = clampByte(parts[1]);
      const b = clampByte(parts[2]);
      return (r << 16) | (g << 8) | b;
    }
  }
  return null;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}
