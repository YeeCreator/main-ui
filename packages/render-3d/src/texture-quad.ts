/**
 * render-3d/texture-quad —— 离屏纹理面片（「电视机」）的三维呈现。
 *
 * ## 它是什么
 *
 * 把一张**二维图像**贴到三维空间里的一个平面上。于是「大量二维栅格内容」
 * 只用一个图元呈现，而不是拆成成千上万个独立 3D 物体。
 *
 * 判据（性能与需求的分界，不是风格选择）：
 *
 * | 内容 | 策略 |
 * | --- | --- |
 * | 少量实体、需要真的立体感（个体有厚度、能各自倾斜） | 逐格图元 |
 * | 大量实体、本质是一张二维栅格（元胞自动机、像素场、位图） | **本模块** |
 *
 * 例：64×64 元胞自动机有 4096 格 —— 逐格要提交 4096 组实例矩阵，
 * 而它的语义本就是「一张会变的位图」，拆成 4096 个独立 3D 物体是过度建模。
 * 用一张离屏纹理贴在单个面片上，**开销与格数无关**。
 *
 * ## 纹理来源与刷新
 *
 * `TextureQuadPlan.texture` 是**纹理键字符串**，由宿主提供的
 * `TextureResolver` 解析成图像源。支持三种源：
 *
 * - `HTMLCanvasElement` —— 宿主的离屏画布（**动态内容首选**）
 * - `HTMLImageElement` / `ImageBitmap` —— 静态图
 *
 * 动态更新（元胞自动机下一代）的约定：
 * **解析器始终返回同一块 canvas 对象**，改完内容后调用后端的 `invalidateTexture`
 * （或直接重新 `applySnapshot`）。本模块用「源对象标识 + 版本号」判断是否需要
 * 重新上传 —— 只看对象标识不够，因为画布内容变了但对象没变。
 */

import {
  CanvasTexture,
  DoubleSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Texture,
  type Object3D,
} from 'three/webgpu';
import type { QuadTextureResolver, QuadTextureSource } from '@main-ui/core/primitives';

/** 纹理键 → 图像源的解析器（与 `@main-ui/core/primitives` 的 `QuadTextureResolver` 同一类型）。 */
export type { QuadTextureResolver, QuadTextureSource } from '@main-ui/core/primitives';

/** 一个已装配的面片。 */
export interface BuiltTextureQuad {
  /** 面片对象（已加入场景）。 */
  object: Object3D;
  /** 当前绑定的纹理。 */
  texture: Texture;
  /** 绑定时使用的源对象（用于判断是否需要重传）。 */
  source: QuadTextureSource;
  /** 是否始终面向相机。 */
  billboard: boolean;
}

/**
 * 把一块图像源包装成 three 纹理。
 *
 * ## 为什么用 `CanvasTexture` 而不是 `DataTexture`
 *
 * 三维后端曾在「文字贴片」上踩过 `CanvasTexture` 在 WebGPU 下采样为 0 的坑，
 * 故那里改用 `DataTexture`（读像素后显式上传）。但那条路对**动态大画布**不适用：
 * 每次更新都要 `getImageData` 全图 + 构造 `Uint8Array`，4096 格以上会明显卡顿。
 *
 * 这里改用 `CanvasTexture`，并在其上加两道保险：
 * 1. `needsUpdate = true` 显式标记（`CanvasTexture` 构造时已设，更新后需重设）；
 * 2. 由 `syncTextureQuads` 在每次场景重建时重新绑定，而非依赖对象复用。
 *
 * 若某环境下 `CanvasTexture` 采样失败，回退方案是换 `DataTexture` —— 但那会
 * 牺牲动态更新的性能，故**先按 CanvasTexture 实现，如需回退再加参数开关**。
 *
 * @param source 图像源。
 * @returns three 纹理（已设置颜色空间与过滤方式）。
 */
