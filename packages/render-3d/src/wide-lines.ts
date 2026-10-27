/**
 * render-3d/wide-lines —— 粗线（屏幕空间宽度）路线。
 *
 * 设计 §十九 7：不规则线（跳棋辐条 / 轨道 / 路径高亮）必须走**屏幕空间宽度粗线**，
 * 因为原生线段宽度在多数平台锁死 1 像素，做不出粗细线。
 *
 * 阶段 0 预检结论（2026-10-27 实证，见任务书 §六 回写）：
 * `three@0.186.1` 的 `three/webgpu` build **导出 `Line2NodeMaterial`**，
 * 且 `three/addons/lines/webgpu/Line2.js` 存在并 `import { Line2NodeMaterial } from 'three/webgpu'`。
 * 因此**走粗线 addon 的 WebGPU 版**，无需退到程序化距离函数路线。
 *
 * 硬规矩：不自写 GLSL。`Line2NodeMaterial` 是 three 官方的节点材质（TSL 侧），
 * 我们只设参数（颜色 / 线宽 / 分辨率）。
 */

import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { Line2 } from 'three/addons/lines/webgpu/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { Line2NodeMaterial } from 'three/webgpu';

/** 粗线创建选项。 */
export interface WideLineOptions {
  /** 扁平位置数组 `[x,y,z, x,y,z, ...]`。 */
  positions: readonly number[];
  /** 线宽（像素；`worldUnits=false` 时为屏幕像素）。 */
  lineWidth: number;
  /** 颜色（CSS 十六进制）。 */
  color: string;
  /** 是否世界单位线宽（缺省 false = 屏幕像素，符合"屏幕空间宽度粗线"）。 */
  worldUnits?: boolean;
  /** 透明度（缺省 1）。 */
  opacity?: number;
}

/**
 * 创建一条屏幕空间粗折线。
 *
 * @param options 位置与样式。
 * @returns `Line2` 实例（`Object3D` 子类）。
 * @example
 * ```ts
 * const line = createWideLine({ positions: [0,0,0, 10,0,10], lineWidth: 3, color: '#3355ff' });
 * ```
 */
export function createWideLine(options: WideLineOptions): Line2 {
  const geometry = new LineGeometry();
  geometry.setPositions([...options.positions]);

  const material = new Line2NodeMaterial({
    color: options.color,
    linewidth: options.lineWidth,
    worldUnits: options.worldUnits ?? false,
    transparent: (options.opacity ?? 1) < 1,
    opacity: options.opacity ?? 1,
    // 二维档保真预设第 3 条：线条禁止走贴图。节点材质缺省即无色贴图。
    depthWrite: false,
  });

  return new Line2(geometry, material);
}

/**
 * 创建一组线段（每对点一段；用于网格线这类不连续拓扑）。
 *
 * @param segments 扁平位置数组（必须为偶数个三元组）。
 * @param lineWidth 线宽（屏幕像素）。
 * @param color 颜色。
 * @returns `LineSegments2` 实例。
 */
export function createWideSegments(segments: readonly number[], lineWidth: number, color: string): LineSegments2 {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions([...segments]);
  const material = new Line2NodeMaterial({
    color,
    linewidth: lineWidth,
    worldUnits: false,
    depthWrite: false,
  });
  return new LineSegments2(geometry, material);
}

/**
 * 屏幕空间粗线的分辨率同步。
 *
 * `Line2NodeMaterial` 需要知道画布像素尺寸才能把线宽换算成屏幕像素宽度；
 * 尺寸变化（`resize` / `devicePixelRatio` 变化）时必须重新设置，否则线宽会失真。
 */
export function applyLineResolution(line: Line2 | LineSegments2, width: number, height: number): void {
  const material = line.material as unknown as { resolution?: { set(x: number, y: number): void } };
  material.resolution?.set(width, height);
}

/** 粗线 addon 可用性（阶段 0 预检的可运行断言）。 */
export function wideLinesAvailable(): boolean {
  return typeof Line2 === 'function' && typeof Line2NodeMaterial === 'function';
}
