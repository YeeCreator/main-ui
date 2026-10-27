/**
 * render-3d/text-sprite —— 三维档文字：公告牌二维贴片。
 *
 * ## 为什么三维档不用 MSDF（设计 §十九 7）
 *
 * 三类文字是两种东西，判据是**用途**而不是「哪种技术更先进」：
 *
 * | | 贴片（本文件） | 排版（`text-factory` 的 MSDF） |
 * | --- | --- | --- |
 * | 是什么 | 血条、名字标签、伤害数字、公告牌 | 标题、正文、随缩放变化的文本 |
 * | 屏幕尺寸 | 基本固定 | 随缩放变化，要求任意倍率锐利 |
 * | 内容变化 | 频繁（数值在跳） | 稳定 |
 * | 正解 | **位图贴片 + billboard** | **距离场** |
 *
 * 把贴片硬套距离场是错配：数值一变就要重建图集，而贴片根本不需要矢量锐利。
 * 行业里血条与名字标签几乎无例外都是 billboard 位图。
 *
 * ## 技术路线（且刻意选最稳的一段）
 *
 * ```
 * 原生 Canvas 2D fillText → CanvasTexture → Sprite（three 内置 billboard）
 * ```
 *
 * 三个好处：
 * 1. **中文/emoji/任意字体天然全支持** —— 不需要字体子集、不需要 SDF 图集；
 * 2. **零自定义着色器** —— `Sprite` 用 three 内置材质，绕开
 *    「TSL 材质在 WebGPU 下的图集采样」整个缺口（见 `text-tsl.ts` 的实测记录）；
 * 3. **内容变化成本极低** —— 重画 canvas 即可，不涉及图集重排。
 *
 * ## 朝向三档（`TextItem.billboard`）
 *
 * | 值 | 实现 |
 * | --- | --- |
 * | `'full'`（缺省） | `Sprite` —— 内置 billboard，永远面向相机 |
 * | `'axis'` | 贴片 `Mesh` + 每帧只绕 Y 轴对齐相机 |
 * | `'none'` | 贴片 `Mesh`，朝向由调用方决定 |
 *
 * `'axis'` / `'none'` 需要用 `Mesh` 而非 `Sprite`（`Sprite` 的 billboard 是写死的）。
 * 第一版三条都实现，共用同一套「Canvas → 纹理」管线。
 *
 * ## DPR 与清晰度
 *
 * 世界单位换算：`fontSize` 是世界单位，而清晰度取决于**像素**。本模块按
 * `devicePixelRatio` × 一个**超采样系数**放大 canvas，再把纹理贴在
 * `fontSize` 大小的贴片上 —— 这样在世界单位与屏幕像素之间留出余量，
 * 相机拉近时不至于立刻糊掉。
 */

import { DataTexture, DoubleSide, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, RGBAFormat, SRGBColorSpace, type Object3D } from 'three/webgpu';
import type { TextBillboard } from '@main-ui/core/primitives';

/** 贴片文字创建选项。 */
export interface SpriteTextOptions {
  /** 文本内容（支持换行 `\n`）。 */
  text: string;
  /** 字号（世界单位，作为贴片的高度基准）。 */
  fontSize: number;
  /** 颜色（CSS 颜色字符串）。 */
  color: string;
  /** 位置（世界坐标；`y` 为高度）。 */
  position: { x: number; y: number; z: number };
  /** 锚点（0..1；0.5 = 居中）。 */
  anchorX?: number;
  anchorY?: number;
  /** 公告牌朝向；缺省 `'full'`。 */
  billboard?: TextBillboard;
  /** 字族（CSS font-family；缺省系统无衬线）。 */
  fontFamily?: string;
  /** 超采样系数（缺省 2；高分屏 + 相机拉近时提高）。 */
  superSample?: number;
  /** 设备像素比（缺省读 `devicePixelRatio`）。 */
  devicePixelRatio?: number;
  /** canvas 工厂（缺省 `document.createElement('canvas')`；测试可注入）。 */
  createCanvas?: CanvasFactory;
}

/** 贴片文字对象（含可读的世界尺寸，便于调试与命中测试）。 */
export interface SpriteTextObject {
  /** 场景对象（`Sprite` 或 `Mesh`）。 */
  object: Object3D;
  /** 宽（世界单位）。 */
  width: number;
  /** 高（世界单位）。 */
  height: number;
  /** 朝向档位。 */
  billboard: TextBillboard;
  /** 释放纹理与几何。 */
  dispose(): void;
}

/** 缺省超采样系数：给相机拉近留余量，同时不把纹理撑得过大。 */
export const DEFAULT_SUPER_SAMPLE = 2;

