/**
 * render-3d/text-config —— MSDF 文字的字体来源配置（避免隐式依赖 CDN）。
 *
 * 背景（2026-10-27 浏览器实测，见任务书 §六 回写）：
 * `troika-three-text` 在字形缺字时会去 **jsDelivr CDN** 取
 * `unicode-font-resolver` 的回退数据。国内网络下该请求 `ERR_NAME_NOT_RESOLVED`，
 * 后果不是"文字缺几个字"，而是：字体 Promise 永不 settle → 文字几何 bounds 为
 * NaN → WebGPU `drawIndexed` 收到 `Infinity` 抛错 → **整帧渲染中断**。
 *
 * 因此本模块把字体来源**显式化**：
 * - 未配置时不发起任何远程请求（`unicodeFontsURL` 置空 + 关闭 worker）；
 * - 宿主可指向自己的本地字体（`defaultFontURL`）与本地回退数据（`unicodeFontsURL`）；
 * - 文字加载失败时**跳过该文字**，不影响其余图元（见 `text-factory`）。
 *
 * 用法（宿主启动时一次性调用）：
 * ```ts
 * import { configureTextRendering } from '@main-ui/render-3d';
 * // 字体文件由宿主自己提供（放 public/ 或打进入包）
 * configureTextRendering({ defaultFontURL: '/fonts/NotoSansSC-Regular.woff' });
 * ```
 */

import { configureTextBuilder } from 'troika-three-text';

/** 字体渲染配置。 */
export interface TextRenderingConfig {
  /**
   * 默认字体 URL（woff/woff2/ttf）。
   *
   * 提供后 troika 用它排版全部文字，**不再请求 Google Fonts 缺省字体**。
   * 汉字需指向含 CJK 字形的字体（如 Noto Sans SC）。
   */
  defaultFontURL?: string | null;
  /**
   * `unicode-font-resolver` 回退数据的位置。
   *
   * **缺省为 `null`（不发起远程请求）**。要缺字回退能力时，把该库的数据目录
   * 自托管后指向它。留空时缺字表现为"该段文字不渲染"，而不是网络挂起。
   */
  unicodeFontsURL?: string | null;
  /** 字形 SDF 图集分辨率（2 的幂；缺省 64）。汉字细笔画建议 ≥ 64。 */
  sdfGlyphSize?: number;
  /** 是否使用 Worker 排版（缺省 false：避免 Worker 内 fetch 失败难以观测）。 */
  useWorker?: boolean;
}

let configured = false;
let currentConfig: Required<Pick<TextRenderingConfig, 'sdfGlyphSize' | 'useWorker'>> & TextRenderingConfig = {
  defaultFontURL: null,
  unicodeFontsURL: null,
  sdfGlyphSize: 64,
  useWorker: false,
};

/**
 * 配置 MSDF 文字渲染。
 *
 * 必须在**首次文字排版之前**调用（troika 侧限制：之后的调用会被忽略并告警）。
 * 可重复调用以更新期望值，但只有首次生效。
 *
 * @param config 字体来源与图集参数。
 * @example
 * ```ts
 * configureTextRendering({ defaultFontURL: '/fonts/NotoSansSC-Regular.woff', sdfGlyphSize: 128 });
 * ```
 */
export function configureTextRendering(config: TextRenderingConfig): void {
  currentConfig = { ...currentConfig, ...config };
  if (configured) return;
  configureTextBuilder({
    // null 表示"不用缺省字体"，配合下面的 unicodeFontsURL=null 即完全离线。
    defaultFontURL: currentConfig.defaultFontURL ?? null,
    unicodeFontsURL: currentConfig.unicodeFontsURL ?? null,
    sdfGlyphSize: currentConfig.sdfGlyphSize ?? 64,
    useWorker: currentConfig.useWorker ?? false,
  });
  configured = true;
}

/** 读取当前配置（诊断用）。 */
export function getTextRenderingConfig(): Readonly<TextRenderingConfig> {
  return { ...currentConfig };
}

/** 是否已做过一次配置。 */
export function isTextRenderingConfigured(): boolean {
  return configured;
}
