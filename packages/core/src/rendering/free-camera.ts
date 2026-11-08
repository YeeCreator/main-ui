/**
 * rendering/free-camera —— 自由相机（Fly / First-Person）的纯数学。
 *
 * ## 与轨道相机（`OrbitCamera`）的本质差别
 *
 * | | OrbitCamera（轨道） | FreeCamera（自由） |
 * | --- | --- | --- |
 * | 状态 | `target` + `distance` + 角度 | **`position` + `yaw` + `pitch` + `roll`** |
 * | 语义 | 「**看着** target」 | 「**朝向**某个方向」 |
 * | 能仰头看天吗 | **不能**（永远注视 target） | **能** |
 * | 能穿到物体后面吗 | 不能（只能绕） | 能（自由平移） |
 * | 代表 | Blender 默认、Maya 默认 | UE 视口、Unity Scene、Blender Walk Navigation |
 *
 * 之所以要另立一套而不是复用 `OrbitCamera`：
 * `OrbitCamera` 的 `polar` 被 `clampPolar` 夹在 `[0.02, π/2]` 内，永远到不了
 * 「仰头看天」那一侧；而 `target` 是「注视点」而非「相机位置」，
 * 自由平移会改变的是相机而非注视点，语义无法用一套字段表达。
 *
 * ## 术语（与 UE 对齐）
 *
 * | 操作 | 名称 | 改什么 |
 * | --- | --- | --- |
 * | `W` / `S` | Move Forward / Backward（Dolly） | `position` 沿 sight |
 * | `A` / `D` | Strafe | `position` 沿 right |
 * | `Q` / `E` | Move Up / Down（Pedestal） | `position` 沿 world up |
 * | 鼠标左右 | Look Around · **Yaw** | `yaw` |
 * | 鼠标上下 | Look Around · **Pitch** | `pitch` |
 * | （本库额外） | **Roll** | `roll` |
 */

import type { Vec2 } from './camera';
import type { Quat } from './camera-orientation';
import {
  normalize3,
  quatConjugate,
  quatFromAxisAngle,
  quatMultiply,
  quatNormalize,
  quatRotate,
  quatToBasis,
} from './camera-orientation';
import type { Vec3Like } from './coordinate-system';

/**
 * 自由相机（可序列化纯值）。
 *
 * ## 为什么用「yaw / pitch / roll」而不是直接存四元数
 *
 * 两个原因：
 *
 * 1. **可读、可调试**：`{ yaw: 0.3, pitch: -0.1 }` 一眼看懂朝向；
 *    四元数没法目测。
 * 2. **pitch 需要夹取**：飞行模式下仰角必须限制在 `±(π/2 − ε)` 以内，
 *    否则接近垂直时 yaw 失去意义（万向锁），表现为「向上看到一定角度就转不动了」。
 *    存欧拉角时夹取是自然的一步；存四元数则要反解再夹再重建，绕远路。
 *
 * 需要四元数时由 `freeQuat` 现算 —— 那是纯函数，没有累积误差。
 */
export interface FreeCamera {
  /** 相机位置（世界坐标；`y` 为高度）。 */
  position: Vec3Like;
  /** 偏航（绕世界 Y 轴；0 = 朝 −Z 看，与 three 的相机默认朝向一致）。 */
  yaw: number;
  /** 俯仰（正值 = 抬头向上；夹在 ±(π/2 − ε)）。 */
  pitch: number;
  /** 横滚（绕视线轴；缺省 0）。 */
  roll?: number;
  /**
   * 移动速度（世界单位 / 秒）。
   *
   * Fly 模式**按时间积分**而不是「每帧固定步长」：后者在 120Hz 屏上会快一倍。
   */
  speed?: number;
}

/** pitch 的最大绝对值：留 ε 避免与 y 轴平行导致 yaw 退化。 */
export const MAX_PITCH = Math.PI / 2 - 0.01;

/** 默认移动速度（世界单位 / 秒）。 */
export const DEFAULT_FLY_SPEED = 400;

/** 夹取俯仰到安全区间。 */
export function clampPitch(pitch: number): number {
  if (!Number.isFinite(pitch)) return 0;
  return Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
}

/**
 * 由自由相机算出姿态四元数（相机看向自身 −Z）。
 *
 * 组合顺序 `yaw · pitch · roll` 是**内旋**（intrinsic）——先绕世界 Y 转，
 * 再绕转完后的自身 X 转，最后绕自身 Z 转。这与飞行操作用的直觉一致：
 * 「先决定朝哪个方位，再抬头低头，最后歪脑袋」。
 *
 * @param camera 自由相机。
 * @returns 单位四元数。
 */
export function freeQuat(camera: FreeCamera): Quat {
  const yaw = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, camera.yaw);
  const pitch = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, camera.pitch);
  const roll = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, camera.roll ?? 0);
  // 内旋：q = yaw · pitch · roll（右乘 = 在已转好的局部坐标系里继续转）
  return quatNormalize(quatMultiply(quatMultiply(yaw, pitch), roll));
}

