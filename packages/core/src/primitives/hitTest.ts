/**
 * primitives/hitTest —— 通用命中测试（纯函数，世界坐标）。
 *
 * view-world 的 InteractionLayer 先把屏幕坐标经相机换算成世界坐标，
 * 再用这里的纯函数判定命中了哪个格/实体。
 */
import type { GridSpec, WorldBounds } from './types';

export interface GridHit {
  col: number;
  row: number;
}

/** 命中网格：把世界坐标映射到 (col,row)；越界返回 null。 */
export function hitTestGrid(worldX: number, worldY: number, spec: GridSpec): GridHit | null {
  const col = Math.floor((worldX - spec.x) / spec.cellWidth);
  const row = Math.floor((worldY - spec.y) / spec.cellHeight);
  if (col < 0 || col >= spec.cols || row < 0 || row >= spec.rows) return null;
  return { col, row };
}

/** 网格 (col,row) 的中心世界坐标。 */
export function gridCellCenter(spec: GridSpec, col: number, row: number): { x: number; y: number } {
  return {
    x: spec.x + col * spec.cellWidth + spec.cellWidth / 2,
    y: spec.y + row * spec.cellHeight + spec.cellHeight / 2,
  };
}

/** 命中矩形范围。 */
export function hitTestBounds(worldX: number, worldY: number, bounds: WorldBounds): boolean {
  return (
    worldX >= bounds.x &&
    worldX <= bounds.x + bounds.width &&
    worldY >= bounds.y &&
    worldY <= bounds.y + bounds.height
  );
}

/** 命中圆形实体（中心 + 半径）。 */
export function hitTestCircle(worldX: number, worldY: number, cx: number, cy: number, radius: number): boolean {
  const dx = worldX - cx;
  const dy = worldY - cy;
  return dx * dx + dy * dy <= radius * radius;
}

/** 射线法判定世界坐标是否落在多边形内。 */
export function hitTestPolygon(worldX: number, worldY: number, points: ReadonlyArray<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersect = yi > worldY !== yj > worldY && worldX < ((xj - xi) * (worldY - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
