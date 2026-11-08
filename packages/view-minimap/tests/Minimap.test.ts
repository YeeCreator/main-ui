import { describe, expect, test } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Minimap } from '../src/Minimap';
import type { MinimapItem } from '../src/types';

/** 把组件渲染成 HTML 字符串，用于断言产出的图元。 */
async function renderMinimap(props: Record<string, unknown>): Promise<string> {
  return renderToString(createSSRApp({ render: () => h(Minimap, props) }));
}

const ITEMS: MinimapItem[] = [
  { id: 'a', world: { x: 0, y: 0, width: 100, height: 50 }, kind: 'rect' },
  { id: 'b', world: { x: 500, y: 400, width: 0, height: 0 }, kind: 'point' },
  { id: 'c', points: [{ x: 0, y: 0 }, { x: 500, y: 400 }], world: { x: 0, y: 0, width: 500, height: 400 }, kind: 'path' },
];

describe('Minimap · 图元产出', () => {
  test('rect 型画成 <rect>，point 型画成 <circle>，path 型画成 <polyline>', async () => {
    const html = await renderMinimap({ items: ITEMS });
    expect(html).toContain('main-ui-minimap__item--rect');
    expect(html).toContain('main-ui-minimap__item--point');
    expect(html).toContain('main-ui-minimap__item--path');
    expect(html).toContain('<circle');
    expect(html).toContain('<polyline');
  });

  test('不给 kind 时按零宽高自动判为 point', async () => {
    const html = await renderMinimap({
      items: [{ id: 'auto', world: { x: 10, y: 10, width: 0, height: 0 } }],
    });
    expect(html).toContain('main-ui-minimap__item--point');
  });

  test('视口矩形渲染为独立图元', async () => {
    const html = await renderMinimap({
      items: ITEMS,
      viewport: { x: 0, y: 0, width: 200, height: 200 },
    });
    expect(html).toContain('main-ui-minimap__viewport');
  });

  test('没有内容也没有视口时不产出任何图元（不给空 svg 添乱）', async () => {
    const html = await renderMinimap({ items: [] });
    expect(html).toContain('<svg');
    expect(html).not.toContain('main-ui-minimap__item');
  });

  test('容器尺寸与 props 一致（viewBox 保证不随 CSS 拉伸变形）', async () => {
    const html = await renderMinimap({ items: ITEMS, width: 220, height: 140 });
    expect(html).toContain('viewBox="0 0 220 140"');
    expect(html).toContain('width="220"');
    expect(html).toContain('height="140"');
  });

  test('highlighted 项带高亮类', async () => {
    const html = await renderMinimap({
      items: [{ id: 'h', world: { x: 0, y: 0, width: 10, height: 10 }, highlighted: true }],
    });
    expect(html).toContain('is-highlighted');
  });
});

describe('Minimap · 由相机反算视口', () => {
  test('给 camera + viewportSize 时自动算出视口框', async () => {
    const html = await renderMinimap({
      items: ITEMS,
      camera: { scale: 2, pan: { x: 0, y: 0 } },
      viewportSize: { width: 800, height: 600 },
    });
    // 相机可见世界范围 = 400×300，应被画进缩略图
    expect(html).toContain('main-ui-minimap__viewport');
  });

  test('显式 viewport 优先于 camera（后者被忽略）', async () => {
    const explicit = await renderMinimap({
      items: ITEMS,
      viewport: { x: 0, y: 0, width: 10, height: 10 },
      camera: { scale: 2, pan: { x: 0, y: 0 } },
      viewportSize: { width: 800, height: 600 },
    });
    const cameraOnly = await renderMinimap({
      items: ITEMS,
      camera: { scale: 2, pan: { x: 0, y: 0 } },
      viewportSize: { width: 800, height: 600 },
    });
    // 两种输入的视口框尺寸不同，产出应不同（证明 viewport 优先）
    expect(explicit).not.toBe(cameraOnly);
  });
});

/**
 * 外框 vs 世界轮廓 —— 两个**不同的**概念，不能混用。
 *
 * 2026-11-08 使用者报告：「小地图边框是圆形，但世界是圆形不代表小图也该圆 ——
 * 小图理论上应与视口同形吗？」
 *
 * 判据纠正：小地图的外框表达的是**视口**（你正在看的那个窗口长什么样），
 * 世界本身的轮廓是**画在图里面的内容**。把世界轮廓当外框会导致：
 * 视口框一旦超出世界边界（缩小视野 / 平移出去）就被裁掉，使用者**看不到
 * 自己缩放到多远** —— 丢失导航最关键的一条信息。
 */
describe('Minimap · 外框跟视口，轮廓跟世界', () => {
  const WORLD = { x: 0, y: 0, width: 500, height: 500 };

  test('外框为 rect 时，即使世界是圆的也不画圆形裁切', async () => {
    const html = await renderMinimap({ items: ITEMS, world: WORLD, worldOutline: 'circle' });
    // 外框是矩形 ⇒ 没有 clipPath
    expect(html).not.toContain('clipPath');
    expect(html).not.toContain('is-circle');
  });

  test('世界轮廓为 circle 时，图内画一个轮廓椭圆', async () => {
    const html = await renderMinimap({ items: ITEMS, world: WORLD, worldOutline: 'circle' });
    expect(html).toContain('main-ui-minimap__world');
    expect(html).toContain('<ellipse');
  });

  test('世界轮廓为 rect 时画一个轮廓矩形', async () => {
    const html = await renderMinimap({ items: ITEMS, world: WORLD, worldOutline: 'rect' });
    expect(html).toContain('main-ui-minimap__world');
  });

  test('不给 worldOutline 时不画世界轮廓（世界本来就是矩形时外框已足够）', async () => {
    const html = await renderMinimap({ items: ITEMS, world: WORLD });
    expect(html).not.toContain('main-ui-minimap__world');
  });

  test('外框为 circle 时才裁切（此时外框与视口形状一致）', async () => {
    const html = await renderMinimap({ items: ITEMS, world: WORLD, shape: 'circle' });
    expect(html).toContain('clipPath');
    expect(html).toContain('is-circle');
  });

  test('视口框画在裁切组之外（超出世界时仍可见）', async () => {
    // 视口远大于世界 ⇒ 框会超出小图
    const huge = { x: -5000, y: -5000, width: 20000, height: 20000 };
    const html = await renderMinimap({
      items: ITEMS,
      world: WORLD,
      worldOutline: 'circle',
      shape: 'circle',
      camera: { scale: 1, pan: { x: 0, y: 0 } },
      viewportSize: { width: 20000, height: 20000 },
      viewport: huge,
    });
    // 视口框必须出现在裁切组<b>之后</b>：说明它不受裁切影响
    const clipEnd = html.indexOf('</g>');
    const viewportIdx = html.indexOf('main-ui-minimap__viewport');
    expect(clipEnd).toBeGreaterThan(-1);
    expect(viewportIdx).toBeGreaterThan(clipEnd);
  });

  test('视口超出小图时根节点带 is-viewport-overflow 状态类', async () => {
    const huge = { x: -5000, y: -5000, width: 20000, height: 20000 };
    const html = await renderMinimap({
      items: ITEMS,
      world: WORLD,
      viewport: huge,
    });
    expect(html).toContain('is-viewport-overflow');
  });

  test('视口在范围内时没有溢出状态类', async () => {
    const html = await renderMinimap({
      items: ITEMS,
      world: WORLD,
      viewport: { x: 100, y: 100, width: 100, height: 100 },
    });
    expect(html).not.toContain('is-viewport-overflow');
  });
});
