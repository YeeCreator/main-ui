/**
 * 飞行模式的**相机装配**（三层最深的那一层）。
 *
 * ## 守住什么
 *
 * 2026-11-08 首版飞行模式实机全空：`freeState` 状态完全正确、
 * `notifyCamera()` 也发了，但 `perspCamera` 还停在构造默认值
 * `pos=(0,0,0) fov=45 near=0.1 far=1000`。
 *
 * 根因是 `enterFly()` 里漏了一句 `applyCameraToThree()` ——
 * `exitFly()` 有、`enterFly()` 忘了。这类「状态对了但没落到渲染对象上」
 * 的缺陷**任何纯函数测试都测不出来**，因为它跨了「状态 → three 对象」这条边界。
 *
 * 本文件直接断言 three 的相机对象被写对了。
 */

import { describe, expect, test } from 'vitest';
import { ThreeViewportBackend } from '../src/threeBackend';

/**
 * 直接构造后端并手工注入 three 相机（跳过 `mount`，因为 mount 需要 DOM/GPU）。
 *
 * 用一个最小的「装配探针」：调用 `enterFly` 后读 `perspCamera`。
 */
function makeBackend() {
  const backend = new ThreeViewportBackend({});
  // 私有字段：测试需要直接看装配结果，故此处断言式访问
  const anyBackend = backend as unknown as {
    orthoCamera: unknown;
    perspCamera: {
      position: { x: number; y: number; z: number };
      fov: number;
      near: number;
      far: number;
      aspect: number;
      up: { x: number; y: number; z: number };
    };
    orbitState: {
      target: { x: number; y: number; z: number };
      azimuth: number;
      polar: number;
      distance: number;
      viewHeight: number;
    };
    size: { width: number; height: number };
    viewBox: { x: number; y: number; width: number; height: number };
    scene: unknown;
  };
  return { backend, anyBackend };
}

describe('飞行模式：enterFly 必须把状态落到 three 相机上', () => {
  test('进入飞行后，perspCamera 的位置不再停在 (0,0,0)', () => {
    const { backend, anyBackend } = makeBackend();
    anyBackend.size = { width: 800, height: 600 };
    anyBackend.viewBox = { x: 0, y: 0, width: 512, height: 512 };

    // 构造时的默认值
    expect(anyBackend.perspCamera.position.z).toBe(0);

    backend.enterFly();

    const pos = anyBackend.perspCamera.position;
    const moved = Math.abs(pos.x) + Math.abs(pos.y) + Math.abs(pos.z);
    expect(moved).toBeGreaterThan(1);
  });

  test('进入飞行后，perspCamera 的 fov 切到飞行档（70），不再是默认 45', () => {
    const { backend, anyBackend } = makeBackend();
    anyBackend.size = { width: 800, height: 600 };
    anyBackend.viewBox = { x: 0, y: 0, width: 512, height: 512 };
    backend.enterFly();
    expect(anyBackend.perspCamera.fov).toBeCloseTo(70, 6);
  });

  test('进入飞行后，aspect 按视口比例设置（不是默认 1）', () => {
    const { backend, anyBackend } = makeBackend();
    anyBackend.size = { width: 800, height: 600 };
    anyBackend.viewBox = { x: 0, y: 0, width: 512, height: 512 };
    backend.enterFly();
    expect(anyBackend.perspCamera.aspect).toBeCloseTo(800 / 600, 6);
  });

  test('进入飞行后，near/far 比值在合理范围内（不超过 10000:1）', () => {
    const { backend, anyBackend } = makeBackend();
    anyBackend.size = { width: 800, height: 600 };
    anyBackend.viewBox = { x: 0, y: 0, width: 512, height: 512 };
    backend.enterFly();
    const { near, far } = anyBackend.perspCamera;
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near);
    /**
     * 深度精度与 far/near 成反比：比值过大会让整个场景塌到同一深度层，
     * 表现为「画面全空」或「z-fighting 闪烁」。10000:1 是安全上界。
     */
    expect(far / near).toBeLessThan(10000);
  });

  test('进入飞行后，相机位置在目标点上方（y > target.y）', () => {
    const { backend, anyBackend } = makeBackend();
    anyBackend.size = { width: 800, height: 600 };
    anyBackend.viewBox = { x: 0, y: 0, width: 512, height: 512 };
    backend.enterFly();
    expect(anyBackend.perspCamera.position.y).toBeGreaterThan(anyBackend.orbitState.target.y);
  });

  test('退出飞行后 perspCamera 不再被使用（isFlying 为 false）', () => {
    const { backend, anyBackend } = makeBackend();
    anyBackend.size = { width: 800, height: 600 };
    anyBackend.viewBox = { x: 0, y: 0, width: 512, height: 512 };
    backend.enterFly();
    expect(backend.isFlying()).toBe(true);
    backend.exitFly();
    expect(backend.isFlying()).toBe(false);
    expect(backend.getFreeCamera()).toBeNull();
  });

  test('重复 enterFly 是幂等的（不会重置已经在飞的位置）', () => {
    const { backend, anyBackend } = makeBackend();
    anyBackend.size = { width: 800, height: 600 };
    anyBackend.viewBox = { x: 0, y: 0, width: 512, height: 512 };
    backend.enterFly();
    const first = backend.getFreeCamera();
    backend.enterFly();
    const second = backend.getFreeCamera();
    expect(second?.position).toEqual(first?.position);
  });
});
