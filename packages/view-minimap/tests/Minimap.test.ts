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
