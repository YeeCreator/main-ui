/**
 * rendering/camera-orientation —— 相机姿态的两种旋转模型（纯数学，无 three 依赖）。
 *
 * ## 两种模型，不是两种参数
 *
 * | | turntable（转盘 / 轨道 / 经纬球） | trackball（轨迹球 / 棱角球） |
 * | --- | --- | --- |
 * | 转轴 | 固定的世界竖直轴 + 水平轴 | **屏幕空间里、垂直于拖拽方向的任意轴** |
 * | 极点 | 有（俯视到顶会卡住 / 翻转） | 无 |
 * | 拖拽轨迹转弯时 | 坐标系不跟 | **坐标系跟着转** |
 * | 会累积 roll | 不会（地平线永远水平） | 会（久了会歪） |
 * | 类比 | 地球仪，经线汇聚两极 | 手里握着的球，怎么搓都行 |
 *
 * 使用者 2026-11-08 的描述正是这个区别：「经纬球那种转法 / 棱角球则是中心对称的，
 * 所以旋转轴似乎也是对称的；光标拖动的时候，如果轨迹是转弯的话，整个坐标系也会跟着转。」
 *
 * 两种都提供，由 `OrbitCamera.orientation` 选择。**trackball 是默认**（见该字段注释），
 * turntable 保留为「地平线始终水平」的安全档。
 *
 * ## 为什么 trackball 必须用四元数
 *
 * 欧拉角（azimuth/polar）的表达力**先天不足以**描述 trackball：
 * 它只能表达「水平转多少 + 抬多高」，第三个自由度（roll）被隐含固定为 0。
 * 一旦绕视线轴转过，欧拉角就无法无奇异（万向锁）地记住了。
 * 四元数没有这个问题 —— 这是它存在的理由。
 *
 * 因此本文件的做法是：**姿态主存四元数**，`azimuth/polar` 由它反算（供 UI 显示与
 * 二维平面换算）；需要精确还原时才用欧拉角。
 */

import type { Vec3Like } from './coordinate-system';
import { cross3 } from './coordinate-system';

/** 单位四元数（`{ x, y, z, w }`，与 three 的 `Quaternion` 同布局，可直接互转）。 */
export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** 单位四元数常量。 */
export const IDENTITY_QUAT: Quat = { x: 0, y: 0, z: 0, w: 1 };

