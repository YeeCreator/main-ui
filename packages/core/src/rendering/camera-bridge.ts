/**
 * rendering/camera-bridge —— 二维相机与三维轨道相机的统一表示与换算（纯函数）。
 *
 * 设计 §十九 3：**相机统一表示**与**坐标约定翻转**必须单点在 core，不得散落各仓。
 *
 * 坐标约定（此处定死）：
 * - `Camera2D`（`./camera.ts`）：**屏幕 Y 轴向下**，`pan` 为屏幕像素平移，
 *   `rotation` 正 = 世界顺时针旋转。
 * - three：Y 轴向上右手系，地面平面为 XZ（`y` 为高度）。
 *
 * 因此二维世界点 `(x, y)` 映射到三维地面点为 `(x, 0, y)`（即 three 的 `z = y`），
 * 高度由 `z` 列（2.5D 深度）另行承担 —— 见 `toSpatialAxis()` 的说明。
 *
 * 三维侧统一用**轨道相机**（orthographic 档与 perspective 档共用一套参数）：
 * 目标点 `target` + 方位角 `azimuth` + 极角 `polar` + 距离 `distance` + 视口高度 `viewHeight`。
 */

import type { Camera2D, Vec2 } from './camera';
import { cameraRotation } from './camera';

/** 三维轨道相机（可序列化纯值）。 */
export interface OrbitCamera {
  /** 注视点（三维坐标；二维平面映射后 `y` 通常为 0）。 */
  target: { x: number; y: number; z: number };
  /** 方位角（弧度，绕 Y 轴；0 = 从 +Z 方向看）。 */
  azimuth: number;
  /** 极角（弧度，从 +Y 轴量起；π/2 = 水平视线，0 = 俯视正上方）。 */
  polar: number;
  /** 相机到 target 的距离。 */
  distance: number;
  /**
   * 正交档下可见高度（世界单位）。
   *
   * 与 `distance` 分开而非复用：正交投影的缩放只由视锥高度决定，
   * 改 `distance` 不影响画面尺寸（但影响裁剪面）。
   */
  viewHeight: number;
}

/** 二维 ↔ 三维相机释义档位。 */
export type CameraProjection = 'orthographic' | 'perspective';

/** 二维平面点 -> 三维地面点（屏幕 Y 向下 → 世界 Z 正方向）。 */
export function planeToGround(pt: Vec2, height = 0): { x: number; y: number; z: number } {
  return { x: pt.x, y: height, z: pt.y };
}

/** 三维地面点 -> 二维平面点（丢弃高度）。 */
export function groundToPlane(pt: { x: number; z: number }): Vec2 {
  return { x: pt.x, y: pt.z };
}

/**
 * 默认俯视极角：接近正上方（从 +Y 轴量起，**0 = 正俯视**，π/2 = 水平视线）。
 *
 * 取一个很小的非零值（约 7°）而不是 0：正俯视会让"高度"完全不可见，
 * 也容易与万向锁相提并论；略偏一点既有扁平感又能看出微弱立体。
 *
 * ⚠️ 历史缺陷（已于 2026-10-27 修正）：此处曾写成 `Math.PI / 2 - 0.02`，
 * 把"略偏离正上方"理解成了"接近水平"，导致二维档画面被压成一条线。
 */
export const DEFAULT_TOP_POLAR = 0.12;

/**
 * 二维相机 → 三维轨道相机（正交俯视档）。
 *
 * 语义：二维档看到的画面 = 三维相机以正交投影从接近正上方俯视地面平面。
 * 换算要点：
 * - `viewHeight = 视口高度 / scale`（正交视锥高度与缩放互为倒数）；
 * - 注视点 = 屏幕中心对应的世界点（经 `screenToWorld` 语义反算）；
 * - `rotation` 与 `azimuth` 同号（二维顺时针 = 绕 Y 轴负向，故取负）。
 */