export function textureFromSource(source: QuadTextureSource): Texture {
  const texture = new CanvasTexture(source as HTMLCanvasElement);
  texture.colorSpace = SRGBColorSpace;
  /**
   * 线性过滤 + 不生成 mipmap。
   *
   * 二维栅格内容（元胞自动机、像素场）放大看时应当是**清晰的方块**，
   * 而不是被 mipmap 糊成一团。需要平滑时由宿主在画布侧自己处理。
   */
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * 创建一个离屏纹理面片。
 *
 * @param options 面片参数。
 * @returns 面片对象与纹理（供调用方登记 billboard 与释放）。
 */
export function createTextureQuad(options: {
  width: number;
  height: number;
  source: QuadTextureSource;
  opacity: number;
  billboard: boolean;
}): BuiltTextureQuad {
  const texture = textureFromSource(options.source);
  const geometry = new PlaneGeometry(Math.max(1e-6, options.width), Math.max(1e-6, options.height));
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: options.opacity < 1,
    opacity: options.opacity,
    side: DoubleSide,
    // 无光照：与二维档预设第 2 条一致（内容本身带颜色，不该被光照改变）
    toneMapped: false,
  });
  const object = new Mesh(geometry, material);
  return { object, texture, source: options.source, billboard: options.billboard };
}

/**
 * 让面片始终面向相机（`billboard = true` 时）。
 *
 * 只绕「竖直轴 + 俯仰」对齐，不做 roll —— 与文字贴片的 `'full'` 档同语义：
 * 内容本身是平的，若连 roll 一起对齐，相机一滚内容会跟着歪，
 * 那会让「它在世界里」的空间感消失。
 *
 * @param object 面片对象。
 * @param cameraPosition 相机世界坐标。
 * @param cameraUp 相机上方向。
 */
export function orientQuadToBillboard(
  object: Object3D,
  cameraPosition: { x: number; y: number; z: number },
  cameraUp: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 },
): void {
  const dx = cameraPosition.x - object.position.x;
  const dy = cameraPosition.y - object.position.y;
  const dz = cameraPosition.z - object.position.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-9) return;

  /**
   * 构造朝向矩阵：+Z 指向相机、+Y 贴近相机 up。
   *
   * 符号约定与 `text-sprite` 的 `orientFullBillboard` 一致（那一处踩过
   * 「左手系导致四元数模长 0.708」的坑，这里沿用已验证的写法）。
   * 关键：`x = up × z`、`y = z × x`，保证 `x × y = z`（右手正交基）。
   */
  const zAxis = { x: dx / len, y: dy / len, z: dz / len };
  const upLen = Math.hypot(cameraUp.x, cameraUp.y, cameraUp.z);
  const up = upLen > 1e-9
    ? { x: cameraUp.x / upLen, y: cameraUp.y / upLen, z: cameraUp.z / upLen }
    : { x: 0, y: 1, z: 0 };

  let xAxis = cross(up, zAxis);
  let xLen = Math.hypot(xAxis.x, xAxis.y, xAxis.z);
  if (xLen < 1e-6) {
    // up 与 z 平行（正俯视时的退化）：换一个参考轴
    xAxis = cross({ x: 0, y: 0, z: -1 }, zAxis);
    xLen = Math.hypot(xAxis.x, xAxis.y, xAxis.z);
    if (xLen < 1e-6) return;
  }
  xAxis = { x: xAxis.x / xLen, y: xAxis.y / xLen, z: xAxis.z / xLen };
  const yAxis = cross(zAxis, xAxis);

  const q = (object as unknown as { quaternion?: { setFromRotationMatrix?: (m: unknown) => void } }).quaternion;
  if (!q?.setFromRotationMatrix) return;
  q.setFromRotationMatrix({
    elements: [
      xAxis.x, xAxis.y, xAxis.z, 0,
      yAxis.x, yAxis.y, yAxis.z, 0,
      zAxis.x, zAxis.y, zAxis.z, 0,
      0, 0, 0, 1,
    ],
  });
}

/** 向量叉积。 */
function cross(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
