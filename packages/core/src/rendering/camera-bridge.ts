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
import type { Quat } from './camera-orientation';
import {
  length3,
  normalize3,
  quatFromAxisAngle,
  quatFromForward,
  quatMultiply,
  quatNormalize,
  quatToBasis,
  trackballDeltaQuat,
} from './camera-orientation';
import type { Vec3Like } from './coordinate-system';

/** 三维轨道相机（可序列化纯值）。 */
export interface OrbitCamera {
  /** 注视点（三维坐标；二维平面映射后 `y` 通常为 0）。 */
  target: { x: number; y: number; z: number };
  /** 方位角（弧度，绕 Y 轴；0 = 从 +Z 方向看）。 */
  azimuth: number;
  /** 极角（弧度，从 +Y 轴量起；π/2 = 水平视线，0 = 俯视正上方）。 */
  polar: number;
  /**
   * 相机到 target 的距离。
   *
   * ⚠️ 与 `viewHeight` 的关系是**派生量**：两者总是一起同比缩放（见 `orbitZoom`），
   * 因此不要假设 `distance` 可以独立表达「拉远但不变焦」——正交档下画面尺寸只由
   * `viewHeight` 决定，`distance` 仅影响裁剪面与透视档的视觉距离。
   */
  distance: number;
  /**
   * 正交档下可见高度（世界单位）。
   *
   * 与 `distance` 分开而非复用：正交投影的缩放只由视锥高度决定，
   * 改 `distance` 不影响画面尺寸（但影响裁剪面）。
   */
  viewHeight: number;
  /**
   * 姿态四元数（可选）。**给了它就以它为准**，`azimuth/polar` 降为派生只读值。
   *
   * ## 为什么需要它
   *
   * `azimuth + polar` 只有两个自由度，**先天表达不了 roll**（绕视线轴的自转）。
   * turntable 模式把 roll 隐含固定为 0，所以欧拉表示够用；一旦要支持
   * trackball（虚拟轨迹球，转轴随拖拽方向变化、轨迹转弯时坐标系跟着转），
   * 欧拉角就会在极点处万向锁，无法无歧义地记住姿态。
   *
   * 因此三维姿态的主存形式是四元数。缺省 `undefined` 时按 `azimuth/polar`
   * 构造 —— 既有的二位参数用法完全不变。
   */
  orientation?: Quat;
  /**
   * 旋转模型。缺省 `'turntable'`。
   *
   * - `'turntable'`（缺省）：转盘。只改方位角与极角，**地平线永远水平**、
   *   不累积 roll、有极点。Blender / Maya 的默认档，也是「不会迷失方向」的稳妥默认。
   * - `'trackball'`：虚拟轨迹球。转轴垂直于拖拽方向、随轨迹转弯而变，
   *   无极点、可累积 roll。使用者 2026-11-08 描述的「棱角球 / 中心对称 /
   *   坐标系跟着转」就是这个档。
   *
   * **为什么缺省不是 trackball**：trackball 会累积 roll，转久了画面会歪，
   * 需要额外的复位操作。它适合被显式选用（使用者知道自己要什么），
   * 不适合作为无意识的默认值 —— 这也正是 Blender 把它放在偏好设置里的原因。
   */
  rotationModel?: 'trackball' | 'turntable';
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
 * - `rotation` 与 `azimuth` 同号（二维顺时针 = 绕 Y 轴负向，故取负）；
 * - **`polar` 由此处传递**：相机给了就用它，否则退回俯视档。
 *   不传递的话，每次 `setCamera()` 都会把三维倾斜视角重置回俯视，
 *   于是「切成三维」在契约层无法保持。
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
  // 相机自带极角就用它（三维档）；否则退回俯视档（二维档行为不变）
  const polar = clampPolar(
    typeof camera.polar === 'number' && Number.isFinite(camera.polar)
      ? camera.polar
      : DEFAULT_TOP_POLAR,
  );

