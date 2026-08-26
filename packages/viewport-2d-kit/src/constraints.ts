import type { Camera2D, ViewBox } from './viewportMath';
import { clamp } from './viewportMath';

export type CameraConstraints = {
  /** 允许的缩放范围（绝对值）。 */
  scale?: { min: number; max: number };

  /**
   * 平移限制：把 worldBounds（世界范围）尽量保持在 viewport 内。
   *
   * 说明：
   * - 若 worldBounds 比 viewport 小：镜头会被“夹紧”到居中。
   * - 若 worldBounds 比 viewport 大：允许在边缘之间移动。
   */
  panBounds?: {
    worldBounds: ViewBox;
    viewportPx: { width: number; height: number };
    /** 允许额外越界的屏幕像素（给“手感”留一点余量）。默认 0。 */
    overscrollPx?: number;
  };
};

/**
 * 根据约束修正相机。
 *
 * 返回的 camera 是一个“温和约束”结果：
 * - 先 clamp scale
 * - 再 clamp pan（如果有 panBounds）
 */
export function constrainCamera(camera: Camera2D, constraints: CameraConstraints): Camera2D {
  let next: Camera2D = camera;

  if (constraints.scale) {
    const s = clamp(next.scale, constraints.scale.min, constraints.scale.max);
    if (s !== next.scale) next = { ...next, scale: s };
  }

  const b = constraints.panBounds;
  if (b) {
    const { worldBounds, viewportPx, overscrollPx = 0 } = b;
    const w = viewportPx.width;
    const h = viewportPx.height;

    // screen = pan + world*scale
    // 对于左边界： pan + x0*scale <= overscroll
    // 对于右边界： pan + x1*scale >= w-overscroll
    // => pan <= overscroll - x0*scale
    // => pan >= (w-overscroll) - x1*scale

    const x0 = worldBounds.x;
    const x1 = worldBounds.x + worldBounds.width;
    const y0 = worldBounds.y;
    const y1 = worldBounds.y + worldBounds.height;

    const panXMin = (w - overscrollPx) - x1 * next.scale;
    const panXMax = overscrollPx - x0 * next.scale;

    const panYMin = (h - overscrollPx) - y1 * next.scale;
    const panYMax = overscrollPx - y0 * next.scale;

    const fixAxis = (pan: number, min: number, max: number, axis0: number, axis1: number, view: number): number => {
      if (min <= max) return clamp(pan, min, max);
      // world 比 viewport 小，会出现 min > max，此时强制居中
      const centerWorld = (axis0 + axis1) / 2;
      const centerScreen = view / 2;
      return centerScreen - centerWorld * next.scale;
    };

    const panX = fixAxis(next.pan.x, panXMin, panXMax, x0, x1, w);
    const panY = fixAxis(next.pan.y, panYMin, panYMax, y0, y1, h);

    if (panX !== next.pan.x || panY !== next.pan.y) {
      next = { ...next, pan: { x: panX, y: panY } };
    }
  }

  return next;
}
