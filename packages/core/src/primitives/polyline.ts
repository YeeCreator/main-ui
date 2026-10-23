/**
 * primitives/polyline —— 折线（开放描边）图元渲染（PixiJS v8）。
 *
 * 与 `polygon` 的分工：本模块用于**描绘网络/路径**（开放描边），
 * `polygon` 用于**面**（闭合填充）。二者共用列结构 `points`，
 * 差别只在语义与默认 `closed`。
 *
 * 典型消费方：SK 的 `path` 快照（一维折线网络）——实体位置列是弧长 `t`
 * 而非 `x/y`，宿主适配层需按 geometry 解析出折线点列后交给本层绘制。
 */
import { Container, Graphics } from 'pixi.js';
import type { PolylineItem } from './types';

/** 创建单个折线图元。 */
export function createPolyline(item: PolylineItem): Graphics {
  const g = new Graphics();
  const flat: number[] = [];
  for (const p of item.points) {
    flat.push(p.x, p.y);
  }
  if (flat.length < 4) return g;

  g.poly(flat);
  // 闭合折线才允许填充；开放折线一律只描边（填充会把网络连成一片，语义错误）。
  if (item.closed && item.fill != null) {
    g.fill({ color: item.fill, alpha: item.fillAlpha ?? 1 });
  }
  if (item.stroke != null) {
    g.stroke({ width: item.strokeWidth ?? 1, color: item.stroke });
  }

  if ((item.vertexRadius ?? 0) > 0) {
    const radius = item.vertexRadius ?? 0;
    const color = item.vertexColor ?? item.stroke ?? 0xffffff;
    for (const p of item.points) {
      g.circle(p.x, p.y, radius).fill({ color });
    }
  }
  return g;
}

/** 批量创建折线图元，返回一个 Container 层。 */
export function createPolylineLayer(items: readonly PolylineItem[]): Container {
  const layer = new Container();
  layer.label = 'polyline';
  for (const item of items) {
    layer.addChild(createPolyline(item));
  }
  return layer;
}

/** 在既有容器上就地绘制折线层。 */
export function renderPolylines(target: Container, items: readonly PolylineItem[]): Container {
  const layer = createPolylineLayer(items);
  target.addChild(layer);
  return layer;
}
