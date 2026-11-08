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
  quatConjugate,
  quatFromAxisAngle,
  quatFromForward,
  quatMultiply,
  quatNormalize,
  quatRotate,
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
 * 正交投影下「屏幕像素 → 地面世界坐标」的**通用**反投影。
 *
 * ## 为什么需要它（与简化版的区别）
 *
 * 早期实现用的是「屏幕旋转 + `cos(polar)` 纵向压缩」的简化模型：
 *
 * ```
 * rx = R(-rotation) · (screen − center)
 * world = target + (rx / width) · worldWidth,  (−ry / height) · worldHeight / cos(polar)
 * ```
 *
 * 那个模型隐含两个假设：**相机 up 与世界 Y 同向**、**屏幕纵向位移只被地面压缩**。
 * 俯视与常规倾斜下近似成立，但一旦姿态带 roll（轨迹球 / 绕视线自转），
 * 两个假设同时失效 —— 表现为「平移方向错乱」「旋转按下瞬间定位偏移」。
 *
 * ## 本函数的做法
 *
 * 直接用相机的真实基向量做正交反投影，对**任意姿态**精确成立：
 *
 * 1. 屏幕点换算成相机平面内的偏移：`u = 沿 right`、`v = 沿 up`；
 * 2. 射线起点 = `target + u·right + v·up`（正交投影下所有射线平行于 forward）；
 * 3. 沿 `forward` 走到地面平面 `y = 0`，交点即世界坐标。
 *
 * @param options 屏幕点、相机基向量、视锥尺寸与经纬度范围。
 * @returns 地面平面上的世界坐标（`y` 恒为 0）。
 * @example
 * ```ts
 * const { forward, up, right } = orbitBasis(orbit);
 * const world = screenToGroundOrtho({
 *   screen: { x: 300, y: 200 },
 *   basis: { forward, up, right },
 *   target: orbit.target,
 *   halfWidth: orbit.viewHeight / 2 * aspect,
 *   halfHeight: orbit.viewHeight / 2,
 *   viewportPx: { width: 800, height: 600 },
 * });
 * ```
 */
export function screenToGroundOrtho(options: {
  screen: Vec2;
  basis: { forward: Vec3Like; up: Vec3Like; right: Vec3Like };
  target: Vec3Like;
  /** 视锥半宽（世界单位）。 */
  halfWidth: number;
  /** 视锥半高（世界单位）。 */
  halfHeight: number;
  viewportPx: { width: number; height: number };
}): Vec2 {
  const { screen, basis, target, halfWidth, halfHeight, viewportPx } = options;
  const { forward, up, right } = basis;

  // 屏幕像素 → 相机平面偏移（屏幕中心为原点，Y 向上为正）
  const ndcX = viewportPx.width > 0 ? (screen.x - viewportPx.width / 2) / viewportPx.width : 0;
  const ndcY = viewportPx.height > 0 ? (viewportPx.height / 2 - screen.y) / viewportPx.height : 0;
  const u = ndcX * 2 * halfWidth;
  const v = ndcY * 2 * halfHeight;

  // 射线起点（正交投影：所有射线都平行于 forward）
  const origin = {
    x: target.x + right.x * u + up.x * v,
    y: target.y + right.y * u + up.y * v,
    z: target.z + right.z * u + up.z * v,
  };

  /**
   * 视线几乎与地面平行时，射线与地面无交点（或交点在无穷远）。
   * 此时退回 target 的地面投影 —— 宁可给一个稳定的近似值，
   * 也不要返回 NaN/Infinity 污染相机状态。
   */
  if (Math.abs(forward.y) < 1e-6) return { x: target.x, y: target.z };

  const t = -origin.y / forward.y;
  return { x: origin.x + forward.x * t, y: origin.z + forward.z * t };
}

/**
 * `screenToGroundOrtho` 的逆运算：地面世界坐标 → 屏幕像素。
 *
 * 与 `screenToWorldOrtho` 的区别同 `screenToGroundOrtho` 的说明（用真实基向量，
 * 对任意姿态精确）。两个函数互为逆，是本库「屏幕↔世界」的唯一权威换算。
 *
 * @param options 世界点、相机基向量、视锥尺寸与视口像素。
 * @returns 屏幕像素坐标。
 */
