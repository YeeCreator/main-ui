/**
 * render-3d/camera-plan —— 相机装配规划（纯数学，无 three 依赖）。
 *
 * 职责：把 core 的统一相机表示（`Camera2D` / `OrbitCamera`）翻译成**相机参数对象**，
 * three 侧只做「按参数 set」。这样做的好处：
 * 1. 二维档预设六条中的「正交投影」「像素比对齐」可在 Node 里断言，无需 GPU；
 * 2. 坐标约定翻转（屏幕 Y 向下 ↔ three Y 向上）在 core 定死，本文件只消费结论。
 */

import type { Camera2D, OrbitCamera, Vec2 } from '@main-ui/core/rendering';
import { camera2DToOrbit, orbitToCamera2D } from '@main-ui/core/rendering';
import type { OrthoPreset } from './units';
import { ORTHO_PRESET } from './units';

/** 正交相机的装配参数（three 侧直接应用）。 */
export interface OrthoCameraPlan {
  kind: 'orthographic';
  /** 视锥左/右/上/下（世界单位，相机空间）。 */
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;
  /** 相机位置与注视点（三维世界坐标）。 */
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  /** 是否启用光照（二维档 = false，场景内不建灯）。 */
  lighting: boolean;
}

/** 透视相机的装配参数（三维档的默认轨道视图）。 */
export interface PerspectiveCameraPlan {
  kind: 'perspective';
  fov: number;
  aspect: number;
  near: number;
  far: number;
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  lighting: boolean;
}

export type CameraPlan = OrthoCameraPlan | PerspectiveCameraPlan;

/**
 * 由轨道相机 + 视口尺寸生成相机装配参数。
 *
 * 关键换算（统一在此处，不散落）：
 * - 相机位置 = target + distance · (sin(polar)·sin(azimuth), cos(polar), sin(polar)·cos(azimuth))
 *   其中 three 的 Y 向上，因此 `polar` 从 +Y 量起；
 * - 正交档的可见高度取 `viewHeight`（**与 distance 解耦**：改 distance 不改画面尺寸）；
 *   宽度按 `aspect` 等比放大，保证不拉伸。
 */
export function planCamera(options: {
  orbit: OrbitCamera;
  viewportPx: { width: number; height: number };
  projection?: 'orthographic' | 'perspective';
  preset?: OrthoPreset;
  /** 透视档 fov（度）；缺省 45。 */
  fovDeg?: number;
}): CameraPlan {
  const { orbit, viewportPx } = options;
  const preset = options.preset ?? ORTHO_PRESET;
  const aspect = viewportPx.width > 0 && viewportPx.height > 0 ? viewportPx.width / viewportPx.height : 1;

  const sinPolar = Math.sin(orbit.polar);
  const cosPolar = Math.cos(orbit.polar);
  const offset = {
    x: orbit.distance * sinPolar * Math.sin(orbit.azimuth),
    y: orbit.distance * cosPolar,
    z: orbit.distance * sinPolar * Math.cos(orbit.azimuth),
  };
  const position = {
    x: orbit.target.x + offset.x,
    y: orbit.target.y + offset.y,
    z: orbit.target.z + offset.z,
  };
  const target = { ...orbit.target };

  // 近/远裁剪面按 viewHeight 与 distance 量级推导，保证不裁掉地面内容。
  const span = Math.max(orbit.viewHeight, orbit.distance) * 2;
  const near = Math.max(0.1, span * 0.001);
  const far = span * 10;

  if ((options.projection ?? 'orthographic') === 'perspective') {
    return {
      kind: 'perspective',
      fov: options.fovDeg ?? 45,
      aspect,
      near,
      far,
      position,
      target,
      lighting: preset.lighting,
    };
  }

  const halfHeight = orbit.viewHeight / 2;
  const halfWidth = halfHeight * aspect;
  return {
    kind: 'orthographic',
    left: -halfWidth,
    right: halfWidth,
    top: halfHeight,
    bottom: -halfHeight,
    near,
    far,
    position,
    target,
    lighting: preset.lighting,
  };
}

/** 由二维相机直接生成二维档相机装配参数（正交俯视）。 */
export function planCamera2D(options: {
  camera: Camera2D;
  viewportPx: { width: number; height: number };
  preset?: OrthoPreset;
}): OrthoCameraPlan {
  const orbit = camera2DToOrbit(options.camera, options.viewportPx);
  const plan = planCamera({ orbit, viewportPx: options.viewportPx, projection: 'orthographic', preset: options.preset });
  // planCamera 在 orthographic 分支必然返回 OrthoCameraPlan；此处显式收敛类型。
  if (plan.kind !== 'orthographic') throw new Error('planCamera2D 必须产出正交档相机');
  return plan;
}

/** 由三维相机装配参数反算二维等价相机（供 `getCamera()` 返回统一表示）。 */
export function planToCamera2D(plan: CameraPlan, viewportPx: { width: number; height: number }, orbit: OrbitCamera): Camera2D {
  // 正交档下二维 scale 由 viewHeight 决定，与相机倾角无关（二维档只看平面量）。
  return orbitToCamera2D(orbit, viewportPx);
}

/** 屏幕点 → 世界平面点（正交俯视档的解析反算；不需要射线）。 */
export function screenToWorldOrtho(options: {
  screen: Vec2;
  plan: OrthoCameraPlan;
  viewportPx: { width: number; height: number };
  screenRotation?: number;
}): Vec2 {
  const { screen, plan, viewportPx } = options;
  const rotation = options.screenRotation ?? 0;
  const worldWidth = plan.right - plan.left;
  const worldHeight = plan.top - plan.bottom;
  // 屏幕像素 → 相机空间（中心为原点，Y 向上）
  const cx = screen.x - viewportPx.width / 2;
  const cy = viewportPx.height / 2 - screen.y;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const rx = cx * cos - cy * sin;
  const ry = cx * sin + cy * cos;
  // 相机空间 → 世界平面（target 为原点）
  const wx = (rx / viewportPx.width) * worldWidth + plan.target.x;
  const wz = (-ry / viewportPx.height) * worldHeight + plan.target.z;
  return { x: wx, y: wz };
}

/** 世界平面点 → 屏幕点（与 `screenToWorldOrtho` 互逆）。 */
export function worldToScreenOrtho(options: {
  world: Vec2;
  plan: OrthoCameraPlan;
  viewportPx: { width: number; height: number };
  screenRotation?: number;
}): Vec2 {
  const { world, plan, viewportPx } = options;
  const rotation = options.screenRotation ?? 0;
  const worldWidth = plan.right - plan.left;
  const worldHeight = plan.top - plan.bottom;
  const nx = ((world.x - plan.target.x) / worldWidth) * viewportPx.width;
  const ny = -((world.y - plan.target.z) / worldHeight) * viewportPx.height;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const rx = nx * cos - ny * sin;
  const ry = nx * sin + ny * cos;
  return { x: rx + viewportPx.width / 2, y: viewportPx.height / 2 - ry };
}