/**
 * 取自由相机的三个基向量（世界空间）。
 *
 * - `forward`：视线方向（相机自身 −Z）
 * - `up`：自身 +Y（受 roll 影响）
 * - `right`：自身 +X
 *
 * @param camera 自由相机。
 * @returns 前 / 上 / 右三个单位向量。
 */
export function freeBasis(camera: FreeCamera): { forward: Vec3Like; up: Vec3Like; right: Vec3Like } {
  return quatToBasis(freeQuat(camera));
}

/** 自由相机能响应哪些移动方向。 */
export interface FlyInput {
  /** 沿视线前进（+1）/ 后退（−1）。`W` / `S`。 */
  forward?: number;
  /** 向右平移（+1）/ 向左（−1）。`A` / `D`。 */
  strafe?: number;
  /** 垂直上升（+1）/ 下降（−1）。`Q` / `E`。 */
  elevate?: number;
  /** 偏航增量（弧度）。鼠标左右。 */
  yawDelta?: number;
  /** 俯仰增量（弧度）。鼠标上下。 */
  pitchDelta?: number;
  /** 横滚增量（弧度）。 */
  rollDelta?: number;
}

/**
 * 施加飞行输入（**按时间积分**）。
 *
 * ## 为什么垂直移动用世界 Y，而不用相机自身 up
 *
 * UE 的 `Q`/`E` 是**世界竖直**升降（Pedestal），不是沿相机自身 up。
 * 差别在抬头时最明显：若沿自身 up，「抬头 60 度后按 E」会斜着飞出去；
 * 而世界竖直升降始终是「原地升高」，符合「我站在这儿往上抬」的直觉。
 *
 * 唯一例外是 roll 之后 —— 那时自身 up 与世界 Y 已不同向，但 `Q`/`E`
 * **仍然走世界 Y**，因为「升降」这个概念属于世界，不属于相机。
 *
 * @param camera 原相机。
 * @param input 输入增量。
 * @param dtSeconds 距上一帧的秒数（**不要传固定值**：帧率不同速度会不同）。
 * @returns 新相机。
 */
export function applyFlyInput(camera: FreeCamera, input: FlyInput, dtSeconds: number): FreeCamera {
  const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds : 0;
  const speed = camera.speed && camera.speed > 0 ? camera.speed : DEFAULT_FLY_SPEED;
  const { forward, right } = freeBasis(camera);

  // ---- 视角增量（不依赖 dt：鼠标位移本身就是增量）----
  const nextYaw = camera.yaw + (input.yawDelta ?? 0);
  const nextPitch = clampPitch(camera.pitch + (input.pitchDelta ?? 0));
  const nextRoll = (camera.roll ?? 0) + (input.rollDelta ?? 0);

  // ---- 位置增量（按 dt 积分）----
  const step = speed * dt;
  const move = { x: 0, y: 0, z: 0 };
  const f = input.forward ?? 0;
  const s = input.strafe ?? 0;
  const u = input.elevate ?? 0;
  if (f !== 0) {
    move.x += forward.x * f * step;
    move.y += forward.y * f * step;
    move.z += forward.z * f * step;
  }
  if (s !== 0) {
    move.x += right.x * s * step;
    move.y += right.y * s * step;
    move.z += right.z * s * step;
  }
  if (u !== 0) {
    // 世界竖直：与相机朝向无关
    move.y += u * step;
  }

  return {
    ...camera,
    position: {
      x: camera.position.x + move.x,
      y: camera.position.y + move.y,
      z: camera.position.z + move.z,
    },
    yaw: nextYaw,
    pitch: nextPitch,
    roll: nextRoll,
  };
}

/**
 * 轨道相机 → 自由相机（切换模式时保持画面连续）。
 *
 * 取轨道相机的**当前位置与朝向**作为自由相机的初值 —— 于是切换的瞬间
 * 画面完全不变，使用者察觉不到「换了套状态」。
 *
 * @param orbitTarget 轨道相机的注视点。
 * @param orbitPosition 轨道相机的相机位置。
 * @param orbitBasis 轨道相机的基向量（前 / 上 / 右）。
 * @returns 自由相机（yaw/pitch 由 forward 反解，roll 由 up 反解）。
 */
export function freeFromOrbitPose(options: {
  position: Vec3Like;
  basis: { forward: Vec3Like; up: Vec3Like; right: Vec3Like };
  speed?: number;
}): FreeCamera {
  const { position, basis } = options;
  const f = normalize3(basis.forward);

  /**
   * 由 forward 反解 yaw/pitch。
   *
   * 相机看向自身 −Z，故 `forward = (−sinψ·cosθ, sinθ, −cosψ·cosθ)`
   * （ψ = yaw，θ = pitch）。反过来：
   * - `pitch = asin(forward.y)`
   * - `yaw = atan2(−forward.x, −forward.z)`
   */
  const pitch = clampPitch(Math.asin(Math.max(-1, Math.min(1, f.y))));
  const yaw = Math.atan2(-f.x, -f.z);

  /**
   * roll 由 up 反解：把「当前 up」用「去 roll 后的姿态」逆变换回局部空间，
   * 其在局部 XY 平面内的角度就是 roll。
   */
  const noRoll = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, yaw);
  const noRollPitch = quatMultiply(noRoll, quatFromAxisAngle({ x: 1, y: 0, z: 0 }, pitch));
  const upLocal = quatRotate(quatConjugate(noRollPitch), normalize3(basis.up));
  const roll = Math.atan2(upLocal.x, upLocal.y);

  return {
    position: { ...position },
    yaw,
    pitch,
    roll: Math.abs(roll) < 1e-9 ? undefined : roll,
    speed: options.speed,
  };
}