  return {
    target: planeToGround(centerWorld),
    azimuth: -rotation,
    polar,
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
  // 极角同步回去：否则「倾斜看」一旦经过一次二维往返就被抹平成俯视。
  // 只在非俯视档写入，使俯视档产出仍是纯粹的 `{ scale, pan }`（旧形状不变）。
  const polar = clampPolar(orbit.polar);
  if (Math.abs(polar - DEFAULT_TOP_POLAR) > 1e-6) camera.polar = polar;
  return camera;
}

/**
 * 由 `azimuth/polar` 推导相机在目标点周围的**视线方向**（从相机指向 target）。
 *
 * 相机位置 = `target + distance · (sin p · sin a, cos p, sin p · cos a)`，
 * 故视线方向 = 该偏移的**反向**。
 *
 * @param azimuth 方位角（弧度）。
 * @param polar 极角（弧度，从 +Y 轴量起；0 = 正俯视）。
 * @returns 世界空间单位向量（从相机指向场景）。
 */
export function viewDirectionFromOrbit(azimuth: number, polar: number): Vec3Like {
  const sinPolar = Math.sin(polar);
  return normalize3({
    x: -sinPolar * Math.sin(azimuth),
    y: -Math.cos(polar),
    z: -sinPolar * Math.cos(azimuth),
  });
}

/**
 * 由视线方向反算 `azimuth/polar`（`viewDirectionFromOrbit` 的逆）。
 *
 * 极角从 +Y 轴量起，故 `polar = acos(−forward.y)`；方位角由 `forward` 在 XZ 平面
 * 的投影反解，与正向公式同源。
 *
 * @param forward 视线方向（从相机指向场景；内部会归一化）。
 * @returns 方位角与极角（弧度）。
 */
export function orbitAnglesFromViewDirection(forward: Vec3Like): { azimuth: number; polar: number } {
  const f = normalize3(forward);
  // 正向公式里 y = −cos(polar)，故 polar = acos(−f.y)
  const polar = Math.acos(Math.max(-1, Math.min(1, -f.y)));
  // xz 投影反解方位角：x = −sin p·sin a，z = −sin p·cos a
  const azimuth = Math.atan2(-f.x, -f.z);
  return { azimuth, polar };
}

/**
 * 取相机的姿态四元数（缺省由 `azimuth/polar` 构造）。
 *
 * 约定：四元数描述**相机在世界中的朝向**，相机看向自身 −Z（three 惯例）。
 *
 * @param orbit 轨道相机。
 * @returns 单位四元数。
 */
export function orbitQuat(orbit: OrbitCamera): Quat {
  if (orbit.orientation && length3({ x: orbit.orientation.x, y: orbit.orientation.y, z: orbit.orientation.z }) >= 0 && Number.isFinite(orbit.orientation.w)) {
    return quatNormalize(orbit.orientation);
  }
  const forward = viewDirectionFromOrbit(orbit.azimuth, orbit.polar);
  return quatFromForward(forward);
}

/**
 * 取相机看向哪里（视线方向 + 上方向 + 右方向）。
 *
 * @param orbit 轨道相机。
 * @returns 世界空间下的前 / 上 / 右三个单位向量。
 */
export function orbitBasis(orbit: OrbitCamera): { forward: Vec3Like; up: Vec3Like; right: Vec3Like } {
  return quatToBasis(orbitQuat(orbit));
}

/**
 * 用新的姿态四元数更新轨道相机，并把 `azimuth/polar` 同步为派生值。
 *
 * **`azimuth/polar` 不删除而是持续同步**：它们仍被二维平面换算
 * （`orbitToCamera2D` 的 `rotation`、`cameraUpForPolar` 的档位判断）以及
 * 小地图罗盘消费。让它们始终反映当前姿态，那些使用方无需改造。
 *
 * @param orbit 原相机。
 * @param orientation 新姿态。
 * @returns 新相机（不改原对象）。
 */
export function withOrientation(orbit: OrbitCamera, orientation: Quat): OrbitCamera {
  const q = quatNormalize(orientation);
  const { forward } = quatToBasis(q);
  const { azimuth, polar } = orbitAnglesFromViewDirection(forward);
  return { ...orbit, orientation: q, azimuth, polar };
}

/** 模拟球面上一点在视口内的二维坐标。 */
export interface TrackballParams {
  /** 每像素对应的旋转弧度。 */
  radiansPerPixel?: number;
}

/**
 * trackball 拖拽 → 新姿态。
 *
 * 屏幕右/上方向取自**当前姿态**，因此转轴随视角变化 ——
 * 这是「轨迹转弯时整个坐标系跟着转」的来源。
 *
 * @param orbit 原相机。
 * @param deltaX 水平位移（CSS 像素，向右为正）。
 * @param deltaY 垂直位移（CSS 像素，向下为正）。
 * @param params 可调参数。
 * @returns 新相机。
 */
export function orbitTrackball(
  orbit: OrbitCamera,
  deltaX: number,
  deltaY: number,
  params: TrackballParams = {},
): OrbitCamera {
  const { right, up } = orbitBasis(orbit);
  const delta = trackballDeltaQuat({
    deltaX,
    deltaY,
    radiansPerPixel: params.radiansPerPixel,
    viewRight: right,
    viewUp: up,
  });
  // 增量左乘 = 在世界空间里转（而非相机局部空间），这样拖拽方向与视觉转动方向一致
  return withOrientation(orbit, quatMultiply(delta, orbitQuat(orbit)));
}

/**
 * 绕视线轴 roll（自转）→ 新姿态。
 *
 * @param orbit 原相机。
 * @param angle 旋转角（弧度；正 = 顺时针）。
 * @returns 新相机。
 */
export function orbitRoll(orbit: OrbitCamera, angle: number): OrbitCamera {
  if (!Number.isFinite(angle) || angle === 0) return orbit;
  const { forward } = orbitBasis(orbit);
  const delta = quatFromAxisAngle(forward, -angle);
  return withOrientation(orbit, quatMultiply(delta, orbitQuat(orbit)));
}

/**
 * 把姿态重置为「地平线水平」（清掉累积的 roll）。
 *
 * 用途：turntable 模式天然不会累积 roll，但 trackball 会。提供一个显式复位入口，
 * 对应 Blender 的 `View > Align View > Top` 一类操作。
 *
 * @param orbit 原相机。
 * @returns 新相机（姿态由 `azimuth/polar` 重新构造，roll 归零）。
 */
export function orbitResetRoll(orbit: OrbitCamera): OrbitCamera {
  const { azimuth, polar } = orbitAnglesFromViewDirection(orbitBasis(orbit).forward);
  const clean: OrbitCamera = { ...orbit, azimuth, polar };
  delete clean.orientation;
  return withOrientation(clean, quatFromForward(viewDirectionFromOrbit(azimuth, polar)));
}

/**
 * 把世界三轴投影成「屏幕平面上的二维向量」（供小地图的坐标轴 gizmo 用）。
 *
 * ## 为什么要单独算
 *
 * 小地图上的三色箭头要能让使用者**一眼看出当前姿态**：俯视时 Y 轴几乎消失、
 * 侧视时 Y 轴最长。要做到这点，箭头必须真的反映「该轴在屏幕平面上的分量」，
 * 而不是三条画死的固定方向线。
 *
 * 做法（正交投影，不做透视缩短）：把每个世界轴向量分别点乘相机的
 * `right` 与 `up` 基向量，得到它在屏幕上的 `(x, y)` 分量。
 * 屏幕坐标 `y` 向下，而相机 `up` 向上，故 `y` 取负。
 *
 * 结果向量长度 = 该轴对镜头的「可见程度」：正对镜头时为 0（退化成一个点）。
 *
 * @param orbit 轨道相机。
 * @returns 三个世界轴在屏幕平面的投影（单位：与输入同尺度，1 = 满长）。
 * @example
 * ```ts
 * // 正俯视：Y 轴朝镜头 ⇒ 长度≈0；X/Z 各占一半
 * const axes = projectWorldAxes(orbit);
 * ```
 */
export function projectWorldAxes(orbit: OrbitCamera): {
  x: Vec2;
  y: Vec2;
  z: Vec2;
} {
  const { right, up } = orbitBasis(orbit);
  const proj = (axis: Vec3Like): Vec2 => ({
    x: axis.x * right.x + axis.y * right.y + axis.z * right.z,
    // 屏幕 y 向下，相机 up 向上 ⇒ 取负
    y: -(axis.x * up.x + axis.y * up.y + axis.z * up.z),
  });
  return {
    x: proj({ x: 1, y: 0, z: 0 }),
    y: proj({ x: 0, y: 1, z: 0 }),
    z: proj({ x: 0, y: 0, z: 1 }),
  };
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

/**
 * 按增量缩放轨道相机（正交档改 viewHeight，透视档改 distance；两者同比）。
 *
 * 这是**以 target 为中心**的缩放。要把缩放中心改到光标处，用
 * `orbitZoomAtPoint`。
 *
 * @param orbit 原相机。
 * @param factor 缩放倍率（>1 放大）。
 * @returns 新相机。
 */
export function orbitZoom(orbit: OrbitCamera, factor: number): OrbitCamera {
  const f = factor > 0 ? factor : 1;
  return {
    ...orbit,
    viewHeight: Math.max(1e-3, orbit.viewHeight / f),
    distance: Math.max(1e-3, orbit.distance / f),
  };
}

/**
 * **以指定世界点为锚**缩放：锚点在屏幕上的位置保持不动。
 *
 * 使用者 2026-11-08 提的「缩放中心改为光标映射的方向为中心点」。
 *
 * 原理：缩放后视锥变小/变大，若 target 不动，除 target 外所有点都会相对屏幕中心
 * 位移。要让锚点屏幕位置不变，需按「锚点相对 target 的偏移 × (1 − 1/f)」反推 target。
 *
 * 数学（正交档，俯视时精确、倾斜时按地面投影近似）：
 * ```
 * 缩放前：anchorScreen = targetScreen + (anchorWorld − target) · scale
 * 缩放后：要求 anchorScreen 不变，而 scale' = scale · f
 *   ⇒ (anchorWorld − target) · scale = (anchorWorld − target') · scale · f
 *   ⇒ target' = target + (anchorWorld − target) · (1 − 1/f)
 * ```
 *
 * @param orbit 原相机。
 * @param factor 缩放倍率（>1 放大）。
 * @param anchorWorld 锚点的世界坐标（地面平面，`y` 忽略）。
 * @returns 新相机。
 */
export function orbitZoomAtPoint(orbit: OrbitCamera, factor: number, anchorWorld: Vec2): OrbitCamera {
  const f = factor > 0 ? factor : 1;
  if (f === 1) return orbit;
  const zoomed = orbitZoom(orbit, f);
  // 锚点相对 target 的地面偏移
  const dx = anchorWorld.x - orbit.target.x;
  const dz = anchorWorld.y - orbit.target.z;
  const k = 1 - 1 / f;
  return {
    ...zoomed,
    target: { x: orbit.target.x + dx * k, y: orbit.target.y, z: orbit.target.z + dz * k },
  };
}

/**
 * 绕目标点旋转轨道相机（弧度增量）。
 *
 * **按 `rotationModel` 分派（缺省 turntable）**：
 * - `'turntable'`：只改方位角与极角，地平线永远水平。
 * - `'trackball'`：按屏幕拖拽方向求转轴，可累积 roll、无极点。
 *
 * 注意 trackball 分支用的是**像素位移**，故参数语义与 turntable 分支不同 ——
 * 因此本函数在 trackball 档下把弧度折算回像素，保持对外契约一致。
 *
 * @param orbit 原相机。
 * @param deltaAzimuth 方位角增量（弧度）—— turntable 直接用它；trackball 折算为横向像素。
 * @param deltaPolar 极角增量（弧度）—— turntable 用它；trackball 折算为纵向像素。
 * @returns 新相机。
 */
export function orbitRotate(orbit: OrbitCamera, deltaAzimuth: number, deltaPolar = 0): OrbitCamera {
  if (orbit.rotationModel === 'trackball') {
    /**
     * trackball 需要「像素位移」而非「角度」。这里按缺省灵敏度反折算，
     * 使上游（模板层）不必知道自己接的是哪种模型 —— 它只需给出角度增量。
     * 0.01 rad/px 是 `trackballDeltaQuat` 的缺省值，此处保持一致。
     */
    const pxPerRad = 100;
    return orbitTrackball(orbit, deltaAzimuth * pxPerRad, -deltaPolar * pxPerRad);
  }
  const next: OrbitCamera = {
    ...orbit,
    azimuth: orbit.azimuth + deltaAzimuth,
    polar: clampPolar(orbit.polar + deltaPolar),
  };
  // turntable 档显式清掉四元数，否则姿态仍被旧四元数占据、角度改动不生效
  delete next.orientation;
  return next;
}
