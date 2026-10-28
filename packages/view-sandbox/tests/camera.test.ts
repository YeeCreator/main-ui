/**
 * view-sandbox/camera —— 相机归一化与旧格式迁移。
 *
 * 守护目标：沙盘相机必须是 `Camera2D`（全库内部唯一可计算表示）。
 * 旧版 `{ x, y, zoom }` 的存量快照读取时必须迁移 —— 否则 `camera.scale`
 * 为 `undefined`，世界层变换串变成非法值，浏览器静默丢弃整条声明。
 */
import { describe, expect, test } from 'vitest';
import { normalizeSandboxCamera } from '../src/camera';

describe('normalizeSandboxCamera', () => {
  test('现行 Camera2D 原样返回', () => {
    expect(normalizeSandboxCamera({ scale: 2, pan: { x: 5, y: 6 } }))
      .toEqual({ scale: 2, pan: { x: 5, y: 6 } });
  });

  test('旧版 { x, y, zoom } 迁移为 Camera2D', () => {
    expect(normalizeSandboxCamera({ x: 30, y: 40, zoom: 2 }))
      .toEqual({ scale: 2, pan: { x: 30, y: 40 } });
  });

  test('rotation 非零时保留，为零时省略（与 serializeCamera 口径一致）', () => {
    expect(normalizeSandboxCamera({ scale: 1, pan: { x: 0, y: 0 }, rotation: 0.5 }).rotation).toBeCloseTo(0.5, 6);
    expect('rotation' in normalizeSandboxCamera({ scale: 1, pan: { x: 0, y: 0 }, rotation: 0 })).toBe(false);
  });

  test('无效输入回退默认值（不得产出非法相机）', () => {
    const fallback = { scale: 1, pan: { x: 0, y: 0 } };
    expect(normalizeSandboxCamera(null)).toEqual(fallback);
    expect(normalizeSandboxCamera(undefined)).toEqual(fallback);
    expect(normalizeSandboxCamera({})).toEqual(fallback);
    expect(normalizeSandboxCamera({ scale: Number.NaN, pan: { x: 0, y: 0 } })).toEqual(fallback);
    expect(normalizeSandboxCamera({ x: 1, y: 2 })).toEqual(fallback); // 缺 zoom
  });
});