/**
 * 自由相机 → 轨道相机的注视点（用于把自由相机投影回轨道语义）。
 *
 * 取「相机前方 `distance` 处」作为注视点。这样切回轨道模式时，
 * 相机朝向不变、画面不跳。
 *
 * 局限：飞行模式下如果相机几乎垂直向上/下看，地面上的注视点会跑到很远
 * （甚至不存在交点），那时用「前方 distance 处的空中点」而不是地面交点 ——
 * 轨道相机允许 `target.y ≠ 0`，所以这是合法的。
 *
 * @param camera 自由相机。
 * @param distance 近似轨道半径。
 * @returns 注视点（三维坐标）。
 */
export function freeToOrbitTarget(camera: FreeCamera, distance: number): Vec3Like {
  const { forward } = freeBasis(camera);
  const d = Number.isFinite(distance) && distance > 0 ? distance : 600;
  /**
   * 注视点 = 相机位置 **加上** 视线方向 × 距离。
   *
   * 注意符号：`forward` 是「相机指向场景」的方向，所以沿它**前进**才是
   * 看向的地方。早期写成 `position − forward · d`（当成「反向」处理），
   * 结果注视点落在相机背后 —— 切回轨道模式时画面会突然翻个方向。
   */
  return {
    x: camera.position.x + forward.x * d,
    y: camera.position.y + forward.y * d,
    z: camera.position.z + forward.z * d,
  };
}

/**
 * 光标在屏幕上的位置 → 飞行转向增量。
 *
 * 只有**指针锁定**（Pointer Lock）时才该用整屏相对位移；
 * 普通拖拽时用「本次 move 的位移」。本函数只做单位换算，不判断来源。
 *
 * @param deltaX 水平位移（像素）。
 * @param deltaY 垂直位移（像素，向下为正 —— 屏幕坐标）。
 * @param radiansPerPixel 每像素的转角（缺省 0.0025，约 400px 转 57°）。
 * @returns 偏航与俯仰增量。
 * @example
 * ```ts
 * flyLookDelta(100, -50); // { yawDelta: -0.25, pitchDelta: 0.125 }
 * ```
 */
export function flyLookDelta(
  deltaX: number,
  deltaY: number,
  radiansPerPixel = 0.0025,
): { yawDelta: number; pitchDelta: number } {
  const dx = Number.isFinite(deltaX) ? deltaX : 0;
  const dy = Number.isFinite(deltaY) ? deltaY : 0;
  return {
    /**
     * 向右拖 → 视线向右转。
     * 相机朝向 −Z 时「向右转」= 绕 +Y 负向（右手定则），故取负。
     */
    yawDelta: -dx * radiansPerPixel,
    /**
     * 向下拖 → 视线向下转 = 低头（pitch 减小）。
     * 屏幕 y 向下为正，故直接乘正系数并取负。
     */
    pitchDelta: -dy * radiansPerPixel,
  };
}

/** 世界地面点（供小地图与命中测试使用：自由相机没有天然的地面注视点）。 */
export interface GroundHit {
  /** 地面点（`y = 0`）。 */
  point: Vec2;
  /** 沿视线的距离；`null` 表示视线与地面平行、无交点。 */
  distance: number | null;
}

/**
 * 求「相机视线与地面 `y = 0` 的交点」。
 *
 * 自由相机没有 `target`，很多依赖「看向哪里」的功能（小地图跟随、
 * 旋转枢轴、网格命中）需要一个地面点。本函数给出它。
 *
 * @param camera 自由相机。
 * @returns 交点与距离；视线不下行时 `distance` 为 `null`。
 */
export function freeGroundHit(camera: FreeCamera): GroundHit {
  const { forward } = freeBasis(camera);
  const py = camera.position.y;
  // 视线与地面平行或朝上：永不相交
  if (Math.abs(forward.y) < 1e-6) {
    return { point: { x: camera.position.x, y: camera.position.z }, distance: null };
  }
  const t = -py / forward.y;
  if (t < 0) {
    // 交点在相机背后：用「脚下」作为退化结果
    return { point: { x: camera.position.x, y: camera.position.z }, distance: null };
  }
  return {
    point: {
      x: camera.position.x + forward.x * t,
      y: camera.position.z + forward.z * t,
    },
    distance: t,
  };
}
