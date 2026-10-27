/**
 * render-3d/geometry-factory —— 原型几何工厂（同类实体共享同一几何）。
 *
 * 设计 §十九 7 实例化硬规矩：**同类实体必须归一化到少数原型几何再实例化**。
 * 本文件是这条规矩的唯一落点：
 * - `getPrototypeGeometry(key, factory)` 按原型键缓存几何，同键只造一次；
 * - 调用方一律经缓存取几何，不得在循环里 `new XxxGeometry(...)`。
 *
 * 几何全部用 three core 的 `BufferGeometry` 子类，不依赖 addon（粗线除外，见 `wide-lines.ts`）。
 */

import {
  BoxGeometry,
  CircleGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  ExtrudeGeometry,
  Vector2,
} from 'three';
import type { OrthoCameraPlan } from './camera-plan';

/** 原型几何缓存（进程级；键必须把一切影响几何形状的参数编码进去）。 */
const geometryCache = new Map<string, BufferGeometry>();

/**
 * 取原型几何（同键复用）。
 *
 * @param key 原型键（须包含全部形状参数，例如 `circle:8` / `rect:8x8`）。
 * @param factory 首次创建时的几何构造器。
 * @returns 共享几何实例。
 * @example
 * ```ts
 * const geo = getPrototypeGeometry('circle:8', () => new CircleGeometry(4, 24));
 * ```
 */
export function getPrototypeGeometry(key: string, factory: () => BufferGeometry): BufferGeometry {
  const cached = geometryCache.get(key);
  if (cached) return cached;
  const created = factory();
  geometryCache.set(key, created);
  return created;
}

/** 清空几何缓存（后端销毁时调用；几何之间有引用，必须逐个 dispose）。 */
export function disposePrototypeGeometries(): void {
  for (const geometry of geometryCache.values()) geometry.dispose();
  geometryCache.clear();
}

/** 圆形点原型（半径由实例矩阵缩放，故几何取单位半径）。 */
export function getCirclePrototype(): BufferGeometry {
  return getPrototypeGeometry('prototype:circle:unit', () => new CircleGeometry(0.5, 24));
}

/** 矩形点原型（单位宽高由实例矩阵缩放）。 */
export function getRectPrototype(): BufferGeometry {
  return getPrototypeGeometry('prototype:rect:unit', () => new PlaneGeometry(1, 1));
}

/**
 * 挤出圆盘原型（`extrude > 0` 时有厚度；半径单位化）。
 *
 * 几何沿局部 +Z 从 -0.5 挤到 +0.5（**居中**）：这样实例矩阵把局部 Z 缩放成
 * `extrude` 后，只需把中心抬到 `地面 + extrude/2` 即得「底面贴地」的圆柱。
 * 若不居中（ExtrudeGeometry 缺省 0..1），底面会被额外抬高半个厚度。
 */
export function getDiscPrototype(): BufferGeometry {
  return getPrototypeGeometry('prototype:disc:unit', () => {
    const shape = new Shape();
    shape.absarc(0, 0, 0.5, 0, Math.PI * 2, false);
    const geometry = new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 24 });
    geometry.translate(0, 0, -0.5);
    return geometry;
  });
}

/** 网格平面几何（一张四边形，尺寸由调用方传入并把尺寸编码进键）。 */
export function getPlaneGeometry(width: number, height: number): BufferGeometry {
  return getPrototypeGeometry(`plane:${width}x${height}`, () => new PlaneGeometry(width, height));
}

/** 多边形几何（无挤出时用 ShapeGeometry）。 */
export function getPolygonGeometry(points: ReadonlyArray<{ x: number; y: number }>): BufferGeometry {
  const shape = new Shape();
  points.forEach((pt, index) => {
    if (index === 0) shape.moveTo(pt.x, pt.y);
    else shape.lineTo(pt.x, pt.y);
  });
  shape.closePath();
  return new ShapeGeometry(shape);
}

/** 多边形挤出几何（`extrude > 0`）。 */
export function getExtrudedPolygonGeometry(
  points: ReadonlyArray<{ x: number; y: number }>,
  depth: number,
): BufferGeometry {
  const shape = new Shape();
  points.forEach((pt, index) => {
    if (index === 0) shape.moveTo(pt.x, pt.y);
    else shape.lineTo(pt.x, pt.y);
  });
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

/**
 * 折线几何（用于粗线 addon 的 `LineGeometry.setPositions`）。
 *
 * 返回扁平坐标数组而非 `BufferGeometry`：粗线 addon 有自己的几何类型，
 * 这里只负责把二维平面点映射到三维地面（`x, y, z` → `x, 0, y`）。
 */
export function polylinePositions(
  points: ReadonlyArray<{ x: number; y: number }>,
  z: number,
  closed: boolean,
): number[] {
  const out: number[] = [];
  for (const pt of points) out.push(pt.x, z, pt.y);
  if (closed && points.length > 0) {
    const first = points[0];
    out.push(first.x, z, first.y);
  }
  return out;
}

/** 顶点圆点用的简单几何（复用单位圆）。 */
export function getVertexDotGeometry(): BufferGeometry {
  return getCirclePrototype();
}

/** 生成用于 `GridHelper` 风格网格的线段位置（世界平面）。 */
export function gridLinePositions(options: {
  x: number;
  y: number;
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  z: number;
}): number[] {
  const { x, y, cols, rows, cellWidth, cellHeight, z } = options;
  const out: number[] = [];
  const width = cols * cellWidth;
  const height = rows * cellHeight;
  for (let col = 0; col <= cols; col += 1) {
    const px = x + col * cellWidth;
    out.push(px, z, y, px, z, y + height);
  }
  for (let row = 0; row <= rows; row += 1) {
    const pz = y + row * cellHeight;
    out.push(x, z, pz, x + width, z, pz);
  }
  return out;
}

/** 由线段位置数组建 `BufferGeometry`（供非粗线场景使用）。 */
export function positionsToLineGeometry(positions: readonly number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([...positions], 3));
  return geometry;
}

/** 把二维平面坐标转成 three 的 `Vector2`（供 Shape 使用）。 */
export function toVector2(pt: { x: number; y: number }): Vector2 {
  return new Vector2(pt.x, pt.y);
}

/** 二维档正交相机的可见平面尺寸（供网格/平面几何换算）。 */
export function orthoVisibleSize(plan: OrthoCameraPlan): { width: number; height: number } {
  return { width: plan.right - plan.left, height: plan.top - plan.bottom };
}

/** 矩形点用单位盒（带厚度时缩放 y）。 */
export function getUnitBoxPrototype(): BufferGeometry {
  return getPrototypeGeometry('prototype:box:unit', () => new BoxGeometry(1, 1, 1));
}
