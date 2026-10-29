/**
 * core/rendering/content-layer —— 视口内容层（双输出面的 DOM 侧）。
 *
 * 守护目标：
 * 1. 投影与裁剪是**纯计算**，不碰 DOM（可 node 单测）；
 * 2. 裁剪**必须**生效（不裁剪 = 为所有项建 DOM 节点 = 白板常见卡死）；
 * 3. 锚点对齐正确（居中锚点要向左上回退半个自身尺寸）。
 */
import { describe, expect, test } from 'vitest';
import {
  cullContentLayer,
  prepareContentLayer,
  projectContentLayer,
  rectsIntersect,
  visibleWorldRect,
  type ContentLayerItem,
} from '../src/rendering/content-layer';
import type { Camera2D } from '../src/rendering/camera';

const identity: Camera2D = { scale: 1, pan: { x: 0, y: 0 } };
const size = { width: 800, height: 600 };

describe('visibleWorldRect', () => {
  test('相机为恒等时等于容器范围', () => {
    expect(visibleWorldRect(identity, size)).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });

  test('平移后的可见范围随之偏移', () => {
    const camera: Camera2D = { scale: 1, pan: { x: -100, y: -50 } };
    expect(visibleWorldRect(camera, size)).toEqual({ x: 100, y: 50, width: 800, height: 600 });
  });

  test('放大后可见世界范围变小（同一屏幕容纳更少世界单位）', () => {
    const camera: Camera2D = { scale: 2, pan: { x: 0, y: 0 } };
    const rect = visibleWorldRect(camera, size);
    expect(rect.width).toBe(400);
    expect(rect.height).toBe(300);
  });

  test('旋转时取四角包围盒（保守但安全）', () => {
    const camera: Camera2D = { scale: 1, pan: { x: 0, y: 0 }, rotation: Math.PI / 4 };
    const rect = visibleWorldRect(camera, size);
    // 旋转 45° 后包围盒必大于原尺寸
    expect(rect.width).toBeGreaterThan(800);
    expect(rect.height).toBeGreaterThan(600);
  });
});

describe('rectsIntersect', () => {
  test('重叠 / 接触 / 分离', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(rectsIntersect(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(rectsIntersect(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(true); // 边界接触
    expect(rectsIntersect(a, { x: 11, y: 0, width: 10, height: 10 })).toBe(false);
    expect(rectsIntersect(a, { x: 0, y: -20, width: 10, height: 10 })).toBe(false);
  });
});

describe('projectContentLayer', () => {
  test('世界坐标按相机投影为屏幕坐标', () => {
    const camera: Camera2D = { scale: 2, pan: { x: 10, y: 20 } };
    const items: ContentLayerItem[] = [{ id: 'a', kind: 'formula', anchor: { world: { x: 5, y: 5 } } }];
    const [out] = projectContentLayer(camera, items);
    expect(out.screen).toEqual({ x: 20, y: 30 }); // 5*2+10, 5*2+20
  });

  test('居中锚点的 offset 为负半个自身屏幕尺寸', () => {
    const items: ContentLayerItem[] = [{
      id: 'a', kind: 'text', anchor: { world: { x: 0, y: 0 } }, size: { width: 100, height: 40 },
    }];
    const [out] = projectContentLayer(identity, items);
    expect(out.screenSize).toEqual({ width: 100, height: 40 });
    expect(out.offset).toEqual({ x: -50, y: -20 });
  });

  test('左上锚点 offset 为零', () => {
    const items: ContentLayerItem[] = [{
      id: 'a', kind: 'text',
      anchor: { world: { x: 0, y: 0 }, anchorX: 0, anchorY: 0 },
      size: { width: 100, height: 40 },
    }];
    expect(projectContentLayer(identity, items)[0].offset).toEqual({ x: 0, y: 0 });
  });

  test('屏幕尺寸随缩放折算', () => {
    const camera: Camera2D = { scale: 0.5, pan: { x: 0, y: 0 } };
    const items: ContentLayerItem[] = [{
      id: 'a', kind: 'text', anchor: { world: { x: 0, y: 0 } }, size: { width: 100, height: 40 },
    }];
    expect(projectContentLayer(camera, items)[0].screenSize).toEqual({ width: 50, height: 20 });
  });

  test('透传 data 不丢失', () => {
    const items: ContentLayerItem[] = [{
      id: 'a', kind: 'x', anchor: { world: { x: 0, y: 0 } }, data: { latex: 'E=mc^2' },
    }];
    expect(projectContentLayer(identity, items)[0].data).toEqual({ latex: 'E=mc^2' });
  });
});

describe('cullContentLayer', () => {
  const make = (id: string, x: number, y: number): ContentLayerItem => ({
    id, kind: 'text', anchor: { world: { x, y } }, size: { width: 10, height: 10 },
  });

  test('保留可见项、剔除视野外项', () => {
    const items = [make('in', 100, 100), make('out', 5000, 5000)];
    const kept = cullContentLayer(identity, size, items);
    expect(kept.map((i) => i.id)).toEqual(['in']);
  });

  test('放大后原本可见的远处项被剔除（裁剪真的随相机变化）', () => {
    const items = [make('far', 500, 500)];
    expect(cullContentLayer(identity, size, items)).toHaveLength(1);
    const zoomed: Camera2D = { scale: 4, pan: { x: 0, y: 0 } };
    expect(cullContentLayer(zoomed, size, items)).toHaveLength(0);
  });

  test('部分重叠保留', () => {
    // 世界 795..805 与视口 0..800 相交
    expect(cullContentLayer(identity, size, [make('edge', 800, 300)])).toHaveLength(1);
  });

  test('零尺寸项仍参与可见性判定（不因缺 size 被误删）', () => {
    const items: ContentLayerItem[] = [{ id: 'p', kind: 'dot', anchor: { world: { x: 10, y: 10 } } }];
    expect(cullContentLayer(identity, size, items)).toHaveLength(1);
  });
});

describe('prepareContentLayer（裁剪 + 投影一步完成）', () => {
  test('只返回可见项的投影', () => {
    const items: ContentLayerItem[] = [
      { id: 'in', kind: 'formula', anchor: { world: { x: 100, y: 100 } }, size: { width: 20, height: 20 } },
      { id: 'out', kind: 'formula', anchor: { world: { x: 9999, y: 9999 } }, size: { width: 20, height: 20 } },
    ];
    const out = prepareContentLayer(identity, size, items);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('in');
    expect(out[0].screen).toEqual({ x: 100, y: 100 });
  });
});
