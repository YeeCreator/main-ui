import type { View2dCameraState } from './types';

/** 校验相机状态可序列化形态（纯函数，可单测）。 */
export const isValidCameraState = (raw: unknown): raw is View2dCameraState => {
  if (!raw || typeof raw !== 'object') return false;
  const candidate = raw as View2dCameraState;
  return (
    Number.isFinite(candidate.scale)
    && candidate.scale > 0
    && Boolean(candidate.pan)
    && Number.isFinite(candidate.pan.x)
    && Number.isFinite(candidate.pan.y)
  );
};

/** 把快照里的未知状态规范化为相机（非法时回退）。 */
export const sanitizeCameraState = (
  raw: unknown,
  fallback: View2dCameraState | null = null,
): View2dCameraState | null => {
  if (isValidCameraState(raw)) {
    return { scale: raw.scale, pan: { x: raw.pan.x, y: raw.pan.y } };
  }
  return fallback;
};

/** 解析 CSS 颜色字符串为 pixi 数值色（支持 #rgb / #rrggbb / rgb()，纯函数，可单测）。 */
export const parseCssColorToNumber = (css: string): number | null => {
  const value = css.trim();
  if (value.startsWith('#')) {
    let hex = value.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((ch) => ch + ch).join('');
    }
    if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) return null;
    return parseInt(hex, 16);
  }
  const match = value.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (match) {
    const [r, g, b] = match.slice(1, 4).map((part) => Math.min(255, Number(part)));
    return (r << 16) + (g << 8) + b;
  }
  return null;
};
