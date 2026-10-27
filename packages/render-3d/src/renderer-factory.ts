/**
 * render-3d/renderer-factory —— `WebGPURenderer` 的创建隔离点。
 *
 * 设计 §十九 5：**一次到位用 `three/webgpu` 的 `WebGPURenderer`，着色器一律 TSL**。
 * 依据：0.186.1 的 `three.webgpu.js` 产物内含 `WebGLBackend`、`forceWebGL`、
 * `navigator.gpu` 探测 —— 一个入口两个后端，无 WebGPU 时自动走内部 WebGL2，
 * 故 WebGL2 是同一渲染器的永久低档而非过渡态。
 *
 * 本文件是**唯一**创建渲染器的地方：`init()` 异步、backend 选择、像素比对齐都收在这里，
 * 其余模块只拿已经就绪的 renderer。这样做的原因（也是硬规矩）：不得写 GLSL、
 * 不得用 `onBeforeCompile` 打补丁 —— 若渲染器创建散落各处，这两条迟早被绕过。
 */

import { WebGPURenderer } from 'three/webgpu';

/** 渲染器创建选项。 */
export interface RendererFactoryOptions {
  /** 是否强制走 WebGL2 后端（缺省 false：有 WebGPU 则用 WebGPU）。 */
  forceWebGL?: boolean;
  /** 是否开启抗锯齿（缺省 false，与二维档点阵风格一致）。 */
  antialias?: boolean;
  /** 设备像素比（**二维档保真预设第 4 条：显式对齐**，不用 three 缺省值）。 */
  devicePixelRatio: number;
}

/** 创建并初始化 `WebGPURenderer`。 */
export async function createRenderer(options: RendererFactoryOptions): Promise<WebGPURenderer> {
  const renderer = new WebGPURenderer({
    antialias: options.antialias ?? false,
    forceWebGL: options.forceWebGL ?? false,
    // three 的缺省 devicePixelRatio 常与二维画布不一致，是"线条发虚"最隐蔽的原因。
    alpha: false,
  });
  renderer.setPixelRatio(options.devicePixelRatio);
  await renderer.init();
  return renderer;
}

/** 探测当前环境是否有 WebGPU（仅诊断用；渲染器自身会回退 WebGL2）。 */
export function detectWebGPU(): boolean {
  return typeof navigator !== 'undefined' && typeof (navigator as Navigator & { gpu?: unknown }).gpu !== 'undefined';
}
