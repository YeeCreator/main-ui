/**
 * @main-ui/core/primitives —— 图元系统（Grid / Sprite / Text / Polygon / HitTest）。
 *
 * 独立子路径导出（依赖 PixiJS）：view-world 与 view-sandbox 共享此图元系统。
 * types/snapshot/hitTest 为纯数据与纯函数；grid/sprite/text/polygon 为 PixiJS 渲染器。
 */
export * from './types';
export * from './hitTest';
export * from './snapshot';
export { createGrid, renderGrid } from './grid';
export { createText, createTextLayer, renderTexts } from './text';
export {
  createSprite,
  createSpriteLayer,
  renderSprites,
  type TextureResolver,
} from './sprite';
export { createPolygon, createPolygonLayer, renderPolygons } from './polygon';