/** 缺省字族：优先系统中文字体，最后落到通用无衬线。 */
export const DEFAULT_FONT_FAMILY =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif';

/** canvas 工厂（可注入，便于在无 DOM 环境下测换算逻辑）。 */
export type CanvasFactory = () => HTMLCanvasElement;

/** Canvas 2D 栅格化结果。 */
export interface RasterizedText {
  canvas: HTMLCanvasElement;
  /** 宽（像素）。 */
  width: number;
  /** 高（像素）。 */
  height: number;
}

/**
 * 把文本栅格化到 canvas（纯函数式，不碰 three）。
 *
 * 单独抽出来是为了**可测**：不需要浏览器环境就能验字号换算与换行处理。
 *
 * @param options 文本与样式。
 * @returns canvas 与像素尺寸。
 * @example
 * ```ts
 * const { canvas, width, height } = rasterizeText({ text: 'AB', fontSize: 24 });
 * ```
 */
export function rasterizeText(options: {
  text: string;
  fontSize: number;
  color: string;
  fontFamily?: string;
  superSample?: number;
  devicePixelRatio?: number;
  /** canvas 工厂（缺省 `document.createElement('canvas')`；测试可注入）。 */
  createCanvas?: CanvasFactory;
}): RasterizedText {
  const lines = options.text.split('\n');
  const superSample = options.superSample ?? DEFAULT_SUPER_SAMPLE;
  const dpr = options.devicePixelRatio ?? defaultDpr();
  // 每「世界单位」对应的像素：字号 1 对应 pxPerUnit 像素
  const pxPerUnit = Math.max(1, Math.round(superSample * dpr));
  const fontPx = Math.max(1, Math.round(options.fontSize * pxPerUnit));
  const lineHeight = Math.round(fontPx * 1.25);
  const pad = Math.round(fontPx * 0.15);

  const createCanvas = options.createCanvas ?? defaultCanvasFactory();
  const canvas = createCanvas();
  const ctx = canvas.getContext('2d');
  const family = options.fontFamily ?? DEFAULT_FONT_FAMILY;

  // 先量文字宽度：用临时 canvas 不需要，同 ctx 设好字体后 measureText 即可
  const fontSpec = `${fontPx}px ${family}`;
  if (ctx) {
    ctx.font = fontSpec;
  }
  let maxWidth = 1;
  if (ctx) {
    for (const line of lines) {
      maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
    }
  }

  const width = Math.max(1, Math.ceil(maxWidth) + pad * 2);
  const height = Math.max(1, lineHeight * lines.length + pad * 2);
  canvas.width = width;
  canvas.height = height;

  if (ctx) {
    const c = canvas.getContext('2d');
    if (c) {
      c.font = fontSpec;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = options.color;
      for (let i = 0; i < lines.length; i++) {
        const cy = pad + lineHeight * i + lineHeight / 2;
        c.fillText(lines[i], width / 2, cy);
      }
    }
  }

  return { canvas, width, height };
}

/**
 * 创建公告牌贴片文字。
 *
 * @param options 文本、位置与朝向。
 * @returns 场景对象与释放入口。
 * @example
 * ```ts
 * const label = createSpriteText({ text: 'HP 100', fontSize: 12, color: '#fff',
 *   position: { x: 0, y: 2, z: 0 }, billboard: 'full' });
 * root.add(label.object);
 * ```
 */
