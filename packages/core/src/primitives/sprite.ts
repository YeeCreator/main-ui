/**
 * primitives/sprite —— 精灵/点图元渲染（PixiJS v8）。
 *
 * 支持两种来源：
 * 1. 有 textureResolver 且能解析出纹理：渲染 PIXI.Sprite。
 * 2. 无纹理：按 shape 渲染占位图形（circle / rect），用 color 填充。
 */
import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { SpriteItem } from './types';

/** 纹理键 -> PIXI.Texture 的解析器。 */
export type TextureResolver = (key: string) => Texture | null | undefined;

/** 创建单个精灵/点图元。 */
export function createSprite(item: SpriteItem, resolveTexture?: TextureResolver): Container | Sprite | Graphics {
  const texture = item.texture && resolveTexture ? resolveTexture(item.texture) : null;
  if (texture) {
    const sp = new Sprite(texture);
    sp.anchor.set(0.5);
    sp.x = item.x;
    sp.y = item.y;
    if (item.width != null) sp.width = item.width;
    if (item.height != null) sp.height = item.height;
    return sp;
  }

  const w = item.width ?? 32;
  const h = item.height ?? 32;
  const color = item.color ?? 0x888888;
  const g = new Graphics();
  if (item.shape === 'rect') {
    g.rect(item.x - w / 2, item.y - h / 2, w, h).fill(color);
  } else {
    g.circle(item.x, item.y, Math.min(w, h) / 2).fill(color);
  }
  return g;
}

/** 批量创建精灵图元，返回一个 Container 层。 */
export function createSpriteLayer(items: readonly SpriteItem[], resolveTexture?: TextureResolver): Container {
  const layer = new Container();
  layer.label = 'sprite';
  for (const item of items) {
    layer.addChild(createSprite(item, resolveTexture));
  }
  return layer;
}

/** 在既有容器上就地绘制精灵层。 */
export function renderSprites(target: Container, items: readonly SpriteItem[], resolveTexture?: TextureResolver): Container {
  const layer = createSpriteLayer(items, resolveTexture);
  target.addChild(layer);
  return layer;
}
