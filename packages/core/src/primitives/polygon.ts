/**
 * primitives/polygon —— 多边形/路径图元渲染（PixiJS v8）。
 */
import { Container, Graphics } from 'pixi.js';
import type { PolygonItem } from './types';

/** 创建单个多边形图元。 */
export function createPolygon(item: PolygonItem): Graphics {
  const g = new Graphics();
  const flat: number[] = [];
  for (const p of item.points) {
    flat.push(p.x, p.y);
  }
  if (flat.length < 4) return g;

  g.poly(flat);
  if (item.fill != null) {
    g.fill({ color: item.fill, alpha: item.fillAlpha ?? 1 });
  }
  if (item.stroke != null) {
    g.stroke({ width: item.strokeWidth ?? 1, color: item.stroke });
  }
  return g;
}

/** 批量创建多边形图元，返回一个 Container 层。 */
export function createPolygonLayer(items: readonly PolygonItem[]): Container {
  const layer = new Container();
  layer.label = 'polygon';
  for (const item of items) {
    layer.addChild(createPolygon(item));
  }
  return layer;
}

/** 在既有容器上就地绘制多边形层。 */
export function renderPolygons(target: Container, items: readonly PolygonItem[]): Container {
  const layer = createPolygonLayer(items);
  target.addChild(layer);
  return layer;
}
