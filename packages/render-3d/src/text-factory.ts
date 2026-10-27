/**
 * render-3d/text-factory —— 文字图元（MSDF）。
 *
 * 设计 §十九 7：文字（含汉字）走 **MSDF**，字形按需生成并入图集缓存
 * （汉字数千字无法预烘）。`troika-three-text` 正是这条路线：
 * 运行时用 `webgl-sdf-generator` 生成距离场，按需向图集追加字形。
 *
 * **健壮性硬要求（2026-10-27 浏览器实测教训）**：字体未就绪时 troika 的文字几何
 * bounds 会是 NaN，WebGPU 的 `drawIndexed` 收到 Infinity 会抛错并**中断整帧渲染**。
 * 因此本模块：
 * 1. 文字对象创建后**先不可见**（`visible = false`），等 `sync()` 回调确认就绪；
 * 2. 未就绪/失败时保持不可见，永不让 NaN 几何进入渲染队列；
 * 3. 字体来源由 `text-config` 显式配置，不隐式依赖 CDN。
 */

import { Text } from 'troika-three-text';
import { getTextRenderingConfig } from './text-config';

/** 文字创建选项。 */
export interface TextOptions {
  text: string;
  /** 字号（世界单位）。 */
  fontSize: number;
  /** 颜色（CSS 十六进制）。 */
  color: string;
  /** 位置（三维坐标；`y` 为高度）。 */
  position: { x: number; y: number; z: number };
  /** 锚点（0..1；0.5 = 居中）。 */
  anchorX?: number;
  anchorY?: number;
  /** 就绪回调（`sync` 完成时触发；参数为是否成功就绪）。 */
  onReady?: (ok: boolean) => void;
}

/** 回退 SDF 字形分辨率（汉字细笔画的清晰度预算）。 */
export const SDF_GLYPH_SIZE_FALLBACK = 64;

/**
 * 创建一个 MSDF 文字对象。
 *
 * 返回对象**初始不可见**：只有 `sync()` 回调确认字形就绪后才置为可见。
 * 这样即使字体加载失败，也只是这段文字不显示，不会拖垮整帧。
 *
 * @param options 文本与样式。
 * @returns troika `Text`（`Object3D` 子类；`visible` 待就绪后置 true）。
 * @example
 * ```ts
 * const label = createText({ text: '黑棋', fontSize: 12, color: '#111', position: { x: 0, y: 0.1, z: 0 } });
 * ```
 */
export function createText(options: TextOptions): Text {
  const config = getTextRenderingConfig();
  const text = new Text();
  text.text = options.text;
  text.fontSize = options.fontSize;
  text.color = options.color;
  text.position.set(options.position.x, options.position.y, options.position.z);
  text.anchorX = options.anchorX ?? 0.5;
  text.anchorY = options.anchorY ?? 0.5;
  // 汉字按需生成字形；显式给出图集分辨率预算。
  (text as unknown as { sdfGlyphSize: number }).sdfGlyphSize = config.sdfGlyphSize ?? SDF_GLYPH_SIZE_FALLBACK;
  // 二维档保真预设第 2 条：无光照（文字一律 unlit，不受场景灯影响）。
  (text as unknown as { material: { toneMapped?: boolean } }).material.toneMapped = false;
  // 字体来源显式化（null = 不请求任何远程字体）
  if (config.defaultFontURL) text.font = config.defaultFontURL;
  if (config.unicodeFontsURL) (text as unknown as { unicodeFontsURL?: string }).unicodeFontsURL = config.unicodeFontsURL;

  // 就绪前必须不可见：NaN 几何进渲染队列会中断整帧。
  text.visible = false;

  text.sync(() => {
    const ready = isGeometryFinite(text);
    text.visible = ready;
    options.onReady?.(ready);
  });

  return text;
}

/** 更新已有 MSDF 文字（复用同一实例，避免重建图集引用）。 */
export function updateText(text: Text, patch: Partial<TextOptions>): void {
  if (patch.text !== undefined) text.text = patch.text;
  if (patch.fontSize !== undefined) text.fontSize = patch.fontSize;
  if (patch.color !== undefined) text.color = patch.color;
  if (patch.position) text.position.set(patch.position.x, patch.position.y, patch.position.z);
  if (patch.anchorX !== undefined) text.anchorX = patch.anchorX;
  if (patch.anchorY !== undefined) text.anchorY = patch.anchorY;
  text.visible = false;
  text.sync(() => {
    const ready = isGeometryFinite(text);
    text.visible = ready;
    patch.onReady?.(ready);
  });
}

/**
 * 判定文字几何是否可用于渲染（全部顶点有限）。
 *
 * 这是 WebGPU `drawIndexed` 崩溃的守门条件：bounds/position 里出现 NaN 或
 * Infinity 时一律视为未就绪。
 *
 * @param text troika 文字对象。
 * @returns 几何可用返回 true。
 */
export function isGeometryFinite(text: Text): boolean {
  const geometry = (text as unknown as {
    geometry?: {
      boundingSphere?: { radius?: number };
      attributes?: Record<string, { array?: ArrayLike<number> }>;
    };
  }).geometry;
  if (!geometry) return false;
  const radius = geometry.boundingSphere?.radius;
  if (typeof radius === 'number' && (!Number.isFinite(radius) || radius <= 0)) return false;
  const position = geometry.attributes?.position?.array;
  if (!position) return false;
  const step = Math.max(1, Math.floor(position.length / 64));
  for (let i = 0; i < position.length; i += step) {
    if (!Number.isFinite(position[i])) return false;
  }
  return true;
}
