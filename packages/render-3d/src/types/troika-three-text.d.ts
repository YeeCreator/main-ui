/**
 * troika-three-text 的最小类型声明。
 *
 * 上游 `troika-three-text@0.52.5` **不自带类型**，npm 上也没有 `@types/troika-three-text`
 * （2026-10-27 实测 404）。这里只声明本项目实际用到的成员，避免整包 `any` 泄漏：
 * 若将来上游补了官方类型，删除本文件即可（tsc 会优先用包内声明）。
 *
 * 只覆盖 `Text` 的公开面（text / fontSize / color / anchorX / anchorY / sync / material）。
 */
declare module 'troika-three-text' {
  import type { Mesh, Object3D } from 'three';

  /** MSDF 文字对象（`Mesh` 子类，几何由 SDF 图集生成）。 */
  export class Text extends Mesh {
    /** 文本内容（支持换行与 `\n`）。 */
    text: string;
    /** 字号（世界单位）。 */
    fontSize: number;
    /** 颜色（CSS 颜色串或数值）。 */
    color: string | number;
    /** 水平锚点 0..1（0.5 = 居中）。 */
    anchorX: number | string;
    /** 垂直锚点 0..1（0.5 = 居中）。 */
    anchorY: number | string;
    /** 图集字形分辨率（像素）。 */
    sdfGlyphSize?: number;
    /** 最大宽度（世界单位；超出自动换行）。 */
    maxWidth?: number;
    /** 文本对齐。 */
    textAlign?: 'left' | 'right' | 'center' | 'justify';
    /** 材质（troika 自带 MeshBasic 变体）。 */
    material: Mesh['material'] & { toneMapped?: boolean };
    /** 同步字形到图集（修改文本后必须调用）。 */
    sync(callback?: () => void): void;
    /** 释放资源。 */
    dispose(): void;
    /** 任意附加属性（troika 内部使用，本声明不细化）。 */
    [key: string]: unknown;
  }

  /** 预加载字体（本项目不直接用，保留供将来）。 */
  export function preloadFont(options: Record<string, unknown>, callback?: () => void): void;

  /**
   * 全局配置文字构建器（**必须在首次排版前**调用，之后调用会被忽略并告警）。
   *
   * 本项目用它做两件事：① 置空 `unicodeFontsURL` 以免去 jsDelivr 取回退字体数据
   * （国内不可达会让字体 Promise 挂起 → NaN 几何 → WebGPU 崩帧）；
   * ② 指定 `defaultFontURL` 为宿主自托管字体。
   */
  export function configureTextBuilder(config: {
    /** 默认字体 URL；`null` = 不使用缺省 Google Fonts 字体。 */
    defaultFontURL?: string | null;
    /** unicdoe 回退数据位置；`null` = 不发起任何远程请求。 */
    unicodeFontsURL?: string | null;
    /** 字形 SDF 图集分辨率（2 的幂）。 */
    sdfGlyphSize?: number;
    /** SDF 边距（图集内留白比例）。 */
    sdfMargin?: number;
    /** SDF 指数（编码精度）。 */
    sdfExponent?: number;
    /** 图集纹理宽度。 */
    textureWidth?: number;
    /** 是否用 Worker 排版。 */
    useWorker?: boolean;
  }): void;

  export type { Object3D };
}
