/**
 * primitives/text —— 文字/标注图元渲染（PixiJS v8）。
 *
 * 每个文字项以世界坐标定位，字号为世界单位（随相机缩放）。
 *
 * ## 为什么需要 `resolution`
 *
 * GPU 视口缩放是对**已光栅化**内容整体放大。文字先被画成位图再放大，
 * 所以相机放大即糊 —— 这不是参数问题，是光栅化的固有性质。
 *
 * `resolution` 决定文字位图相对字号的**超采样倍数**。给它足够大的值，
 * 文字在被放大后仍然清晰。具体档位由 `rendering/text-resolution` 的
 * 带滞回阶梯决定（跨档才重建，避免边界抖动）。
 */
import { Container, Text } from 'pixi.js';
import type { TextItem } from './types';

/**
 * 文字层选项。
 */
export type TextLayerOptions = {
  /**
   * 纹理超采样倍数（`Text.resolution`）。
   *
   * 缺省不传 —— 让 Pixi 用自身默认，保持既有行为。
   * 需要按相机缩放调档时由 `PixiViewportBackend` 传入。
   */
  resolution?: number;
};

/**
 * 创建单个文字图元。
 *
 * @param item 文字项（世界坐标 + 样式）。
 * @param options 图层选项（含纹理超采样倍数）。
 * @returns Pixi `Text` 实例。
 * @example
 * createText({ x: 10, y: 20, text: '标签' }, { resolution: 4 })
 */
export function createText(item: TextItem, options: TextLayerOptions = {}): Text {
  const resolution = options.resolution;
  const t = new Text({
    text: item.text,
    // 只在显式给值时才传 resolution：缺省让 Pixi 用自身默认，
    // 避免把「本库的档位策略」强加给直接调用本函数的下游。
    ...(typeof resolution === 'number' && resolution > 0 ? { resolution } : {}),
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

/**
 * 批量创建文字图元，返回一个 Container 层。
 *
 * @param items 文字项列表。
 * @param options 图层选项。
 * @returns 文字层容器（`label === 'text'`）。
 */
export function createTextLayer(items: readonly TextItem[], options: TextLayerOptions = {}): Container {
  const layer = new Container();
  layer.label = 'text';
  for (const item of items) {
    layer.addChild(createText(item, options));
  }
  return layer;
}

/**
 * 在既有容器上就地绘制文字层。
 *
 * @param target 目标容器。
 * @param items 文字项列表。
 * @param options 图层选项。
 * @returns 新建的文字层（已挂到 `target`）。
 */
export function renderTexts(target: Container, items: readonly TextItem[], options: TextLayerOptions = {}): Container {
  const layer = createTextLayer(items, options);
  target.addChild(layer);
  return layer;
}
