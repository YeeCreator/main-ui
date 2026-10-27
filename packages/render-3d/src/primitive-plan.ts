/**
 * render-3d/primitive-plan —— 快照 → 绘制计划（纯函数，无 three 依赖）。
 *
 * 设计 §十九 7「实例化硬规矩」：内容侧不得为每个实体生成独立几何；同类实体必须
 * 归一化到少数原型几何再实例化。本文件把这条规矩**做成可检验的数据结构**：
 * 计划里同一 `prototypeKey` 只有**一个**原型几何，其实体全部落在 `instances` 数组里。
 *
 * 判据（可断言）：`prototypeCount === uniquePrototypes.size`，而
 * `totalInstanceCount` 可以远大于它 —— 二者相差即实例化生效。
 */

import type {
  EntityBatch,
  EntitySnapshot,
  GridSpec,
  PolygonItem,
  PolylineItem,
  SpriteItem,
  TextBillboard,
  TextItem,
} from '@main-ui/core/primitives';
import {
  batchToPolygonItems,
  batchToPolylineItems,
  batchToSpriteItems,
  batchToTextItems,
} from '@main-ui/core/primitives';
import { LAYER_Z, colorToCss } from './units';

/** 实例化图元（共享原型几何 + 逐实例属性）。 */
export interface InstancePlan {
  /** 原型键（同键共享同一几何与同一材质）。 */
  prototypeKey: string;
  /** 几何形状（点/精灵）。 */
  shape: 'circle' | 'rect' | 'plane';
  /** 逐实例属性（列式，供 `InstancedMesh.setMatrixAt` 直写）。 */
  instances: Array<{
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    extrude: number;
    color: number;
  }>;
}

/** 独立几何图元（每条内容自有顶点；多边形与折线无法共享原型）。 */
export interface UniqueGeometryPlan {
  key: string;
  kind: 'polygon' | 'polyline';
  /**
   * 点（世界坐标；three 侧映射到 XZ 平面，`z` 抬升高度）。
   *
   * 折线**逐点可带 `z`**：一维复形是有不同高度的弧，整条统一 `z` 会把三维弧
   * 压成平面直线。多边形（面）仍是平面点，`z` 只作整条的层偏移。
   */
  points: ReadonlyArray<{ x: number; y: number; z?: number }>;
  z: number;
  extrude: number;
  fill?: string;
  fillAlpha?: number;
  stroke?: string;
  strokeWidth?: number;
  closed: boolean;
  vertexRadius?: number;
  vertexColor?: string;
}

/** 文字图元（MSDF；汉字按需生成，须共享同一材质）。 */
export interface TextPlan {
  x: number;
  y: number;
  z: number;
  text: string;
  fontSize: number;
  color: string;
  anchorX: number;
  anchorY: number;
  /** 公告牌朝向（仅三维档生效；缺省 `'full'`）。 */
  billboard?: TextBillboard;
}

/** 网格图元（程序化距离函数或平面贴图）。 */
export interface GridPlan {
  x: number;
  y: number;
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  lineColor: string;
  lineWidth: number;
  cellFill?: [string, string];
}

/** 一整帧的绘制计划。 */
export interface ScenePlan {
  /** 实例化分组（键 → 分组）。 */
  instanced: Map<string, InstancePlan>;
  /** 独立几何（多边形/折线）。 */
  unique: UniqueGeometryPlan[];
  /** 文字。 */
  texts: TextPlan[];
  /** 网格（可选）。 */
  grid: GridPlan | null;
  /** 原型几何数量（实例化判据的分子）。 */
  prototypeCount: number;
  /** 实体总数（实例化判据的分母）。 */
  instanceCount: number;
}

/** 数值色列读取（缺省回退）。 */
function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * 把一份快照 + 网格编译成绘制计划。
 *
 * 纯函数：同一输入必产出同一输出，便于单测「带 z 与不带 z 的二维档等价」等判据。
 *
 * @param options 快照与网格（均为可选）。
 * @returns 绘制计划。
 * @example
 * ```ts
 * const plan = buildScenePlan({ snapshot, grid });
 * plan.prototypeCount; // 少量原型
 * plan.instanceCount;  // 大量实体
 * ```
 */
export function buildScenePlan(options: {
  snapshot?: EntitySnapshot | null;
  grid?: GridSpec | null;
}): ScenePlan {
  const plan: ScenePlan = {
    instanced: new Map(),
    unique: [],
    texts: [],
    grid: null,
    prototypeCount: 0,
    instanceCount: 0,
  };

  if (options.grid) {
    plan.grid = {
      x: options.grid.x,
      y: options.grid.y,
      cols: options.grid.cols,
      rows: options.grid.rows,
      cellWidth: options.grid.cellWidth,
      cellHeight: options.grid.cellHeight,
      lineColor: colorToCss(options.grid.lineColor, 0x333333),
      lineWidth: options.grid.lineWidth ?? 1,
      cellFill: options.grid.cellFill
        ? [colorToCss(options.grid.cellFill[0]), colorToCss(options.grid.cellFill[1])]
        : undefined,
    };
  }

  const batches = options.snapshot ? Object.values(options.snapshot.batches) : [];
  for (const batch of batches) {
    switch (batch.geometry) {
      case 'point':
      case 'sprite':
        addSpriteBatch(plan, batch);
        break;
      case 'text':
        addTextBatch(plan, batch);
        break;
      case 'polygon':
        addPolygonBatch(plan, batch);
        break;
      case 'polyline':
        addPolylineBatch(plan, batch);
        break;
      default:
        break;
    }
  }

  plan.prototypeCount = plan.instanced.size;
  return plan;
}