export function createSpriteText(options: SpriteTextOptions): SpriteTextObject {
  const superSample = options.superSample ?? DEFAULT_SUPER_SAMPLE;
  const dpr = options.devicePixelRatio ?? defaultDpr();
  const pxPerUnit = Math.max(1, Math.round(superSample * dpr));

  const raster = rasterizeText({
    text: options.text,
    fontSize: options.fontSize,
    color: options.color,
    fontFamily: options.fontFamily,
    superSample,
    devicePixelRatio: dpr,
    createCanvas: options.createCanvas,
  });

  // ⚠️ 不用 `CanvasTexture`：实测在 WebGPU 后端下采样恒为 0（与 MSDF 图集同一个坑）。
  // 改走 `DataTexture`：从 canvas 读像素，转成显式 RGBA 纹理，跨渲染器稳定。
  const ctx2d = raster.canvas.getContext('2d');
  const pixels = ctx2d
    ? new Uint8Array(ctx2d.getImageData(0, 0, raster.width, raster.height).data)
    : new Uint8Array(raster.width * raster.height * 4);
  const texture = new DataTexture(pixels, raster.width, raster.height, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  // `flipY = true`：canvas 像素自上而下，而 three 默认按「v=0 在底部」采样，
  // 故需在上传时翻转。实测（2026-10-27）：`false` 会让文字上下颠倒。
  texture.flipY = true;
  texture.needsUpdate = true;

  // 世界尺寸：像素 ÷ 每单位像素
  const width = raster.width / pxPerUnit;
  const height = raster.height / pxPerUnit;
  const billboard = options.billboard ?? 'full';
  const anchorX = options.anchorX ?? 0.5;
  const anchorY = options.anchorY ?? 0.5;

  let object: Object3D;
  let geometry: PlaneGeometry | null = null;
  let material: MeshBasicMaterial;

  // ⚠️ 不要自己写 `colorNode` 去采样纹理。
  //
  // `NodeMaterial.setupDiffuseColor()` 走的是 `materialColor`，而
  // `MaterialNode`（scope = COLOR）**会自己把 `material.map` 乘进基色**：
  //   node = colorNode.mul(this.getTexture('map'))
  // 也就是说「设 `map` 就够」，反而**自定义 `colorNode` 会覆盖掉这条路径**。
  //
  // 实测（2026-10-27）：手写 `colorNode = vec4(texture(tex, uv()))` 时，
  // 无论 `CanvasTexture` 还是 `DataTexture`，采样值恒为 0（Sprite 位置/尺寸/
  // 可见性/uv 全部正常，用恒定色也画得出来）——正是这条路径被绕过所致。
  // 正解：只设 `map`，交给 `materialColor` 处理。
  // ⚠️ 用 **`MeshBasicMaterial`**（传统材质），不用 `*NodeMaterial`。
  //
  // 实测（2026-10-27，三轮）：`SpriteNodeMaterial` / `MeshBasicNodeMaterial` 挂
  // `map` 或自定义 `colorNode` 时，纹理采样**恒为 0**（对象在场景内、scale 正确、
  // 可见性为真、uv 通道可用、连硬编码 2×2 纯色 DataTexture 也采样不到）；
  // 而同一场景里用 **`MeshBasicMaterial`** 的实例化网格完全正常。
  //
  // 结论：问题在节点材质的纹理采样路径，不在纹理本身。故贴片走传统材质 ——
  // three 的 `WebGPURenderer` 会把传统材质自动转成对应的节点实现（内置路径），
  // 这条路径是官方长期维护的、也是本包其余图元一直在用的。
  //
  // 代价：`Sprite` 的自动 billboard 用不了（它要求 `SpriteMaterial`），
  // 故 `'full'` 档也改为「平面 + 每帧对齐相机」，与 `'axis'` 共用同一套机制。
  geometry = new PlaneGeometry(width, height);
  geometry.translate((0.5 - anchorX) * width, (0.5 - anchorY) * height, 0);
  material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    // 无光照：与二维档预设第 2 条一致
    toneMapped: false,
  });
  object = new Mesh(geometry, material);

  object.position.set(options.position.x, options.position.y, options.position.z);
  // 把朝向档位随对象带走：`syncBillboards` 需要按档位分派对齐算法
  (object as unknown as { __textBillboard?: TextBillboard }).__textBillboard = billboard;

  // 贴纸不该参与视锥剔除判断错误：几何尺寸已知，这里显式给包围球
  object.frustumCulled = true;


  return {
    object,
    width,
    height,
    billboard,
    dispose(): void {
      texture.dispose();
      material.dispose();
      geometry?.dispose();
    },
  };
}

/**
 * `'full'` 档的每帧对齐：完全面向相机（等价于 `Sprite` 的 billboard 行为）。
 *
 * 平面 Mesh 默认在 XY 平面、法线朝 +Z；要让法线指向相机，用 `lookAt` 即可
 * （`Object3D.lookAt` 让 +Z 轴朝向目标）。
 *
 * @param object 目标对象。
 * @param cameraPosition 相机世界坐标。
 *
 * @example
 * ```ts
 * orientFullBillboard(label.object, { x: 0, y: 100, z: 100 });
 * ```
 */