export function groundToScreenOrtho(options: {
  world: Vec2;
  basis: { forward: Vec3Like; up: Vec3Like; right: Vec3Like };
  target: Vec3Like;
  halfWidth: number;
  halfHeight: number;
  viewportPx: { width: number; height: number };
}): Vec2 {
  const { world, basis, target, halfWidth, halfHeight, viewportPx } = options;
  const { up, right } = basis;

  // 世界点相对 target 的偏移，投影到相机平面
  const d = { x: world.x - target.x, y: -target.y, z: world.y - target.z };
  const u = d.x * right.x + d.y * right.y + d.z * right.z;
  const v = d.x * up.x + d.y * up.y + d.z * up.z;

  const ndcX = halfWidth > 0 ? u / (2 * halfWidth) : 0;
  const ndcY = halfHeight > 0 ? v / (2 * halfHeight) : 0;
  return {
    x: viewportPx.width / 2 + ndcX * viewportPx.width,
    // 屏幕 Y 向下，相机 up 向上 ⇒ 取负
    y: viewportPx.height / 2 - ndcY * viewportPx.height,
  };
}

/**
 * 绕**任意世界点**旋转（不改变 target 的屏幕位置）。
 *
 * ## 为什么需要它
 *
 * 使用者 2026-11-08 要求「旋转中心改为光标下的点」。最直观的实现是「先把
 * `target` 挪到该点、旋转、再挪回来」——但**先挪那一步会立刻改变画面**
 * （target 是视口中心对应的世界点），表现为「按下左键的瞬间画面跳一下」。
 *
 * 正确做法是只旋转**姿态**，同时按旋转量补偿 target 的位置，使枢轴点
 * 的屏幕位置保持不动：
 *
 * ```
 * 枢轴相对 target 的偏移 d = pivot − target
 * 旋转后应有：pivot 不动 ⇒ target' = pivot − R·d
 * ```
 *
 * 于是 target 确实会移动 —— 但**画面不跳**，因为枢轴点本身没动，
 * 其他点绕它转动。这正是「绕光标转」应有的观感。
 *
 * @param orbit 原相机。
 * @param delta 世界空间下的增量旋转四元数。
 * @param pivot 枢轴（世界地面点；`y` 取 `target.y`）。
 * @returns 新相机。
 */
export function orbitRotateAboutPivot(orbit: OrbitCamera, delta: Quat, pivot: Vec2): OrbitCamera {
  const q = quatNormalize(orbitQuat(orbit));
  const qNext = quatNormalize(quatMultiply(delta, q));

  /**
   * 姿态变化量 `ΔR = qNext · q⁻¹`（世界空间下的「净转动」）。
   *
   * 注意不是直接用 `qNext`：`q` 与 `qNext` 都是「相机朝向」的绝对姿态，
   * 而我们要的是两者之间的**相对转动**。
   */
  const deltaR = quatNormalize(quatMultiply(qNext, quatConjugate(q)));

  /**
   * 枢轴的三维坐标（地面点：高度取 0）。
   *
   * 补偿必须**三维全量**，不能只管 x/z —— 旋转后 `ΔR·d` 会产生垂直分量，
   * 若把 target 的 `y` 钉死在 0，`P − target'` 的垂直分量就对不上，
   * 枢轴仍会沿屏幕纵向漂移（实测偏差 0.03–2.9px，正是这个漏项）。
   */
  const pivot3 = { x: pivot.x, y: 0, z: pivot.y };
  const d = {
    x: pivot3.x - orbit.target.x,
    y: pivot3.y - orbit.target.y,
    z: pivot3.z - orbit.target.z,
  };
  const dRotated = quatRotate(deltaR, d);

  const nextTarget = {
    x: pivot3.x - dRotated.x,
    y: pivot3.y - dRotated.y,
    z: pivot3.z - dRotated.z,
  };

  return withOrientation({ ...orbit, target: nextTarget }, qNext);
}

/**
 * 按屏幕像素位移绕枢轴旋转（转盘 / 轨迹球通吃）。
 *
 * @param orbit 原相机。
 * @param deltaX 水平像素位移（向右为正）。
 * @param deltaY 垂直像素位移（向下为正）。
 * @param pivot 枢轴（世界地面点）。缺省时绕 target 转。
 * @param params 可调参数。
 * @returns 新相机。
 */