function addSpriteBatch(plan: ScenePlan, batch: EntityBatch): void {
  const items: SpriteItem[] = batchToSpriteItems(batch);
  const hasExtrude = Boolean(batch.columns.extrude);
  for (const item of items) {
    const width = item.width ?? 32;
    const height = item.height ?? 32;
    const color = item.color ?? 0x888888;
    const shape: 'circle' | 'rect' = item.shape === 'rect' ? 'rect' : 'circle';
    const texture = typeof item.texture === 'string' ? item.texture : '';
    // 原型键 = 形状 + 尺寸 + 外观（纹理/色）：同类实体归一到这里，几何只造一次。
    const key = `sprite:${shape}:${width}x${height}:${texture || `c${color}`}`;
    let group = plan.instanced.get(key);
    if (!group) {
      group = { prototypeKey: key, shape, instances: [] };
      plan.instanced.set(key, group);
    }
    group.instances.push({
      x: item.x,
      y: item.y,
      z: (item.z ?? 0) + LAYER_Z.sprite,
      width,
      height,
      extrude: hasExtrude ? num(item.extrude, 0) : (item.extrude ?? 0),
      color,
    });
    plan.instanceCount += 1;
  }
}

function addTextBatch(plan: ScenePlan, batch: EntityBatch): void {
  const items: TextItem[] = batchToTextItems(batch);
  for (const item of items) {
    plan.texts.push({
      x: item.x,
      y: item.y,
      z: (item.z ?? 0) + LAYER_Z.text,
      text: item.text,
      fontSize: item.fontSize ?? 32,
      color: colorToCss(item.color, 0x000000),
      anchorX: item.anchorX ?? 0.5,
      anchorY: item.anchorY ?? 0.5,
      billboard: item.billboard,
    });
    plan.instanceCount += 1;
  }
}

function addPolygonBatch(plan: ScenePlan, batch: EntityBatch): void {
  const items: PolygonItem[] = batchToPolygonItems(batch);
  items.forEach((item, index) => {
    plan.unique.push({
      key: `${batch.kind}:polygon:${index}`,
      kind: 'polygon',
      points: item.points,
      z: (item.z ?? 0) + LAYER_Z.polygon,
      extrude: item.extrude ?? 0,
      fill: item.fill != null ? colorToCss(item.fill) : undefined,
      fillAlpha: item.fillAlpha,
      stroke: item.stroke != null ? colorToCss(item.stroke) : undefined,
      strokeWidth: item.strokeWidth,
      closed: item.closed ?? true,
    });
    plan.instanceCount += 1;
  });
}

function addPolylineBatch(plan: ScenePlan, batch: EntityBatch): void {
  const items: PolylineItem[] = batchToPolylineItems(batch);
  items.forEach((item, index) => {
    plan.unique.push({
      key: `${batch.kind}:polyline:${index}`,
      kind: 'polyline',
      points: item.points,
      z: (item.z ?? 0) + LAYER_Z.polyline,
      extrude: 0,
      fill: item.fill != null ? colorToCss(item.fill) : undefined,
      fillAlpha: item.fillAlpha,
      stroke: item.stroke != null ? colorToCss(item.stroke) : undefined,
      strokeWidth: item.strokeWidth ?? 1,
      closed: item.closed ?? false,
      vertexRadius: item.vertexRadius,
      vertexColor: item.vertexColor != null ? colorToCss(item.vertexColor) : undefined,
    });
    plan.instanceCount += 1;
  });
}

/**
 * 实例化合规判据（设计 §十九 13 判据 3）。
 *
 * 违规定义：**一帧内 N 种不同几何对应 N 个同类实体**。换算成可检验形式：
 * 存在某几何形状类下「原型数 ≥ 实体数」（即几乎没合并）且实体数 > 1。
 *
 * @param plan 绘制计划。
 * @returns 违规描述数组；空数组 = 合规。
 */
export function findInstancingViolations(plan: ScenePlan): string[] {
  const violations: string[] = [];
  const byShape = new Map<string, { prototypes: number; entities: number }>();
  for (const group of plan.instanced.values()) {
    const entry = byShape.get(group.shape) ?? { prototypes: 0, entities: 0 };
    entry.prototypes += 1;
    entry.entities += group.instances.length;
    byShape.set(group.shape, entry);
  }
  for (const [shape, entry] of byShape) {
    if (entry.entities > 1 && entry.prototypes >= entry.entities) {
      violations.push(`形状 ${shape}：${entry.entities} 个实体却有 ${entry.prototypes} 个原型（未实例化）`);
    }
  }
  return violations;
}