/** 向量加。 */
function add3(a: Vec3Like, b: Vec3Like): Vec3Like {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/** 向量缩放。 */
function scale3(a: Vec3Like, k: number): Vec3Like {
  return { x: a.x * k, y: a.y * k, z: a.z * k };
}

/** 向量长度。 */
export function length3(a: Vec3Like): number {
  return Math.hypot(a.x, a.y, a.z);
}

/** 向量归一化（零向量返回零向量，不抛错，便于在退化输入下保持安全）。 */
export function normalize3(a: Vec3Like): Vec3Like {
  const len = length3(a);
  if (len < 1e-12) return { x: 0, y: 0, z: 0 };
  return { x: a.x / len, y: a.y / len, z: a.z / len };
}

/** 向量点积。 */
export function dot3(a: Vec3Like, b: Vec3Like): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * 由「轴 + 角」构造四元数（右手定则：拇指沿轴正向，四指弯曲方向为正旋转）。
 *
 * @param axis 旋转轴（内部会归一化；零向量返回单位四元数）。
 * @param angle 旋转角（弧度）。
 * @returns 单位四元数。
 */
export function quatFromAxisAngle(axis: Vec3Like, angle: number): Quat {
  const n = normalize3(axis);
  if (n.x === 0 && n.y === 0 && n.z === 0) return { ...IDENTITY_QUAT };
  const half = angle / 2;
  const s = Math.sin(half);
  return { x: n.x * s, y: n.y * s, z: n.z * s, w: Math.cos(half) };
}

/**
 * 四元数乘法 `a · b`（先施加 `b`，再施加 `a`）。
 *
 * 顺序敏感：`a·b ≠ b·a`。本文件所有「累积旋转」都写作
 * `newQuat = delta · oldQuat` —— 即**增量在世界空间里左乘**，
 * 这样拖拽方向与视觉转动方向一致（见 `trackballDeltaQuat` 的说明）。
 *
 * @param a 后施加的旋转。
 * @param b 先施加的旋转。
 * @returns 复合旋转。
 */
export function quatMultiply(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

/** 四元数共轭（= 逆，对单位四元数成立）。 */
export function quatConjugate(q: Quat): Quat {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

/** 四元数归一化（数值漂移后修正；零四元数返回单位四元数）。 */
export function quatNormalize(q: Quat): Quat {
  const len = Math.hypot(q.x, q.y, q.z, q.w);
  if (len < 1e-12) return { ...IDENTITY_QUAT };
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
}

/** 四元数模长（自检用：合法旋转必为 1）。 */
export function quatLength(q: Quat): number {
  return Math.hypot(q.x, q.y, q.z, q.w);
}

/**
 * 用四元数旋转向量（`v' = q · v · q⁻¹` 的展开式，避免构造矩阵）。
 *
 * @param q 单位四元数。
 * @param v 待旋转向量。
 * @returns 旋转后的向量。
 */
export function quatRotate(q: Quat, v: Vec3Like): Vec3Like {
  // t = 2 · (q.xyz × v)
  const qv = { x: q.x, y: q.y, z: q.z };
  const t = scale3(cross3(qv, v), 2);
  // v' = v + q.w · t + q.xyz × t
  return add3(add3(v, scale3(t, q.w)), cross3(qv, t));
}

/**
 * **trackball 的核心**：把屏幕拖拽换算成一根「屏幕空间内的旋转轴 + 角度」。
 *
 * 这是它与 turntable 的本质差别所在：
 *
 * - turntable 把 `dx` 固定映射成「绕世界竖直轴转」、`dy` 映射成「抬降视角」，
 *   所以无论从哪个角度看，横向拖永远是绕同一个世界轴。
 * - trackball 把**拖拽方向本身**当作旋转轴：轴 = 拖拽方向的垂线（在屏幕平面内），
 *   于是「往左拖」就是绕屏幕竖直轴转，「斜着拖」就是绕斜轴转，**轨迹转弯时轴也跟着转**。
 *
 * 这正是使用者说的「棱角球、中心对称、坐标系会跟着转」。
 *
 * 为什么轴取「拖拽方向的垂线」：球面上从 A 点划到 B 点的测地线，
 * 其旋转轴垂直于位移方向。这是虚拟轨迹球的经典公式（Shoemake 1992）。
 *
 * @param deltaX 本次拖拽的水平屏幕位移（CSS 像素，向右为正）。
 * @param deltaY 本次拖拽的垂直屏幕位移（CSS 像素，**向下为正**）。
 * @param radiansPerPixel 每像素的旋转弧度。
 * @param viewRight 屏幕右方向在世界空间中的单位向量。
 * @param viewUp 屏幕上方向在世界空间中的单位向量。
 * @returns 世界空间下的增量四元数；零位移返回单位四元数。
 */
export function trackballDeltaQuat(options: {
  deltaX: number;
  deltaY: number;
  radiansPerPixel?: number;
  viewRight: Vec3Like;
  viewUp: Vec3Like;
}): Quat {
  const perPixel = options.radiansPerPixel ?? 0.01;
  const { deltaX, deltaY } = options;
  const dist = Math.hypot(deltaX, deltaY);
  if (!Number.isFinite(dist) || dist < 1e-9) return { ...IDENTITY_QUAT };

  /**
   * 屏幕位移换到世界空间：
   * - 注意 `deltaY` 是「屏幕向下为正」，而 `viewUp` 是「屏幕上方向」，
   *   故世界位移的竖直分量要取负。
   */
  const move = add3(
    scale3(options.viewRight, deltaX),
    scale3(options.viewUp, -deltaY),
  );

  /**
   * 旋转轴 = **位移方向 × 屏幕法线**（垂直于位移，落在屏幕平面内）。
   *
   * ## 符号为什么是这个顺序
   *
   * 屏幕法线 `normal = right × up`。在右手系里，three 的相机看向自身 −Z，
   * 因此 `right × up = −forward`，即法线指向**观察者**（背离场景）。
   *
   * 球面上从 A 划到 B 的测地线，其旋转轴是 `move × normal`。
   * 若写成 `normal × move`（早期实现），轴恰好反向 180°，
   * 于是**拖拽方向与转动方向相反** —— 使用者两次报告「不跟手」正是这个。
   *
   * 2026-11-08 实测数据（polar=0.6，向右拖 80px）：
   * - `normal × move` 得轴 ≈ `up`，绕它正转使点**向左**走（反向）
   * - `move × normal` 得轴 ≈ `−up`，绕它正转使点**向右**走（跟手）
   */
  const normal = normalize3(cross3(options.viewRight, options.viewUp));
  const axis = cross3(move, normal);

  return quatFromAxisAngle(axis, dist * perPixel);
}

/**
 * **roll 旋转的增量四元数**：绕视线轴转。
 *
 * Blender 在主拖拽里**不提供** roll（turntable 模式），要 roll 得用独立命令
 * 或切 Trackball。本库把这个自由度接到「触控板双指扭转」上 ——
 * 那个手势的语义本来就是「转」，用在 roll 上比用在 yaw 上更贴近直觉。
 *
 * @param angle 旋转角（弧度）。正值 = 顺时针（从相机后面看）。
 * @param viewDir 相机的视线方向（世界空间单位向量，从相机指向场景）。
 * @returns 世界空间下的增量四元数。
 */
export function rollDeltaQuat(angle: number, viewDir: Vec3Like): Quat {
  if (!Number.isFinite(angle) || angle === 0) return { ...IDENTITY_QUAT };
  // 绕视线轴「正转」在视觉上是逆时针，故取负使「正角 = 顺时针」，与使用者预期一致。
  return quatFromAxisAngle(viewDir, -angle);
}

/**
 * 从四元数反算「相机看向哪里」的三个基向量。
 *
 * 约定（与 three 一致）：相机**看向自身 −Z**，`+Y` 是上，`+X` 是右。
 * 姿态四元数描述的是「相机在世界中的朝向」，因此：
 * - `forward = q · (0, 0, −1)`
 * - `up = q · (0, 1, 0)`
 * - `right = q · (1, 0, 0)`
 *
 * @param q 姿态四元数。
 * @returns 世界空间下的前 / 上 / 右三个单位向量。
 */
export function quatToBasis(q: Quat): { forward: Vec3Like; up: Vec3Like; right: Vec3Like } {
  return {
    forward: quatRotate(q, { x: 0, y: 0, z: -1 }),
    up: quatRotate(q, { x: 0, y: 1, z: 0 }),
    right: quatRotate(q, { x: 1, y: 0, z: 0 }),
  };
}

/**
 * 由视线方向 + 世界上方向构造姿态四元数（缺省尊重「尽量保持世界 Y 向上」）。
 *
 * 用途：从 `azimuth/polar` 这类欧拉表示切换到四元数主存时的初值构造。
 *
 * @param forward 视线方向（从相机指向场景）。
 * @param worldUp 世界向上轴（缺省 `(0,1,0)`）。
 * @returns 姿态四元数（相机看 −Z）。
 */
export function quatFromForward(forward: Vec3Like, worldUp: Vec3Like = { x: 0, y: 1, z: 0 }): Quat {
  const f = normalize3(forward);
  if (length3(f) < 1e-9) return { ...IDENTITY_QUAT };

  /**
   * 视线与世界上方向平行时（正俯视 / 正仰视），`up` 无法确定，需换一个参考轴。
   * 这与 `cameraUpForPolar` 处理的是同一个退化情形。
   */
  let upRef = worldUp;
  if (Math.abs(dot3(f, worldUp)) > 0.9999) upRef = { x: 0, y: 0, z: -1 };

  // 相机基：right = normalize(upRef × f')，其中 f' = −forward（相机自身 +Z 反向）
  const back = scale3(f, -1);
  const right = normalize3(cross3(upRef, back));
  const up = cross3(back, right);

  /**
   * 由三个基向量构造四元数（Shepperd 法：挑最大的对角元，避免除零）。
   * 矩阵列 = right, up, back（相机局部轴在世界中的方向）。
   */
  const m00 = right.x, m01 = up.x, m02 = back.x;
  const m10 = right.y, m11 = up.y, m12 = back.y;
  const m20 = right.z, m21 = up.z, m22 = back.z;
  const trace = m00 + m11 + m22;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return quatNormalize({
      w: s / 4,
      x: (m21 - m12) / s,
      y: (m02 - m20) / s,
      z: (m10 - m01) / s,
    });
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return quatNormalize({
      w: (m21 - m12) / s,
      x: s / 4,
      y: (m01 + m10) / s,
      z: (m02 + m20) / s,
    });
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return quatNormalize({
      w: (m02 - m20) / s,
      x: (m01 + m10) / s,
      y: s / 4,
      z: (m12 + m21) / s,
    });
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return quatNormalize({
    w: (m10 - m01) / s,
    x: (m02 + m20) / s,
    y: (m12 + m21) / s,
    z: s / 4,
  });
}