export function orbitRotatePixels(
  orbit: OrbitCamera,
  deltaX: number,
  deltaY: number,
  pivot?: Vec2,
  params: TrackballParams = {},
): OrbitCamera {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return orbit;
  if (deltaX === 0 && deltaY === 0) return orbit;

  const pivotPoint = pivot ?? { x: orbit.target.x, y: orbit.target.z };
  const { right, up } = orbitBasis(orbit);

  /** 按模型求增量四元数。 */
  let delta: Quat;
  if (orbit.rotationModel === 'trackball') {
    /**
     * 轨迹球：轴 = 屏幕法线 × 位移方向。
     * **直接吃像素**，不做任何角度折算 —— 这是「跟手」的天然定义：
     * 往左拖，球就朝左滚。
     */
    delta = trackballDeltaQuat({
      deltaX,
      deltaY,
      radiansPerPixel: params.radiansPerPixel,
      viewRight: right,
      viewUp: up,
    });
  } else {
    /**
     * 转盘：横向像素 → 绕世界竖直轴，纵向像素 → 俯仰。
     * **取负**使「拖向哪、内容转向哪」（跟手）：返回的是相机绕行角，
     * 转相机与转物体互为反操作。
     */
    const azimuth = -deltaX * 0.01;
    const polar = -deltaY * 0.006;
    const yaw = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, azimuth);
    // 俯仰绕相机自身右轴（这样倾斜后纵向拖仍符合直觉）
    const pitch = quatFromAxisAngle(right, polar);
    delta = quatMultiply(pitch, yaw);
  }

  return orbitRotateAboutPivot(orbit, delta, pivotPoint);
}

/**
 * 复位到「默认视角」：清姿态、绕回俯视、重置目标与视锥。
 *
 * 使用者 2026-11-08 提的「复位就是恢复到默认的方向、平移和缩放状态」。
 *
 * 与 `orbitResetRoll` 的区别：
 * - `orbitResetRoll` 只清 roll，**保留**当前方位角/极角/目标/缩放；
 * - 本函数是**完整复位**，回到「刚打开时」的样子。
 *
 * @param options 世界范围（决定默认 target、viewHeight 与 distance）。
 * @returns 默认相机。
 */
export function defaultOrbitCamera(options: {
  world: { x: number; y: number; width: number; height: number };
  preset?: number;
  paddingPx?: number;
}): OrbitCamera {
  const { world } = options;
  const pad = Math.max(0, options.paddingPx ?? 0);
  const viewHeight = Math.max(1, world.height + pad * 2);
  return {
    target: { x: world.x + world.width / 2, y: 0, z: world.y + world.height / 2 },
    azimuth: 0,
    polar: clampPolar(options.preset ?? DEFAULT_TOP_POLAR),
    distance: viewHeight * 2,
    viewHeight,
  };
}

/**
 * 聚焦到指定世界范围：**只改平移与缩放，不改朝向**。
 *
 * 使用者 2026-11-08 提的 F 键聚焦。与「复位」的区别：
 * - 复位会连朝向一起归位；
 * - 聚焦保留当前视角（你可能正斜着看），只把画面挪到目标上并缩放到合适大小。
 *
 * 这与 DCC 惯例一致：Blender 的 `Numpad .`（View Selected）就是
 * 「保持视角、把选中物体框满画面」。
 *
 * @param orbit 原相机。
 * @param world 要聚焦的世界范围（地面平面）。
 * @param options 视口宽高比（决定高度是否够装）与留白比例。
 * @returns 新相机。
 */
export function orbitFocus(
  orbit: OrbitCamera,
  world: { x: number; y: number; width: number; height: number },
  options: { aspect?: number; padding?: number } = {},
): OrbitCamera {
  const pad = Math.max(0, options.padding ?? 0.1);
  const aspect = options.aspect && options.aspect > 0 ? options.aspect : 1;
  const worldW = Math.max(1e-6, world.width) * (1 + pad * 2);
  const worldH = Math.max(1e-6, world.height) * (1 + pad * 2);

  /**
   * 与 `fitViewHeightForWorld` 同一判据：视锥需同时装下宽与高，取较大者。
   * 倾斜时纵向被 `cos(polar)` 压缩，故按极角补偿，否则倾斜聚焦后仍会溢出。
   */
  const cosPolar = Math.max(0.05, Math.cos(orbit.polar));
  const viewHeight = Math.max(worldH, worldW / aspect) / cosPolar;

  return {
    ...orbit,
    target: { x: world.x + world.width / 2, y: orbit.target.y, z: world.y + world.height / 2 },
    viewHeight,
    /** `distance` 保证相机站在场景外（正交档下只影响裁剪面）。 */
    distance: Math.max(orbit.distance, viewHeight * 2),
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
