/**
 * view-flow/viewport —— `FlowViewport` ↔ `Camera2D`。
 *
 * 与 `view-node` 同口径：形状保留（vue-flow 契约），但桥必须显式且已测。
 */
import { describe, expect, test } from 'vitest';
import {
  cameraToFlowViewport,
  flowViewportToCamera,
  normalizeFlowViewport,
} from '../src/viewport';
import { DEFAULT_FLOW_VIEWPORT } from '../src/types';

describe('normalizeFlowViewport', () => {
  test('残缺输入回退默认值', () => {
    expect(normalizeFlowViewport(null)).toEqual(DEFAULT_FLOW_VIEWPORT);
    expect(normalizeFlowViewport(undefined)).toEqual(DEFAULT_FLOW_VIEWPORT);
    expect(normalizeFlowViewport({})).toEqual(DEFAULT_FLOW_VIEWPORT);
    expect(normalizeFlowViewport({ x: Number.NaN })).toEqual(DEFAULT_FLOW_VIEWPORT);
  });

  test('zoom 收敛到 [0.1, 4]', () => {
    expect(normalizeFlowViewport({ zoom: 99 }).zoom).toBe(4);
    expect(normalizeFlowViewport({ zoom: 0.001 }).zoom).toBe(0.1);
    expect(normalizeFlowViewport({ zoom: 2 }).zoom).toBe(2);
  });
});

describe('flowViewportToCamera', () => {
  test('zoom→scale、x/y→pan', () => {
    expect(flowViewportToCamera({ x: 10, y: 20, zoom: 1.5 }))
      .toEqual({ scale: 1.5, pan: { x: 10, y: 20 } });
  });
});

describe('cameraToFlowViewport', () => {
  test('scale→zoom、pan→x/y', () => {
    expect(cameraToFlowViewport({ scale: 2, pan: { x: 5, y: 6 } }))
      .toEqual({ x: 5, y: 6, zoom: 2 });
  });

  test('缩放被约束到 vue-flow 区间', () => {
    expect(cameraToFlowViewport({ scale: 99, pan: { x: 0, y: 0 } }).zoom).toBe(4);
  });

  test('rotation 无对应字段，不透传', () => {
    expect('rotation' in cameraToFlowViewport({ scale: 1, pan: { x: 0, y: 0 }, rotation: 1 })).toBe(false);
  });
});

describe('双向互逆', () => {
  test('在合法区间内往返一致', () => {
    const original = { x: 12, y: -34, zoom: 1.75 };
    expect(cameraToFlowViewport(flowViewportToCamera(original))).toEqual(original);
  });

  test('越界值往返后收敛', () => {
    const clamped = cameraToFlowViewport(flowViewportToCamera({ x: 0, y: 0, zoom: 10 }));
    expect(clamped.zoom).toBe(4);
    expect(cameraToFlowViewport(flowViewportToCamera(clamped))).toEqual(clamped);
  });
});
