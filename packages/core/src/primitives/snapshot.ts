/**
 * primitives/snapshot —— 把列式 EntityBatch 解析为具体图元项（自动渲染桥接）。
 *
 * view-world 的自动渲染模式据此把 EntitySnapshot 的每个批次映射为
 * TextItem[] / SpriteItem[] / PolygonItem[]，再交给对应图元渲染器。
 */
import type {
  EntityBatch,
  EntitySnapshot,
  PolygonItem,
  PolylineItem,
  SpriteItem,
  TextItem,
} from './types';

function numColumn(batch: EntityBatch, key: string, index: number, fallback = 0): number {
  const col = batch.columns[key];
  const v = col ? col[index] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function strColumn(batch: EntityBatch, key: string, index: number, fallback = ''): string {
  const col = batch.columns[key];
  const v = col ? col[index] : undefined;
  return typeof v === 'string' ? v : fallback;
}

/** 从 text 几何批次解析文字项。 */
export function batchToTextItems(batch: EntityBatch): TextItem[] {
  const items: TextItem[] = [];
  const hasZ = Boolean(batch.columns.z);
  const hasBillboard = Boolean(batch.columns.billboard);
  for (let i = 0; i < batch.count; i++) {
    const text = strColumn(batch, 'text', i);
    if (!text) continue;
    const item: TextItem = {
      x: numColumn(batch, 'x', i),
      y: numColumn(batch, 'y', i),
      text,
      fontSize: batch.columns.fontSize ? numColumn(batch, 'fontSize', i, 32) : 32,
      color: batch.columns.color ? numColumn(batch, 'color', i, 0x000000) : 0x000000,
    };
    if (hasZ) item.z = numColumn(batch, 'z', i);
    // 与 z/extrude 同口径：列不存在就不写字段，旧快照解析结果逐字段不变。
    if (hasBillboard) {
      const raw = strColumn(batch, 'billboard', i);
      if (raw === 'full' || raw === 'axis' || raw === 'none') item.billboard = raw;
    }
    items.push(item);
  }
  return items;
}

/** 从 sprite/point 几何批次解析精灵项。 */
export function batchToSpriteItems(batch: EntityBatch): SpriteItem[] {
  const items: SpriteItem[] = [];
  const hasZ = Boolean(batch.columns.z);
  const hasExtrude = Boolean(batch.columns.extrude);
  for (let i = 0; i < batch.count; i++) {
    const item: SpriteItem = {
      x: numColumn(batch, 'x', i),
      y: numColumn(batch, 'y', i),
      width: batch.columns.width ? numColumn(batch, 'width', i, 32) : 32,
      height: batch.columns.height ? numColumn(batch, 'height', i, 32) : 32,
      color: batch.columns.color ? numColumn(batch, 'color', i, 0x888888) : 0x888888,
      texture: batch.columns.texture ? strColumn(batch, 'texture', i) || undefined : undefined,
      shape: batch.geometry === 'point' ? 'circle' : (strColumn(batch, 'shape', i, 'rect') as 'circle' | 'rect'),
    };
    if (hasZ) item.z = numColumn(batch, 'z', i);
    if (hasExtrude) item.extrude = numColumn(batch, 'extrude', i);
    items.push(item);
  }
  return items;
}

/** 从 polygon 几何批次解析多边形项（columns.points 为 number[] 扁平数组或 {x,y}[] ）。 */
export function batchToPolygonItems(batch: EntityBatch): PolygonItem[] {
  const items: PolygonItem[] = [];
  const pointsCol = batch.columns.points;
  const hasZ = Boolean(batch.columns.z);
  const hasExtrude = Boolean(batch.columns.extrude);
  for (let i = 0; i < batch.count; i++) {
    const raw = pointsCol ? pointsCol[i] : undefined;
    const points = normalizePoints(raw);
    if (points.length < 2) continue;
    const item: PolygonItem = {
      points,
      fill: batch.columns.fill ? numColumn(batch, 'fill', i) : undefined,
      fillAlpha: batch.columns.fillAlpha ? numColumn(batch, 'fillAlpha', i, 1) : undefined,
      stroke: batch.columns.stroke ? numColumn(batch, 'stroke', i) : undefined,
      strokeWidth: batch.columns.strokeWidth ? numColumn(batch, 'strokeWidth', i, 1) : 1,
    };
    if (hasZ) item.z = numColumn(batch, 'z', i);
    if (hasExtrude) item.extrude = numColumn(batch, 'extrude', i);
    items.push(item);
  }
  return items;
}

/** 从 polyline 几何批次解析折线项（columns.points 为 number[] 扁平数组或 {x,y}[] ）。 */
export function batchToPolylineItems(batch: EntityBatch): PolylineItem[] {
  const items: PolylineItem[] = [];
  const pointsCol = batch.columns.points;
  const hasZ = Boolean(batch.columns.z);
  for (let i = 0; i < batch.count; i++) {
    const raw = pointsCol ? pointsCol[i] : undefined;
    const points = normalizePoints(raw);
    if (points.length < 2) continue;
    const item: PolylineItem = {
      points,
      stroke: batch.columns.stroke ? numColumn(batch, 'stroke', i) : undefined,
      strokeWidth: batch.columns.strokeWidth ? numColumn(batch, 'strokeWidth', i, 1) : 1,
      closed: batch.columns.closed ? Boolean(batch.columns.closed[i]) : false,
      vertexRadius: batch.columns.vertexRadius ? numColumn(batch, 'vertexRadius', i) : undefined,
      vertexColor: batch.columns.vertexColor ? numColumn(batch, 'vertexColor', i) : undefined,
      fill: batch.columns.fill ? numColumn(batch, 'fill', i) : undefined,
      fillAlpha: batch.columns.fillAlpha ? numColumn(batch, 'fillAlpha', i, 1) : undefined,
    };
    if (hasZ) item.z = numColumn(batch, 'z', i);
    items.push(item);
  }
  return items;
}

/**
 * 归一化点列：扁平数字数组或 `{x, y}` 对象数组。
 *
 * **对象数组的逐点 `z` 原样保留**（一维复形是有不同高度的弧）。扁平数组按
 * 两元素 stride 解析（既有行为）——扁平三元组无法与二维区分，需要逐点 `z`
 * 的调用方请传对象数组。
 *
 * @param raw 原始点列（扁平数字数组或对象数组）。
 * @returns 点列；非有限 `x` / `y` 的点被丢弃。
 */
function normalizePoints(raw: unknown): Array<{ x: number; y: number; z?: number }> {
  if (!Array.isArray(raw)) return [];
  // 扁平数组 [x0,y0,x1,y1,...]
  if (typeof raw[0] === 'number') {
    const out: Array<{ x: number; y: number; z?: number }> = [];
    for (let k = 0; k + 1 < raw.length; k += 2) {
      out.push({ x: Number(raw[k]), y: Number(raw[k + 1]) });
    }
    return out;
  }
  // 对象数组 [{x,y,z?},...]：保留逐点 z（只在有限时附带，避免 NaN 混进几何）
  return (raw as Array<{ x: number; y: number; z?: number }>)
    .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) =>
      typeof p.z === 'number' && Number.isFinite(p.z) ? { x: p.x, y: p.y, z: p.z } : { x: p.x, y: p.y },
    );
}

/** 解析整份快照：按几何类型分组为图元项集合（不含 grid，grid 由 view-world 单独配置）。 */
export interface SnapshotItems {
  texts: TextItem[];
  sprites: SpriteItem[];
  polygons: PolygonItem[];
  polylines: PolylineItem[];
}

export function snapshotToItems(snapshot: EntitySnapshot): SnapshotItems {
  const result: SnapshotItems = { texts: [], sprites: [], polygons: [], polylines: [] };
  for (const batch of Object.values(snapshot.batches)) {
    switch (batch.geometry) {
      case 'text':
        result.texts.push(...batchToTextItems(batch));
        break;
      case 'sprite':
      case 'point':
        result.sprites.push(...batchToSpriteItems(batch));
        break;
      case 'polygon':
        result.polygons.push(...batchToPolygonItems(batch));
        break;
      case 'polyline':
        result.polylines.push(...batchToPolylineItems(batch));
        break;
      default:
        break;
    }
  }
  return result;
}
