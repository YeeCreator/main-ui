/**
 * camera —— @main-ui/core 渲染基础设施的相机数学（纯函数，框架无关）。
 *
 * 相机模型（支持可选旋转）：
 *   screenPx = panPx + R(rotation) · (world * scale)
 *   其中 R(θ) = [[cosθ, -sinθ], [sinθ, cosθ]]；屏幕 Y 轴向下，θ 为正 = 世界顺时针旋转。
 *
 * `rotation` 为**可选字段**（缺省 0），既有 `{ scale, pan }` 相机完全兼容。
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
  /** 旋转角（弧度，屏幕 Y 轴向下，正 = 顺时针）。缺省 0（可选字段，向后兼容）。 */
  rotation?: number;
};

export type ViewBox = { x: number; y: number; width: number; height: number };

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** 读取相机旋转（缺省 0，保证旧相机对象可用）。 */
export function cameraRotation(camera: Camera2D): number {
  const r = camera.rotation;
  return typeof r === 'number' && Number.isFinite(r) ? r : 0;
}

/** 按角度旋转向量（屏幕 Y 轴向下，正 = 顺时针）。 */
export function rotateVec(v: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
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

  return { scale, pan: { x: panX, y: panY }, rotation: 0 };
}

export function screenToWorld(camera: Camera2D, ptScreen: Vec2): Vec2 {
  const rotation = cameraRotation(camera);
  const dx = ptScreen.x - camera.pan.x;
  const dy = ptScreen.y - camera.pan.y;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  // R(-θ) = [[cos, sin], [-sin, cos]]
  const rx = dx * cos + dy * sin;
  const ry = -dx * sin + dy * cos;
  return { x: rx / camera.scale, y: ry / camera.scale };
}

export function worldToScreen(camera: Camera2D, ptWorld: Vec2): Vec2 {
  const rotation = cameraRotation(camera);
  const sx = ptWorld.x * camera.scale;
  const sy = ptWorld.y * camera.scale;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: camera.pan.x + sx * cos - sy * sin,
    y: camera.pan.y + sx * sin + sy * cos,
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
 * 以某个屏幕像素锚点为中心缩放，保持锚点处的世界坐标不动（旋转不变）。
 */
export function zoomAtScreenPoint(camera: Camera2D, opts: { factor: number; anchorScreen: Vec2 }): Camera2D {
  const { factor, anchorScreen } = opts;
  const rotation = cameraRotation(camera);

  const worldBefore = screenToWorld(camera, anchorScreen);
  const nextScale = camera.scale * factor;

  // pan' = anchor - R(θ)·(worldBefore * nextScale)
  const rotated = rotateVec({ x: worldBefore.x * nextScale, y: worldBefore.y * nextScale }, rotation);

  return {
    scale: nextScale,
    pan: { x: anchorScreen.x - rotated.x, y: anchorScreen.y - rotated.y },
    rotation,
  };
}

/**
 * 以某个屏幕像素锚点为中心旋转（缩放不变），保持锚点处的世界坐标不动。
 * deltaAngle 为弧度增量（正 = 顺时针）。
 */
export function rotateAtScreenPoint(camera: Camera2D, opts: { deltaAngle: number; anchorScreen: Vec2 }): Camera2D {
  const { deltaAngle, anchorScreen } = opts;
  const rotation = cameraRotation(camera) + deltaAngle;

  const worldAnchor = screenToWorld(camera, anchorScreen);
  const rotated = rotateVec({ x: worldAnchor.x * camera.scale, y: worldAnchor.y * camera.scale }, rotation);

  return {
    scale: camera.scale,
    pan: { x: anchorScreen.x - rotated.x, y: anchorScreen.y - rotated.y },
    rotation,
  };
}

export function cameraToCssTransform(camera: Camera2D): string {
  const rotation = cameraRotation(camera);
  const parts = [`translate(${camera.pan.x}px, ${camera.pan.y}px)`];
  if (rotation !== 0) parts.push(`rotate(${(rotation * 180) / Math.PI}deg)`);
  parts.push(`scale(${camera.scale})`);
  return parts.join(' ');
}

export type SerializedCamera2D = { scale: number; pan: { x: number; y: number }; rotation?: number };

export function serializeCamera(camera: Camera2D): SerializedCamera2D {
  const rotation = cameraRotation(camera);
  const out: SerializedCamera2D = { scale: camera.scale, pan: { x: camera.pan.x, y: camera.pan.y } };
  if (rotation !== 0) out.rotation = rotation;
  return out;
}

export function deserializeCamera(data: Partial<SerializedCamera2D> | null | undefined): Camera2D | null {
  if (!data) return null;
  const scale = typeof data.scale === 'number' && Number.isFinite(data.scale) ? data.scale : null;
  const pan = data.pan;
  if (scale === null || !pan || !Number.isFinite(pan.x) || !Number.isFinite(pan.y)) return null;
  const camera: Camera2D = { scale, pan: { x: pan.x, y: pan.y } };
  if (typeof data.rotation === 'number' && Number.isFinite(data.rotation)) camera.rotation = data.rotation;
  return camera;
}