export function orientFullBillboard(
  object: Object3D,
  cameraPosition: { x: number; y: number; z: number },
  cameraUp: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 },
): void {
  // ⚠️ 不能用 `lookAt`：它固定用世界 +Y 当 up。本后端俯视时相机 up 是 (0,0,-1)
  // （见 core 的 `cameraUpForPolar`），`lookAt` 会把贴片转成上下颠倒
  // （实测：文字确实是倒的）。
  //
  // 正解：手工构造朝向矩阵 —— 让贴片的 +Z 指向相机、+Y 对齐相机 up。
  const dir = {
    x: cameraPosition.x - object.position.x,
    y: cameraPosition.y - object.position.y,
    z: cameraPosition.z - object.position.z,
  };
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (len < 1e-6) return;
  const zAxis = { x: dir.x / len, y: dir.y / len, z: dir.z / len };

  // 右手系：x = up × z 时，得到的 x 会让局部 +Y 与相机 up **反向**
  // （实测：文字上下颠倒）。改为 x = z × up，使 +Y 与 up 同向。
  let xAxis = cross(zAxis, cameraUp);
  let xLen = Math.hypot(xAxis.x, xAxis.y, xAxis.z);
  if (xLen < 1e-6) {
    xAxis = cross(zAxis, { x: 0, y: 1, z: 0 });
    xLen = Math.hypot(xAxis.x, xAxis.y, xAxis.z);
    if (xLen < 1e-6) return;
  }
  xAxis = { x: xAxis.x / xLen, y: xAxis.y / xLen, z: xAxis.z / xLen };

  // y = x × z（保证与 x、z 构成右手正交基，且 +Y 与相机 up 同向）
  const yAxis = cross(xAxis, zAxis);

  // 由三个基向量写进 rotation（Object3D.rotation 是欧拉角，故用矩阵反解）
  const m = (object as unknown as { matrixAutoUpdate?: boolean }).matrixAutoUpdate;
  void m;
  applyBasis(object, xAxis, yAxis, zAxis);
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

/**
 * 把正交基写入对象的旋转（用 `quaternion`，避免欧拉角顺序问题）。
 *
 * @param object 目标对象。
 * @param xAxis 局部 +X 的世界方向。
 * @param yAxis 局部 +Y 的世界方向。
 * @param zAxis 局部 +Z 的世界方向。
 */
function applyBasis(
  object: Object3D,
  xAxis: { x: number; y: number; z: number },
  yAxis: { x: number; y: number; z: number },
  zAxis: { x: number; y: number; z: number },
): void {
  const q = (object as unknown as { quaternion?: { setFromRotationMatrix?: (m: unknown) => void } }).quaternion;
  if (!q?.setFromRotationMatrix) return;
  // 4x4 列主序矩阵（three 的 Matrix4.elements 布局）
  const m = {
    elements: [
      xAxis.x, xAxis.y, xAxis.z, 0,
      yAxis.x, yAxis.y, yAxis.z, 0,
      zAxis.x, zAxis.y, zAxis.z, 0,
      0, 0, 0, 1,
    ],
  };
  q.setFromRotationMatrix(m);
}

/**
 * 按对象自带的档位分派对齐算法。
 *
 * `'none'` 不做任何事（朝向由调用方决定）。
 *
 * @param object 贴片对象（需带 `__textBillboard`）。
 * @param cameraPosition 相机世界坐标。
 */
export function syncTextBillboard(
  object: Object3D,
  cameraPosition: { x: number; y: number; z: number },
  cameraUp: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 },
): void {
  const mode = (object as unknown as { __textBillboard?: TextBillboard }).__textBillboard;
  if (mode === 'full') orientFullBillboard(object, cameraPosition, cameraUp);
  else if (mode === 'axis') orientAxisBillboard(object, cameraPosition);
}

/**
 * `'axis'` 档的每帧对齐：只绕 Y 轴转向相机（像立在地上的广告牌）。
 *
 * 平面 Mesh 默认在 XY 平面、法线朝 +Z；转到「法线在 XZ 平面内且指向相机」即可。
 * `'full'` 由 `Sprite` 自带，`'none'` 不该调用本函数。
 *
 * @param object 目标对象。
 * @param cameraPosition 相机世界坐标。
 */
export function orientAxisBillboard(
  object: Object3D,
  cameraPosition: { x: number; y: number; z: number },
): void {
  const dx = cameraPosition.x - object.position.x;
  const dz = cameraPosition.z - object.position.z;
  // 平面法线朝 +Z，故绕 Y 轴旋转到 (dx, dz) 方向
  object.rotation.set(0, Math.atan2(dx, dz), 0);
}

/**
 * 取缺省 canvas 工厂。
 *
 * 无 DOM（Node / 测试）时抛**明确**错误 —— 不要静默造一个假 canvas 让调用方
 * 拿到空纹理却不知为何。
 */
function defaultCanvasFactory(): CanvasFactory {
  const doc = (globalThis as { document?: { createElement(tag: string): HTMLCanvasElement } }).document;
  if (!doc) {
    throw new Error('createSpriteText 需要 DOM（document.createElement）；请在测试中注入 createCanvas');
  }
  return () => doc.createElement('canvas');
}

function defaultDpr(): number {
  const raw = (globalThis as { devicePixelRatio?: number }).devicePixelRatio;
  return typeof raw === 'number' && raw > 0 ? raw : 1;
}
