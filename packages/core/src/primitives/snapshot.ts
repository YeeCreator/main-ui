/**
 * primitives/snapshot —— 把列式 EntityBatch 解析为具体图元项（自动渲染桥接）。
 *
 * view-world 的自动渲染模式据此把 EntitySnapshot 的每个批次映射为
 * TextItem[] / SpriteItem[] / PolygonItem[]，再交给对应图元渲染器。
 */
import type { EntityBatch, EntitySnapshot, PolygonItem, SpriteItem, TextItem } from './types';

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
  for (let i = 0; i < batch.count; i++) {
    const text = strColumn(batch, 'text', i);
    if (!text) continue;
    items.push({
      x: numColumn(batch, 'x', i),
      y: numColumn(batch, 'y', i),
      text,
      fontSize: batch.columns.fontSize ? numColumn(batch, 'fontSize', i, 32) : 32,
      color: batch.columns.color ? numColumn(batch, 'color', i, 0x000000) : 0x000000,
    });
  }
  return items;
}

/** 从 sprite/point 几何批次解析精灵项。 */
export function batchToSpriteItems(batch: EntityBatch): SpriteItem[] {
  const items: SpriteItem[] = [];
  for (let i = 0; i < batch.count; i++) {
    items.push({
      x: numColumn(batch, 'x', i),
      y: numColumn(batch, 'y', i),
      width: batch.columns.width ? numColumn(batch, 'width', i, 32) : 32,
      height: batch.columns.height ? numColumn(batch, 'height', i, 32) : 32,
      color: batch.columns.color ? numColumn(batch, 'color', i, 0x888888) : 0x888888,
      texture: batch.columns.texture ? strColumn(batch, 'texture', i) || undefined : undefined,
      shape: batch.geometry === 'point' ? 'circle' : (strColumn(batch, 'shape', i, 'rect') as 'circle' | 'rect'),
    });
  }
  return items;
}

/** 从 polygon 几何批次解析多边形项（columns.points 为 number[] 扁平数组或 {x,y}[] ）。 */
export function batchToPolygonItems(batch: EntityBatch): PolygonItem[] {
  const items: PolygonItem[] = [];
  const pointsCol = batch.columns.points;
  for (let i = 0; i < batch.count; i++) {
    const raw = pointsCol ? pointsCol[i] : undefined;
    const points = normalizePoints(raw);
    if (points.length < 2) continue;
    items.push({
      points,
      fill: batch.columns.fill ? numColumn(batch, 'fill', i) : undefined,
      fillAlpha: batch.columns.fillAlpha ? numColumn(batch, 'fillAlpha', i, 1) : undefined,
      stroke: batch.columns.stroke ? numColumn(batch, 'stroke', i) : undefined,
      strokeWidth: batch.columns.strokeWidth ? numColumn(batch, 'strokeWidth', i, 1) : 1,
    });
  }
  return items;
}

function normalizePoints(raw: unknown): Array<{ x: number; y: number }> {
  if (!Array.isArray(raw)) return [];
  // 扁平数组 [x0,y0,x1,y1,...]
  if (typeof raw[0] === 'number') {
    const out: Array<{ x: number; y: number }> = [];
    for (let k = 0; k + 1 < raw.length; k += 2) {
      out.push({ x: Number(raw[k]), y: Number(raw[k + 1]) });
    }
    return out;
  }
  // 对象数组 [{x,y},...]
  return (raw as Array<{ x: number; y: number }>).filter(
    (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y),
  );
}

/** 解析整份快照：按几何类型分组为图元项集合（不含 grid，grid 由 view-world 单独配置）。 */
export interface SnapshotItems {
  texts: TextItem[];
  sprites: SpriteItem[];
  polygons: PolygonItem[];
}

export function snapshotToItems(snapshot: EntitySnapshot): SnapshotItems {
  const result: SnapshotItems = { texts: [], sprites: [], polygons: [] };
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
      default:
        break;
    }
  }
  return result;
}
