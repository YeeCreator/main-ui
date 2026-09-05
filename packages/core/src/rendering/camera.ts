/**
 * camera —— @main-ui/core 渲染基础设施的相机数学（纯函数，框架无关）。
 *
 * 相机模型：
 *   screenPx = panPx + world * scale
 *
 * 由原 viewport-2d-kit 的 viewportMath 吸收而来（包名消灭，功能内化进 core）。
 */

export type Vec2 = { x: number; y: number };

/**
 * 2D 相机：把世界坐标（content/world space）通过视口展示为屏幕坐标（screen space）。
 */
export type Camera2D = {
  /** 世界单位 -> 屏幕像素 的缩放系数 */
  scale: number;
  /** 平移量（屏幕像素） */
  pan: Vec2;
};

export type ViewBox = { x: number; y: number; width: number; height: number };

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * 把世界范围 viewBox 适配到容器尺寸（居中 + 等比缩放，含 padding）。
 */
export function fitCameraToViewBox(opts: {
  containerPx: { width: number; height: number };
  viewBox: ViewBox;
  paddingPx?: number;
}): Camera2D {
  const { containerPx, viewBox, paddingPx = 0 } = opts;

  const w = Math.max(1, containerPx.width - paddingPx * 2);
  const h = Math.max(1, containerPx.height - paddingPx * 2);

  const scale = Math.min(w / viewBox.width, h / viewBox.height);

  const worldCenterX = viewBox.x + viewBox.width / 2;
  const worldCenterY = viewBox.y + viewBox.height / 2;
  const screenCenterX = containerPx.width / 2;
  const screenCenterY = containerPx.height / 2;

  const panX = screenCenterX - worldCenterX * scale;
  const panY = screenCenterY - worldCenterY * scale;

  return { scale, pan: { x: panX, y: panY } };
}

export function screenToWorld(camera: Camera2D, ptScreen: Vec2): Vec2 {
  return {
    x: (ptScreen.x - camera.pan.x) / camera.scale,
    y: (ptScreen.y - camera.pan.y) / camera.scale,
  };
}

export function worldToScreen(camera: Camera2D, ptWorld: Vec2): Vec2 {
  return {
    x: camera.pan.x + ptWorld.x * camera.scale,
    y: camera.pan.y + ptWorld.y * camera.scale,
  };
}

export function panBy(camera: Camera2D, deltaScreen: Vec2): Camera2D {
  return {
    ...camera,
    pan: {
      x: camera.pan.x + deltaScreen.x,
      y: camera.pan.y + deltaScreen.y,
    },
  };
}

/**
 * 以某个屏幕像素锚点为中心缩放，保持锚点处的世界坐标不动。
 */
export function zoomAtScreenPoint(camera: Camera2D, opts: { factor: number; anchorScreen: Vec2 }): Camera2D {
  const { factor, anchorScreen } = opts;

  const worldBefore = screenToWorld(camera, anchorScreen);
  const nextScale = camera.scale * factor;

  const panX = anchorScreen.x - worldBefore.x * nextScale;
  const panY = anchorScreen.y - worldBefore.y * nextScale;

  return { scale: nextScale, pan: { x: panX, y: panY } };
}

export function cameraToCssTransform(camera: Camera2D): string {
  return `translate(${camera.pan.x}px, ${camera.pan.y}px) scale(${camera.scale})`;
}

export type SerializedCamera2D = { scale: number; pan: { x: number; y: number } };

export function serializeCamera(camera: Camera2D): SerializedCamera2D {
  return { scale: camera.scale, pan: { x: camera.pan.x, y: camera.pan.y } };
}

export function deserializeCamera(data: Partial<SerializedCamera2D> | null | undefined): Camera2D | null {
  if (!data) return null;
  const scale = typeof data.scale === 'number' && Number.isFinite(data.scale) ? data.scale : null;
  const pan = data.pan;
  if (scale === null || !pan || !Number.isFinite(pan.x) || !Number.isFinite(pan.y)) return null;
  return { scale, pan: { x: pan.x, y: pan.y } };
}
