/**
 * render-3d/camera-plan —— 相机装配规划（纯数学，无 three 依赖）。
 *
 * 职责：把 core 的统一相机表示（`Camera2D` / `OrbitCamera`）翻译成**相机参数对象**，
 * three 侧只做「按参数 set」。这样做的好处：
 * 1. 二维档预设六条中的「正交投影」「像素比对齐」可在 Node 里断言，无需 GPU；
 * 2. 坐标约定翻转（屏幕 Y 向下 ↔ three Y 向上）在 core 定死，本文件只消费结论。
 */

import type { Camera2D, OrbitCamera, Vec2 } from '@main-ui/core/rendering';
import { camera2DToOrbit, orbitBasis, orbitToCamera2D } from '@main-ui/core/rendering';
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
  /**
   * 相机的上方向（可选）。
   *
   * 给了它就用它（trackball / roll 档必须如此），否则由 `cameraUpForPolar` 推导。
   * 这两条路不能混：roll 后的姿态用极角无法表达。
   */
  up?: { x: number; y: number; z: number };
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
  /** 相机上方向（可选；见 `OrthoCameraPlan.up`）。 */
  up?: { x: number; y: number; z: number };
  lighting: boolean;
}

export type CameraPlan = OrthoCameraPlan | PerspectiveCameraPlan;

/**
 * 求「让世界恰好贴边填满容器」的视锥高度（世界单位）。
 *
 * 正交相机满足 `halfHeight = viewHeight/2`、`halfWidth = halfHeight · aspect`。
 * 要完整显示世界，视锥需同时满足两条约束：
 * - `viewHeight >= world.height`（纵向装下）
 * - `viewHeight · aspect >= world.width` ⇒ `viewHeight >= world.width / aspect`（横向装下）
 *
 * 取**较大值** ⇒ 世界恰好贴住较紧的那个边缘，另一维留白（等比不变形的必然代价）。
 *
 * **必须与 `fitToBounds` 使用同一份实现**：这两处一旦各写一份，
 * 就会重现「后端算一套、测试断言另一套」的假绿灯。
 *
 * @param options 容器像素尺寸、世界尺寸与可选留白。
 * @returns 视锥高度（世界单位）。
 * @example
 * fitViewHeightForWorld({ containerPx: { width: 960, height: 445 }, world: { width: 512, height: 512 } })
 * // → 512（高度贴边，横向留白 —— 保持正方形不变形）
 */
export function fitViewHeightForWorld(options: {
  containerPx: { width: number; height: number };
  world: { width: number; height: number };
  paddingPx?: number;
}): number {
  const pad = Math.max(0, options.paddingPx ?? 0);
  const usableW = Math.max(1, options.containerPx.width - pad * 2);
  const usableH = Math.max(1, options.containerPx.height - pad * 2);
  const worldW = Math.max(1, options.world.width);
  const worldH = Math.max(1, options.world.height);
  const aspect = usableW / usableH;
  return Math.max(worldH, worldW / aspect);
}

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

  /**
   * 位置与上方向的来源取决于姿态是否带四元数。
   *
   * - **带 `orientation`**（trackball / roll）：位置沿 `−forward · distance` 走，
   *   上方向取四元数的 `up`。**不能**再用 azimuth/polar 推位置 —— 二者是派生值，
   *   在 roll 情形下无法反推出正确的位置。
   * - **不带**：沿用欧拉角公式（既有行为，逐字节不变）。
   */
  const hasOrientation = Boolean(orbit.orientation);
  let position: { x: number; y: number; z: number };
  let orbitUp: { x: number; y: number; z: number } | undefined;
  if (hasOrientation) {
    const basis = orbitBasis(orbit);
    position = {
      x: orbit.target.x - basis.forward.x * orbit.distance,
      y: orbit.target.y - basis.forward.y * orbit.distance,
      z: orbit.target.z - basis.forward.z * orbit.distance,
    };
    orbitUp = basis.up;
  } else {
    position = {
      x: orbit.target.x + offset.x,
      y: orbit.target.y + offset.y,
      z: orbit.target.z + offset.z,
    };
  }
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
      up: orbitUp,
      lighting: preset.lighting,
    };
  }

  /**
   * 正交视锥必须**保持世界单位等比**：`halfWidth / halfHeight` 固定等于画面宽高比，
   * 否则圆形世界会随容器比例被拉成椭圆。
   *
   * 这里 `halfHeight` 取 `viewHeight/2`，`halfWidth` 由它乘 `aspect` 得出 ——
   * 即「视锥高度以世界单位给定，宽度按屏幕比例展开」，这是正交相机的标准做法。
   * 保证等比的责任在**调用方**（`fitToBounds` 必须让 `viewHeight` 同时容纳
   * 世界宽与高的需求，见那里的注释）。
   */
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
    up: orbitUp,
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

/**
 * 屏幕点 → 世界平面点（正交档解析反算，含**极角补偿**）。
 *
 * 为什么需要 `polar`：相机绕目标点倾斜后，地面平面在屏幕上被
 * `cos(polar)` 压缩（越倾斜，同样一段地面占的屏幕高度越小）。
 * 只按俯视公式反算，会把屏幕点映射到**更远的地面点**，表现为：
 * 「倾斜后点击的位置与实际落点不符」「平移量比手指移动的多」。
 */
export function screenToWorldOrtho(options: {
  screen: Vec2;
  plan: OrthoCameraPlan;
  viewportPx: { width: number; height: number };
  screenRotation?: number;
  /** 相机极角（弧度，从 +Y 量起；0 = 正俯视）。缺省 0 = 俯视档。 */
  polar?: number;
}): Vec2 {
  const { screen, plan, viewportPx } = options;
  const rotation = options.screenRotation ?? 0;
  const cosPolar = Math.max(0.05, Math.cos(options.polar ?? 0));
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
  // 纵向除以 cos(polar)：把「屏幕上被压缩的地面」还原回真实地面距离
  const wz = (-ry / viewportPx.height) * (worldHeight / cosPolar) + plan.target.z;
  return { x: wx, y: wz };
}

/** 世界平面点 → 屏幕点（与 `screenToWorldOrtho` 互逆，含极角补偿）。 */
export function worldToScreenOrtho(options: {
  world: Vec2;
  plan: OrthoCameraPlan;
  viewportPx: { width: number; height: number };
  screenRotation?: number;
  /** 相机极角（弧度，从 +Y 量起；0 = 正俯视）。缺省 0 = 俯视档。 */
  polar?: number;
}): Vec2 {
  const { world, plan, viewportPx } = options;
  const rotation = options.screenRotation ?? 0;
  const cosPolar = Math.max(0.05, Math.cos(options.polar ?? 0));
  const worldWidth = plan.right - plan.left;
  const worldHeight = plan.top - plan.bottom;
  const nx = ((world.x - plan.target.x) / worldWidth) * viewportPx.width;
  // 纵向乘 cos(polar)：地面距离在倾斜视角下按该系数压缩到屏幕
  const ny = -((world.y - plan.target.z) / (worldHeight / cosPolar)) * viewportPx.height;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const rx = nx * cos - ny * sin;
  const ry = nx * sin + ny * cos;
  return { x: rx + viewportPx.width / 2, y: viewportPx.height / 2 - ry };
}
