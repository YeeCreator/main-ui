import type { Camera2D, Vec2, ViewBox } from './viewportMath';

/**
 * 把相机应用到 CanvasRenderingContext2D。
 *
 * 约定：
 * - world -> screen: screen = pan + world * scale
 * - 因此 ctx.setTransform(scale, 0, 0, scale, pan.x, pan.y)
 */
export function applyCameraToCanvas2D(ctx: CanvasRenderingContext2D, camera: Camera2D) {
  ctx.setTransform(camera.scale, 0, 0, camera.scale, camera.pan.x, camera.pan.y);
}

/**
 * 把一个世界坐标的矩形（viewBox）转换为 SVG transform matrix(a b c d e f) 字符串。
 *
 * 注意：这里输出的是“把 world space 映射到 screen space”的矩阵，适配 SVG 的 transform。
 * - a=d=scale
 * - e=pan.x
 * - f=pan.y
 */
export function cameraToSvgMatrix(camera: Camera2D): string {
  const a = camera.scale;
  const d = camera.scale;
  const e = camera.pan.x;
  const f = camera.pan.y;
  return `matrix(${a} 0 0 ${d} ${e} ${f})`;
}

/**
 * 计算在指定 viewport 像素尺寸下，绘制世界 viewBox 的推荐画布像素大小（支持 dpr）。
 *
 * 用法：
 * - CSS 尺寸仍由布局决定（viewportPx）
 * - 实际 canvas.width/height 用这个函数得到的像素值，保证清晰
 */
export function getHiDpiCanvasPixelSize(viewportPx: { width: number; height: number }, dpr: number): {
  width: number;
  height: number;
} {
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return {
    width: Math.max(1, Math.round(viewportPx.width * safeDpr)),
    height: Math.max(1, Math.round(viewportPx.height * safeDpr)),
  };
}

/**
 * 把 viewport 的像素 rect 归一化。
 */
export function normalizeViewportPxRect(r: { width: number; height: number }): { width: number; height: number } {
  return {
    width: Math.max(1, r.width),
    height: Math.max(1, r.height),
  };
}

/**
 * 计算“当前相机下，viewport 显示的世界范围”。
 *
 * 这对：
 * - 虚拟化（只渲染可见对象）
 * - 调试 HUD
 * - 约束/吸附
 * 都很有用。
 */
export function getVisibleWorldBox(camera: Camera2D, viewportPx: { width: number; height: number }): ViewBox {
  const inv = 1 / camera.scale;
  const x = (-camera.pan.x) * inv;
  const y = (-camera.pan.y) * inv;
  return {
    x,
    y,
    width: viewportPx.width * inv,
    height: viewportPx.height * inv,
  };
}

/**
 * 将屏幕 px 位移转成世界位移（常用于：对齐、拖拽手柄等）。
 */
export function screenDeltaToWorldDelta(camera: Camera2D, deltaScreen: Vec2): Vec2 {
  return { x: deltaScreen.x / camera.scale, y: deltaScreen.y / camera.scale };
}
