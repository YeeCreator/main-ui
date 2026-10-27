import { describe, expect, test, vi } from 'vitest';
import { createBackendRegistry } from '@main-ui/core/rendering';
import type { BackendCapabilities, ViewportBackend, ViewportBackendFactory } from '@main-ui/core/rendering';
import { useWorldDimension } from '../src/useWorldDimension';

/**
 * WP4 用例：维度开关控制器。
 *
 * 关键判据（设计 §十九 9）：**维度能力运行时探测已装后端** ——
 * 只装二维后端的宿主 `canToggle === false`（开关不渲染、无报错）。
 */

function makeFakeBackend(namespace: string): ViewportBackend {
  const capabilities: BackendCapabilities = { dimensions: namespace.includes('3d') ? [2, 3] : [2], name: namespace };
  return {
    name: namespace,
    capabilities,
    mount: async () => undefined,
    unmount: () => undefined,
    applySnapshot: () => undefined,
    getCamera: () => ({ scale: 1, pan: { x: 0, y: 0 } }),
    setCamera: () => undefined,
    onCameraChange: () => () => undefined,
    screenToWorld: (pt) => pt,
    worldToScreen: (pt) => pt,
    pickCell: () => null,
    resize: () => undefined,
    requestRender: () => undefined,
    getHandle: () => ({ getSize: () => ({ width: 0, height: 0 }), getRootObject: () => null, requestRender: () => undefined }),
    fitToBounds: () => undefined,
    setViewBox: () => undefined,
    getViewBox: () => ({ x: 0, y: 0, width: 1, height: 1 }),
  };
}

const twoOnly: Record<string, ViewportBackendFactory> = {
  'pixi-2d': () => makeFakeBackend('pixi-2d'),
};

const bothBackends: Record<string, ViewportBackendFactory> = {
  'pixi-2d': () => makeFakeBackend('pixi-2d'),
  'three-3d': () => makeFakeBackend('three-3d'),
};

describe('view-world/useWorldDimension 维度探测', () => {
  test('只装二维后端：canToggle=false，toggle 是空操作', () => {
    const dim = useWorldDimension({ backends: twoOnly });
    expect(dim.canToggle.value).toBe(false);
    expect(dim.dimension.value).toBe(2);
    dim.toggle();
    expect(dim.dimension.value).toBe(2);
  });

  test('只装二维后端：setDimension(3) 被拒', () => {
    const dim = useWorldDimension({ backends: twoOnly });
    dim.setDimension(3);
    expect(dim.dimension.value).toBe(2);
  });

  test('装了三维后端：canToggle=true，toggle 往返', () => {
    const dim = useWorldDimension({ backends: bothBackends });
    expect(dim.canToggle.value).toBe(true);
    expect(dim.dimension.value).toBe(2);
    expect(dim.label.value).toBe('3D 视图');
    dim.toggle();
    expect(dim.dimension.value).toBe(3);
    expect(dim.label.value).toBe('2D 视图');
    dim.toggle();
    expect(dim.dimension.value).toBe(2);
  });

  test('无 backends 时为二维档（不崩）', () => {
    const dim = useWorldDimension({});
    expect(dim.canToggle.value).toBe(false);
    expect(dim.dimension.value).toBe(2);
  });

  test('自定义三维后端键', () => {
    const backends: Record<string, ViewportBackendFactory> = { 'scene-3d': () => makeFakeBackend('scene-3d') };
    const dim = useWorldDimension({ backends, threeBackendKey: 'scene-3d' });
    expect(dim.canToggle.value).toBe(true);
  });

  test('只装二维时忽略存储里的非法三维残留', () => {
    const set = vi.fn();
    const dim = useWorldDimension({
      backends: twoOnly,
      store: { get: () => 3, set },
    });
    expect(dim.dimension.value).toBe(2);
    dim.toggle();
    // 只装二维时不写无意义键
    expect(set).not.toHaveBeenCalled();
  });

  test('装了三维后端时读存储并回写', () => {
    const store = { value: 3 as unknown, set: vi.fn() };
    const dim = useWorldDimension({
      backends: bothBackends,
      store: { get: () => store.value, set: (key, value) => store.set(key, value) },
    });
    expect(dim.dimension.value).toBe(3);
    dim.toggle();
    expect(store.set).toHaveBeenCalledWith('view-world:dimension', 2);
  });

  test('自定义存储键', () => {
    const set = vi.fn();
    const dim = useWorldDimension({
      backends: bothBackends,
      storageKey: 'cg-world-dimension',
      store: { get: () => undefined, set },
    });
    dim.toggle();
    expect(set).toHaveBeenCalledWith('cg-world-dimension', 3);
  });
});

describe('core/rendering 注册表与 view-world 后端键一致性', () => {
  test('注册表按维度探测，与 useWorldDimension 判据同源', () => {
    const registry = createBackendRegistry();
    registry.register({ key: 'pixi-2d', label: '2D', factory: () => makeFakeBackend('pixi-2d'), capabilities: { dimensions: [2] } });
    expect(registry.supportsDimension(3)).toBe(false);

    registry.register({ key: 'three-3d', label: '3D', factory: () => makeFakeBackend('three-3d'), capabilities: { dimensions: [2, 3] } });
    expect(registry.supportsDimension(3)).toBe(true);
    expect(registry.supportedDimensions()).toEqual([2, 3]);
  });
});
