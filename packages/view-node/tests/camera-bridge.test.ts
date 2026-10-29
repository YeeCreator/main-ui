/**
 * view-node/camera-bridge —— `NodeViewport` ↔ `Camera2D`。
 *
 * 守护目标：包内只有一种**可计算**相机表示（`Camera2D`）；
 * `NodeViewport` 作为 vue-flow 的外部契约形状保留，但必须经**显式且已测**的桥。
 * 这是 design-main-ui §二十 5 的落地检查点之一。
 */
import { describe, expect, test } from 'vitest';
import { cameraToNodeViewport, nodeViewportToCamera } from '../src/node';

describe('nodeViewportToCamera', () => {
  test('zoom→scale、x/y→pan', () => {
    expect(nodeViewportToCamera({ x: 10, y: 20, zoom: 1.5 }))
      .toEqual({ scale: 1.5, pan: { x: 10, y: 20 } });
  });

  test('负平移量原样保留', () => {
    expect(nodeViewportToCamera({ x: -35, y: -70, zoom: 0.5 }))
      .toEqual({ scale: 0.5, pan: { x: -35, y: -70 } });
  });
});

describe('cameraToNodeViewport', () => {
  test('scale→zoom、pan→x/y', () => {
    expect(cameraToNodeViewport({ scale: 2, pan: { x: 5, y: 6 } }))
      .toEqual({ x: 5, y: 6, zoom: 2 });
  });

  test('缩放被约束到 vue-flow 的 [0.1, 4] 区间', () => {
    expect(cameraToNodeViewport({ scale: 99, pan: { x: 0, y: 0 } }).zoom).toBe(4);
    expect(cameraToNodeViewport({ scale: 0.001, pan: { x: 0, y: 0 } }).zoom).toBe(0.1);
  });

  test('rotation 无对应字段，不透传（vue-flow 无旋转语义）', () => {
    const out = cameraToNodeViewport({ scale: 1, pan: { x: 0, y: 0 }, rotation: 1.2 });
    expect('rotation' in out).toBe(false);
  });
});

describe('双向互逆', () => {
  test('在合法区间内往返一致', () => {
    const original = { x: 12, y: -34, zoom: 1.75 };
    const roundTrip = cameraToNodeViewport(nodeViewportToCamera(original));
    expect(roundTrip).toEqual(original);
  });

  test('越界值往返后落在约束区间（单向收敛，不抖动）', () => {
    const clamped = cameraToNodeViewport(nodeViewportToCamera({ x: 0, y: 0, zoom: 10 }));
    expect(clamped.zoom).toBe(4);
    // 再走一轮不再变化 ⇒ 收敛
    expect(cameraToNodeViewport(nodeViewportToCamera(clamped))).toEqual(clamped);
  });
});
