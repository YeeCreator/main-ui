/**
 * rendering/coordinate-system —— 三维坐标系四大类的显式声明与互换（纯函数）。
 *
 * ## 为什么需要这个文件
 *
 * 三维里「坐标系」不是一个选项，而是**两个正交的二选一**：
 *
 * | 维度 | 取值 |
 * | --- | --- |
 * | 手性 | 右手 / 左手 |
 * | 向上轴 | Y up / Z up |
 *
 * 两两组合得到四类，业界各有其代表：
 *
 * | | **Y up** | **Z up** |
 * | --- | --- | --- |
 * | **右手** | three.js · glTF · OpenGL · SceneKit/RealityKit（苹果） · Maya · Godot | Blender · 3ds Max |
 * | **左手** | Unity · DirectX | Unreal Engine |
 *
 * 本库选 **右手 + Y up**（与 three.js 一致，转换成本为零）。
 *
 * ## 换算不要背矩阵，记「两步法」
 *
 * 任何一类换到任何另一类，都是下面两步的组合，且**顺序不可交换**：
 *
 * 1. **统一手性** —— 源是左手则翻转**一个**轴（惯例翻 Z）：`(x, y, −z)`
 * 2. **统一向上轴** —— 源是 Z up 则绕 X 轴 −90°：`(x, y, z) → (x, z, −y)`
 *
 * 手性可以自己验，不必查表：**`X × Y` 等于 `Z` 就是右手**。
 *
 * @example
 * ```ts
 * // Blender（右手 Z up）→ three.js（右手 Y up）
 * toThreeAxis({ x: 1, y: 2, z: 3 }, { handedness: 'right', up: 'z' });
 * // → { x: 1, y: 3, z: -2 }
 *
 * // Unity（左手 Y up）→ three.js
 * toThreeAxis({ x: 1, y: 2, z: 3 }, { handedness: 'left', up: 'y' });
 * // → { x: 1, y: 2, z: -3 }
 * ```
 */

/** 三维向量（本文件不依赖 three，自带最小类型）。 */
export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** 手性：右手定则（right）或左手定则（left）。 */
export type Handedness = 'right' | 'left';

/** 向上轴。 */
export type UpAxis = 'y' | 'z';

/** 一个坐标系的完整声明。 */
export interface CoordinateSystem {
  handedness: Handedness;
  up: UpAxis;
}

/** 本库内部统一使用的坐标系（与 three.js 一致）。 */
export const THREE_LIKE: CoordinateSystem = { handedness: 'right', up: 'y' };

/** 业界的四类代表（供宿主声明用，不做逻辑分支）。 */
export const KNOWN_SYSTEMS = {
  /** three.js / glTF / OpenGL / SceneKit / RealityKit / Maya / Godot */
  threeLike: THREE_LIKE,
  /** Blender / 3ds Max */
  blender: { handedness: 'right', up: 'z' } as CoordinateSystem,
  /** Unity / DirectX */
  unity: { handedness: 'left', up: 'y' } as CoordinateSystem,
  /** Unreal Engine */
  unreal: { handedness: 'left', up: 'z' } as CoordinateSystem,
} as const;

/** 向量叉积。 */
export function cross3(a: Vec3Like, b: Vec3Like): Vec3Like {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/**
 * 自检：给定基向量是否构成右手系。
 *
 * 判据：`X × Y` 与 `Z` 同向（点积 > 0）。**这是唯一不查表就能验的办法**，
 * 也用于单测守住「装配出来的旋转是合法旋转」。
 *
 * @param x 基向量的 X 轴。
 * @param y 基向量的 Y 轴。
 * @param z 基向量的 Z 轴。
 * @returns 是否右手系。
 */
export function isRightHanded(x: Vec3Like, y: Vec3Like, z: Vec3Like): boolean {
  const c = cross3(x, y);
  return c.x * z.x + c.y * z.y + c.z * z.z > 0;
}

/**
 * 把一个任意坐标系下的向量换算到 three.js 语义（右手 + Y up）。
 *
 * 实现就是「两步法」，顺序为：先翻手性，再转向上轴。
 *
 * @param v 源坐标系下的向量。
 * @param from 源坐标系声明。
 * @returns three.js 语义下的向量。
 * @example
 * ```ts
 * toThreeAxis({ x: 1, y: 2, z: 3 }, KNOWN_SYSTEMS.blender); // { x: 1, y: 3, z: -2 }
 * ```
 */
export function toThreeAxis(v: Vec3Like, from: CoordinateSystem): Vec3Like {
  // 第一步：统一手性（左手翻 Z）
  let { x, y, z } = v;
  if (from.handedness === 'left') z = -z;
  // 第二步：统一向上轴（Z up 绕 X 轴 -90°）
  if (from.up === 'z') {
    return { x, y: z, z: -y };
  }
  return { x, y, z };
}

/**
 * `toThreeAxis` 的逆变换（three.js 语义 → 目标坐标系）。
 *
 * 逆变换按**相反顺序**执行两步：先逆向转向上轴，再逆向翻手性。
 *
 * @param v three.js 语义下的向量。
 * @param to 目标坐标系声明。
 * @returns 目标坐标系下的向量。
 */
export function fromThreeAxis(v: Vec3Like, to: CoordinateSystem): Vec3Like {
  let { x, y, z } = v;
  // 逆向第二步：Z up 的逆仍是绕 X 轴 +90°（-90° 的逆）
  if (to.up === 'z') {
    const ny = -z;
    const nz = y;
    y = ny;
    z = nz;
  }
  // 逆向第一步：翻 Z 是自逆运算
  if (to.handedness === 'left') z = -z;
  return { x, y, z };
}

/**
 * 该坐标系下「地面平面」是哪两个轴张成的。
 *
 * 用途：把二维世界的 `(x, y)` 映射到三维时，需要知道「哪两个轴是地面」。
 * Y up 的地面是 `XZ`；Z up 的地面是 `XY`。
 *
 * @param system 坐标系声明。
 * @returns 地面平面的两个轴名（第一个恒为 `x`）。
 * @example
 * groundAxes(KNOWN_SYSTEMS.threeLike); // ['x', 'z']
 * groundAxes(KNOWN_SYSTEMS.blender);   // ['x', 'y']
 */
export function groundAxes(system: CoordinateSystem): ['x', 'y' | 'z'] {
  return ['x', system.up === 'y' ? 'z' : 'y'];
}
