/**
 * render-3d/scene-builder —— 绘制计划 → three 场景对象。
 *
 * 三条硬规矩的落点：
 * 1. **实例化**：同一 `prototypeKey` 只建**一个** `InstancedMesh`，
 *    逐实例用 `setMatrixAt` 写位置/尺寸，绝不 materialize 逐实体 `Object3D`。
 * 2. **共面闪面**：折线/多边形按 `LAYER_Z` 抬高极小量（见 `units.ts`）。
 * 3. **线条禁贴图**：网格线走粗线 addon（屏幕空间宽度）或线几何，均不带贴图。
 */

import {
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { InstancePlan, ScenePlan } from './primitive-plan';
import {
  getCirclePrototype,
  getDiscPrototype,
  getExtrudedPolygonGeometry,
  getPlaneGeometry,
  getPolygonGeometry,
  getRectPrototype,
  gridLinePositions,
  polylinePositions,
  positionsToLineGeometry,
} from './geometry-factory';
import { createWideLine, createWideSegments, wideLinesAvailable } from './wide-lines';
import { createSpriteText, syncTextBillboard } from './text-sprite';
import { LAYER_Z } from './units';

/** 构建结果：根对象 + 显式销毁 + 线宽分辨率同步。 */
export interface BuiltScene {
  root: Group;
  /** 释放本批创建的资源（几何/材质/文字图集引用）。 */
  dispose(): void;
  /** 把画布像素尺寸同步给粗线材质（线宽按屏幕像素计算）。 */
  syncLineResolution(width: number, height: number): void;
  /** `'axis'` 档贴片的每帧对齐（无该档贴片时是空操作）。 */
  syncBillboards(
    cameraPosition: { x: number; y: number; z: number },
    cameraUp?: { x: number; y: number; z: number },
  ): void;
}

/** 构建选项。 */
export interface BuildSceneOptions {
  /** 投影类型（仅用于决定是否启用受光材质；二维档正交 + 无光照）。 */
  projection: 'orthographic' | 'perspective';
}

/**
 * 把绘制计划编译为 three 场景。
 *
 * @param plan 绘制计划（`buildScenePlan` 的产物）。
 * @param options 构建选项。
 * @returns 构建结果。
 * @example
 * ```ts
 * const built = planToSceneObjects(plan, { projection: 'orthographic' });
 * world.add(built.root);
 * ```
 */
export function planToSceneObjects(plan: ScenePlan, options: BuildSceneOptions): BuiltScene {
  const root = new Group();
  root.name = 'scene-root';

  const disposables: Array<{ dispose(): void }> = [];
  /**
   * 需要每帧对齐相机的贴片（`'full'` 与 `'axis'` 两档）。
   *
   * 传统 `MeshBasicMaterial` 没有 `Sprite` 的自动 billboard，故两档都要手动对齐；
   * `'none'` 档不登记（朝向由调用方决定）。
   */
  const billboards: Array<import('three').Object3D> = [];
  const wideLines: Array<{ resolution?: { set(x: number, y: number): void } }> = [];

  // ---- 网格（场层）：粗线 + 可选交替填充面 ----
  if (plan.grid) {
    const grid = plan.grid;
    const positions = gridLinePositions({
      x: grid.x,
      y: grid.y,
      cols: grid.cols,
      rows: grid.rows,
      cellWidth: grid.cellWidth,
      cellHeight: grid.cellHeight,
      z: LAYER_Z.polygon,
    });
    if (positions.length >= 6) {
      // 线宽 ≤ 1 一律走**原生线段**：粗线 addon（webgpu 版）在实测中不渲染（见下方说明），
      // 而 1px 恰是二维档预设要的观感（线条禁贴图、与二维后端一致）。
      // 粗线只在需要 >1px 时启用；失败则降级。
      const useWide = grid.lineWidth > 1 && wideLinesAvailable();
      if (useWide) {
        const segments = createWideSegments(positions, grid.lineWidth, grid.lineColor);
        const material = segments.material as unknown as { resolution?: { set(x: number, y: number): void } };
        if (material.resolution) wideLines.push(material);
        root.add(segments);
        disposables.push(segments.geometry, segments.material as unknown as { dispose(): void });
      } else {
        const fallback = buildFallbackLine(positions, grid.lineColor);
        root.add(fallback);
        disposables.push(fallback.geometry, fallback.material as unknown as { dispose(): void });
      }
    }

    if (grid.cellFill) {
      // 网格交替填充：**同一颜色共享一个原型几何 + InstancedMesh**。
      // 早期写成「逐格 new Mesh」会逐数字符串违反实例化硬规矩（设计 §十九 7）。
      const [fillA, fillB] = grid.cellFill;
      const cellsByColor = new Map<string, Array<{ x: number; y: number }>>();
      for (let row = 0; row < grid.rows; row += 1) {
        for (let col = 0; col < grid.cols; col += 1) {
          const fill = grid.cellFill[(row + col) % 2];
          if (!fill) continue;
          const key = (row + col) % 2 === 0 ? fillA : fillB;
          const list = cellsByColor.get(key) ?? [];
          list.push({
            x: grid.x + col * grid.cellWidth + grid.cellWidth / 2,
            y: grid.y + row * grid.cellHeight + grid.cellHeight / 2,
          });
          cellsByColor.set(key, list);
        }
      }

      const cellMatrix = new Matrix4();
      const cellPosition = new Vector3();
      const cellQuaternion = new Quaternion();
      const cellScale = new Vector3();
      for (const [color, cells] of cellsByColor) {
        const geometry = getPlaneGeometry(grid.cellWidth, grid.cellHeight);
        const material = new MeshBasicMaterial({ color: new Color(color), side: DoubleSide });
        const mesh = new InstancedMesh(geometry, material, cells.length);
        cells.forEach((cell, index) => {
          // PlaneGeometry 在 XY 平面：绕 X 轴 -90° 转到地面，再用矩阵定位。
          cellPosition.set(cell.x, LAYER_Z.polygon - 0.01, cell.y);
          cellScale.set(1, 1, 1);
          cellQuaternion.setFromEuler(new Euler(-Math.PI / 2, 0, 0));
          cellMatrix.compose(cellPosition, cellQuaternion, cellScale);
          mesh.setMatrixAt(index, cellMatrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.name = `grid-fill:${color}`;
        root.add(mesh);
        disposables.push(material);
      }
    }
  }

  // ---- 多边形（真几何；extrude > 0 时有厚度） ----
  for (const item of plan.unique) {
    if (item.kind !== 'polygon') continue;
    // 非有限值守卫：NaN 顶点会让 ShapeGeometry 产生 NaN 包围盒。
    if (item.points.length < 3 || !item.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) continue;
    if (!Number.isFinite(item.extrude) || item.extrude < 0) continue;
    const geometry = item.extrude > 0
      ? getExtrudedPolygonGeometry(item.points, item.extrude)
      : getPolygonGeometry(item.points);
    const material = new MeshBasicMaterial({
      color: new Color(item.fill ?? '#888888'),
      side: DoubleSide,
      transparent: (item.fillAlpha ?? 1) < 1,
      opacity: item.fillAlpha ?? 1,
      // 无光照：MeshBasicMaterial 即 unlit，符合二维档预设第 2 条。
    });
    const mesh = new Mesh(geometry, material);
    mesh.position.y = item.z;
    // ShapeGeometry 在 XY 平面，绕 X 轴 -90° 转到 XZ 地面平面（three Y 向上）。
    mesh.rotation.x = -Math.PI / 2;
    root.add(mesh);
    disposables.push(geometry, material);
  }

  // ---- 折线（粗线：屏幕空间宽度；不走贴图） ----
  for (const item of plan.unique) {
    if (item.kind !== 'polyline') continue;
    // 非有限值守卫：NaN 顶点会造出 NaN 线宽/包围盒。
    if (!item.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) continue;
    if (!Number.isFinite(item.strokeWidth ?? 1) || (item.strokeWidth ?? 1) <= 0) continue;
    const positions = polylinePositions(item.points, item.z, item.closed);
    if (positions.length < 6) continue;
    const strokeWidth = item.strokeWidth ?? 1;
    const useWide = strokeWidth > 1 && wideLinesAvailable();
    if (useWide) {
      const line = createWideLine({
        positions,
        lineWidth: strokeWidth,
        color: item.stroke ?? '#333333',
        worldUnits: false,
        opacity: item.fillAlpha ?? 1,
      });
      const material = line.material as unknown as { resolution?: { set(x: number, y: number): void } };
      if (material.resolution) wideLines.push(material);
      root.add(line);
      disposables.push(line.geometry, line.material as unknown as { dispose(): void });
    } else {
      // 1px 或不支持粗线：降级到原生线段（保证可见，不保证线宽可变）
      const fallback = buildFallbackLine(positions, item.stroke ?? '#333333');
      root.add(fallback);
      disposables.push(fallback.geometry, fallback.material as unknown as { dispose(): void });
    }
  }

  // ---- 实例化分组（同类实体共享原型几何） ----
  const matrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3();
  for (const group of plan.instanced.values()) {
    const instanced = buildInstanced(group, matrix, position, scale);
    if (!instanced) continue;
    root.add(instanced.mesh);
    disposables.push(instanced.material);
  }

  // ---- 文字（公告牌贴片） ----
  //
  // 设计 §十九 7：**三维档文字一律走公告牌二维贴片**（Canvas 2D → CanvasTexture
  // → Sprite），不走 MSDF。理由见 `text-sprite.ts` 文件头：贴片场景（血条、
  // 名字标签）不需要矢量锐利，且 `Sprite` 用 three 内置材质，彻底绕开
  // 「TSL 材质在 WebGPU 下的图集采样」这个生态缺口（`text-tsl.ts` 有实测记录）。
  //
  // 二维档仍走 `text-factory` 的 MSDF —— 那条路由 Pixi 后端消费，不受影响。
  for (const text of plan.texts) {
    // 非有限值守卫：坐标 NaN 时直接跳过（不要挂进场景）。
    if (![text.x, text.y, text.z, text.fontSize].every((v) => Number.isFinite(v)) || text.fontSize <= 0) continue;
    const label = createSpriteText({
      text: text.text,
      fontSize: text.fontSize,
      color: text.color,
      // 计划里 y 是平面纵轴（与二维档同语义），三维里高度轴是 y：
      // 平面 (x, y) → 世界 (x, 0, y)，与其它图元同处 XZ 地面。
      position: { x: text.x, y: LAYER_Z.text, z: text.y },
      anchorX: text.anchorX,
      anchorY: text.anchorY,
      billboard: text.billboard,
    });

    // 贴片文字的锚点是「文字块中心」，而 `anchorX/anchorY` 已经在栅格化时按
    // 居中绘制处理；此处只需把整体沿平面平移，使锚点落在 (x, y)。
    const offsetX = (0.5 - (text.anchorX ?? 0.5)) * label.width;
    const offsetY = (0.5 - (text.anchorY ?? 0.5)) * label.height;
    label.object.position.x += offsetX;
    label.object.position.z += offsetY;

    // `'full'` 与 `'axis'` 都需要每帧对齐相机，登记下来由 syncBillboards 处理
    if (label.billboard !== 'none') billboards.push(label.object);

    root.add(label.object);
    disposables.push({ dispose: label.dispose });
  }

  const syncLineResolution = (width: number, height: number): void => {
    for (const material of wideLines) material.resolution?.set(width, height);
  };

  /**
   * `'axis'` 档贴片的每帧对齐：只绕 Y 轴转向相机。
   *
   * `'full'` 档由 `Sprite` 内置 billboard 自动处理，不需要本函数；
   * 只有存在 `'axis'` 贴片时才真正做事（数组为空则直接返回）。
   */
  const syncBillboards = (
    cameraPosition: { x: number; y: number; z: number },
    cameraUp: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 },
  ): void => {
    for (const object of billboards) syncTextBillboard(object, cameraPosition, cameraUp);
  };

  return {
    root,
    dispose() {
      for (const item of disposables) item.dispose();
      billboards.length = 0;
      // 文字与线段的几何/材质由 three 的 dispose 链路处理；这里清空引用即可。
      root.clear();
    },
    syncLineResolution,
    syncBillboards,
  };
}


/** 建一个实例化网格（原型几何 + 逐实例矩阵）。 */
function buildInstanced(
  group: InstancePlan,
  matrix: Matrix4,
  position: Vector3,
  scale: Vector3,
): { mesh: InstancedMesh; material: MeshBasicMaterial } | null {
  const count = group.instances.length;
  if (count === 0) return null;

  // 原型选择：**有厚度时用单位圆盘（含侧壁体积）**，否则用纯平面。
  // 平面图形（CircleGeometry / PlaneGeometry）本身没有厚度，沿 Z 缩放也长不出体积；
  // 挤出档必须换成真体积原型，否则 "extrude > 0" 在画面上仍是平的。
  const wantsVolume = group.shape === 'circle' && group.instances.some((it) => it.extrude > 0);
  const geometry = wantsVolume
    ? getDiscPrototype()
    : group.shape === 'rect'
      ? getRectPrototype()
      : getCirclePrototype();
  // 原型是单位尺寸：逐实例用矩阵缩放到实际宽高（同类共用同一几何）。
  const representative = group.instances[0];
  const material = new MeshBasicMaterial({
    // 同类实体共用一个材质时色值相同（原型键已把色值编码进去）。
    color: new Color(colorOf(representative.color)),
    side: DoubleSide,
    // 无光照：MeshBasicMaterial 不受灯影响。
  });

  const mesh = new InstancedMesh(geometry, material, count);

  // 原型几何在 **XY 平面**（CircleGeometry / PlaneGeometry 的固有朝向）。
  // 要让它平铺在地面（XZ 平面），必须绕 X 轴 -90°：局部 +Y 于是映射到世界 -Z。
  // ⚠️ 历史缺陷（2026-10-27 实测）：未旋转时圆盘垂直于视线，俯视下退化成一条细线/小点。
  const flat = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0));

  let written = 0;
  group.instances.forEach((instance) => {
    // 非有限值守卫：NaN / Infinity 进实例矩阵会让 WebGPU 的 drawIndexed
    // 收到非法 count 而抛错并**中断整帧**（2026-10-27 浏览器实测教训）。
    if (!isFiniteInstance(instance)) return;
    const hasExtrude = instance.extrude > 0;
    // extrude 语义 = **从地面向上挤出的厚度**：几何原点移到厚度中点，
    // 使底面正好贴在地面（不悬空、不陷入）。坐标系：世界 +Y 向上。
    position.set(instance.x, instance.z + (hasExtrude ? instance.extrude / 2 : 0), instance.y);
    // 旋转后局部轴与世界轴的对应：局部 X → 世界 X，局部 Y → 世界 -Z，局部 Z → 世界 Y。
    // 故宽走 X、高走 Y、挤出厚度走 Z。
    scale.set(instance.width, instance.height, hasExtrude ? instance.extrude : 1);
    matrix.compose(position, flat, scale);
    mesh.setMatrixAt(written, matrix);
    written += 1;
  });
  if (written === 0) {
    mesh.dispose();
    material.dispose();
    return null;
  }
  // 实际写入少于申请数时收窄 count，避免尾部矩阵全为零的膨胀。
  mesh.count = written;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.name = group.prototypeKey;
  return { mesh, material };
}

/** 实例属性全部有限才可进渲染队列。 */
function isFiniteInstance(instance: InstancePlan['instances'][number]): boolean {
  return [instance.x, instance.y, instance.z, instance.width, instance.height, instance.extrude]
    .every((v) => Number.isFinite(v)) && instance.width > 0 && instance.height > 0;
}

function colorOf(value: number): string {
  return `#${(value & 0xffffff).toString(16).padStart(6, '0')}`;
}

/** 兜底：供 `threeBackend` 在需要时构建简单线几何（粗线不可用时）。 */
export function buildFallbackLine(positions: readonly number[], color: string): LineSegments {
  const geometry = positionsToLineGeometry(positions);
  const material = new LineBasicMaterial({ color: new Color(color) });
  return new LineSegments(geometry, material);
}
