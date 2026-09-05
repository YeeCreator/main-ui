/**
 * primitives/text —— 文字/标注图元渲染（PixiJS v8）。
 *
 * 每个文字项以世界坐标定位，字号为世界单位（随相机缩放）。
 */
import { Container, Text } from 'pixi.js';
import type { TextItem } from './types';

/** 创建单个文字图元。 */
export function createText(item: TextItem): Text {
  const t = new Text({
    text: item.text,
    style: {
      fontSize: item.fontSize ?? 32,
      fill: item.color ?? 0x000000,
      fontFamily: item.fontFamily ?? 'sans-serif',
    },
  });
  t.x = item.x;
  t.y = item.y;
  t.anchor.set(item.anchorX ?? 0.5, item.anchorY ?? 0.5);
  return t;
}

/** 批量创建文字图元，返回一个 Container 层。 */
export function createTextLayer(items: readonly TextItem[]): Container {
  const layer = new Container();
  layer.label = 'text';
  for (const item of items) {
    layer.addChild(createText(item));
  }
  return layer;
}

/** 在既有容器上就地绘制文字层。 */
export function renderTexts(target: Container, items: readonly TextItem[]): Container {
  const layer = createTextLayer(items);
  target.addChild(layer);
  return layer;
}