export function camera2DToOrbit(camera: Camera2D, viewportPx: { width: number; height: number }): OrbitCamera {
  const scale = camera.scale > 0 ? camera.scale : 1;
  const centerScreen = { x: viewportPx.width / 2, y: viewportPx.height / 2 };
  const rotation = cameraRotation(camera);

  // screen = pan + R(θ)·(world·scale) 的逆：world = R(-θ)·(screen - pan)/scale
  const dx = centerScreen.x - camera.pan.x;
  const dy = centerScreen.y - camera.pan.y;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const rx = dx * cos + dy * sin;
  const ry = -dx * sin + dy * cos;
  const centerWorld = { x: rx / scale, y: ry / scale };

  const viewHeight = Math.max(1, viewportPx.height) / scale;

  return {
    target: planeToGround(centerWorld),
    azimuth: -rotation,
    polar: DEFAULT_TOP_POLAR,
    distance: viewHeight * 2,
    viewHeight,
  };
}

/**
 * 三维轨道相机 → 二维相机（取俯视投影到地面平面的等价二维视图）。
 *
 * 与 `camera2DToOrbit` 互逆（在 `polar = DEFAULT_TOP_POLAR` 且 `target.y = 0` 时精确互逆）。
 * 倾斜视角下取的是"地面平面的二维投影"，即二维档永远只表达平面量。
 */
export function orbitToCamera2D(orbit: OrbitCamera, viewportPx: { width: number; height: number }): Camera2D {
  const scale = Math.max(1e-6, Math.max(1, viewportPx.height) / Math.max(1e-6, orbit.viewHeight));
  const rotation = -orbit.azimuth;

  // 目标点的屏幕位置 = 视口中心；反推 pan
  const worldX = orbit.target.x;
  const worldY = orbit.target.z;
  const sx = worldX * scale;
  const sy = worldY * scale;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const pan = {
    x: viewportPx.width / 2 - (sx * cos - sy * sin),
    y: viewportPx.height / 2 - (sx * sin + sy * cos),
  };

  const camera: Camera2D = { scale, pan };
  if (rotation !== 0) camera.rotation = rotation;
  return camera;
}

/**
 * 按极角选择相机 up 向量（三维后端专用，但属"坐标约定"故放 core 单点）。
 *
 * 原因：正俯视时 `up = (0,1,0)` 与视线**平行**，`lookAt` 会退化（产生 NaN）。
 * 惯用做法是俯视档改用 `up = (0,0,-1)`：此时世界 +Z 映射到屏幕下方，
 * 恰好与 `Camera2D` 的"屏幕 Y 向下"一致。
 *
 * @param polar 极角（0 = 正俯视）。
 * @returns 相机 up 向量（三维坐标）。
 */
export function cameraUpForPolar(polar: number): { x: number; y: number; z: number } {
  // 极角小于 ~17° 视为俯视档：用 -Z 作 up，避免与视线平行。
  return polar < 0.3 ? { x: 0, y: 0, z: -1 } : { x: 0, y: 1, z: 0 };
}

/** 把极角夹到安全区间，避免相机贴到极点产生奇异（上限 π/2 = 水平视线）。 */
export function clampPolar(polar: number, min = 0.02, max = Math.PI / 2): number {
  return Math.max(min, Math.min(max, polar));
}

/** 按增量更新轨道相机（纯函数；供后端实现直接复用）。 */
export function orbitPan(orbit: OrbitCamera, deltaWorld: Vec2): OrbitCamera {
  return {
    ...orbit,
    target: { x: orbit.target.x + deltaWorld.x, y: orbit.target.y, z: orbit.target.z + deltaWorld.y },
  };
}

/** 按增量缩放轨道相机（正交档改 viewHeight，透视档改 distance；两者同比）。 */
export function orbitZoom(orbit: OrbitCamera, factor: number): OrbitCamera {
  const f = factor > 0 ? factor : 1;
  return {
    ...orbit,
    viewHeight: Math.max(1e-3, orbit.viewHeight / f),
    distance: Math.max(1e-3, orbit.distance / f),
  };
}

/** 绕目标点旋转轨道相机（弧度增量）。 */
export function orbitRotate(orbit: OrbitCamera, deltaAzimuth: number, deltaPolar = 0): OrbitCamera {
  return {
    ...orbit,
    azimuth: orbit.azimuth + deltaAzimuth,
    polar: clampPolar(orbit.polar + deltaPolar),
  };
}
