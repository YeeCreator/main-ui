import type { Camera2D, Vec2 } from './viewportMath';
import { screenToWorld, worldToScreen } from './viewportMath';

/** 兼容旧相机模型：x/y 为 world 左上角，zoom 为 world->screen 缩放。 */
export type LegacyCamera = {
  x: number;
  y: number;
  zoom: number;
};

export type CssPoint = { x: number; y: number };
export type WorldPoint = { x: number; y: number };

/**
 * 将 viewport-2d-kit 相机转换为 legacy 相机。
 * @param camera2d viewport-2d-kit 相机
 * @param opts dprScale 为 CSS 像素到 canvas 像素倍率
 */
export function camera2DToLegacy(camera2d: Camera2D, opts: { dprScale: number }): LegacyCamera {
  const zoom = camera2d.scale * opts.dprScale;
  const x = -camera2d.pan.x / camera2d.scale;
  const y = -camera2d.pan.y / camera2d.scale;
  return { x, y, zoom };
}

/**
 * 将 legacy 相机转换为 viewport-2d-kit 相机。
 * @param cam legacy 相机
 * @param opts dprScale 为 CSS 像素到 canvas 像素倍率
 */
export function legacyToCamera2D(cam: LegacyCamera, opts: { dprScale: number }): Camera2D {
  const scale = cam.zoom / opts.dprScale;
  return {
    scale,
    pan: { x: -cam.x * scale, y: -cam.y * scale },
  };
}

/** 获取 canvas CSS 像素与像素缓冲区之间的缩放倍率。 */
export function getDprScaleFromCanvas(canvasEl: HTMLCanvasElement): number {
  const rect = canvasEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return window.devicePixelRatio || 1;
  const sx = canvasEl.width / rect.width;
  const sy = canvasEl.height / rect.height;
  return (sx + sy) / 2;
}

/** 容器本地 CSS 坐标 -> canvas 像素坐标。 */
export function localCssPxToCanvasPx(opts: { canvasEl: HTMLCanvasElement; ptLocal: Vec2 }): Vec2 | null {
  const { canvasEl, ptLocal } = opts;
  const rect = canvasEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: (ptLocal.x / rect.width) * canvasEl.width,
    y: (ptLocal.y / rect.height) * canvasEl.height,
  };
}

/** canvas 像素坐标 -> 容器本地 CSS 坐标。 */
export function canvasPxToLocalCssPx(opts: { canvasEl: HTMLCanvasElement; ptCanvas: Vec2 }): Vec2 | null {
  const { canvasEl, ptCanvas } = opts;
  const rect = canvasEl.getBoundingClientRect();
  if (canvasEl.width <= 0 || canvasEl.height <= 0) return null;
  return {
    x: (ptCanvas.x / canvasEl.width) * rect.width,
    y: (ptCanvas.y / canvasEl.height) * rect.height,
  };
}

/** 浏览器 client 坐标 -> wrap 容器本地 CSS 坐标。 */
export function clientToLocalCssPoint(wrapEl: HTMLDivElement, clientX: number, clientY: number): CssPoint {
  const rect = wrapEl.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/** 浏览器 client 坐标 -> world 坐标。 */
export function clientToWorldPoint(wrapEl: HTMLDivElement, camera: Camera2D, clientX: number, clientY: number): WorldPoint {
  const localCss = clientToLocalCssPoint(wrapEl, clientX, clientY);
  return localCssToWorld(camera, localCss);
}

/** 指针/鼠标事件 -> world 坐标。 */
export function clientEventToWorldPoint(
  wrapEl: HTMLDivElement,
  camera: Camera2D,
  event: Pick<MouseEvent | PointerEvent, 'clientX' | 'clientY'>,
): WorldPoint {
  return clientToWorldPoint(wrapEl, camera, event.clientX, event.clientY);
}

/** wrap 本地 CSS 坐标 -> workspace CSS 坐标。 */
export function localCssToWorkspaceCss(wrapEl: HTMLDivElement, localCss: CssPoint): CssPoint {
  return { x: localCss.x + wrapEl.scrollLeft, y: localCss.y + wrapEl.scrollTop };
}

/** workspace CSS 坐标 -> wrap 本地 CSS 坐标。 */
export function workspaceCssToLocalCss(wrapEl: HTMLDivElement, workspaceCss: CssPoint): CssPoint {
  return { x: workspaceCss.x - wrapEl.scrollLeft, y: workspaceCss.y - wrapEl.scrollTop };
}

/** world 坐标 -> workspace CSS 坐标。 */
export function worldToWorkspaceCss(camera: Camera2D, world: WorldPoint): CssPoint {
  const s = worldToScreen(camera, world);
  return { x: s.x, y: s.y };
}

/** wrap 本地 CSS 坐标 -> world 坐标。 */
export function localCssToWorld(camera: Camera2D, localCss: CssPoint): WorldPoint {
  const w = screenToWorld(camera, localCss);
  return { x: w.x, y: w.y };
}

/** world 坐标 -> wrap 本地 CSS 坐标。 */
export function worldToLocalCss(_wrapEl: HTMLDivElement, camera: Camera2D, world: WorldPoint): CssPoint {
  const s = worldToScreen(camera, world);
  return { x: s.x, y: s.y };
}

/**
 * 过渡兼容：world 坐标先映射到 workspace CSS，再减去 wrap 滚动得到本地 CSS。
 * 对于 viewport-2d-kit 语义完整的层，优先使用 worldToLocalCss。
 */
export function worldToLocalCssWithScroll(wrapEl: HTMLDivElement, camera: Camera2D, world: WorldPoint): CssPoint {
  const ws = worldToWorkspaceCss(camera, world);
  return workspaceCssToLocalCss(wrapEl, ws);
}
