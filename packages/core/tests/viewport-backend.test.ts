import { describe, expect, test } from 'vitest';
import type {
  BackendCapabilities,
  ViewportApplySnapshotOptions,
  ViewportBackend,
  ViewportBackendMountOptions,
  ViewportHandle,
} from '../src/rendering/backend';
import {
  createBackendRegistry,
  defaultBackendRegistry,
} from '../src/rendering/backend-registry';
import type { Camera2D, Vec2, ViewBox } from '../src/rendering/camera';
import {
  camera2DToOrbit,
  cameraUpForPolar,
  clampPolar,
  DEFAULT_TOP_POLAR,
  groundToPlane,
  orbitPan,
  orbitRotate,
  orbitToCamera2D,
  orbitZoom,
  planeToGround,
} from '../src/rendering/camera-bridge';

/**
 * WP2 用例：`ViewportBackend` 契约本身。
 *
 * 用假后端（pure-value 实现，不碰 DOM / WebGL）验证两件事：
 * 1. 接口成员齐全且调用序列符合契约；
 * 2. 相机与快照进出都是**可序列化纯值**（不夹带 Proxy / 类实例）。
 */

/** 契约最小实现：用于验证接口形状与纯值约束，不渲染任何东西。 */
class FakeBackend implements ViewportBackend {
  readonly name = 'fake';
  readonly capabilities: BackendCapabilities = { dimensions: [2, 3], name: 'fake' };

  calls: string[] = [];
  private camera: Camera2D = { scale: 1, pan: { x: 0, y: 0 } };
  private viewBox: ViewBox = { x: 0, y: 0, width: 100, height: 100 };
  private listeners: Array<(camera: Camera2D) => void> = [];
  private grid: { x: number; y: number; cols: number; rows: number; cellWidth: number; cellHeight: number } | null = null;
  private size = { width: 0, height: 0 };

  async mount(container: HTMLElement, options: ViewportBackendMountOptions): Promise<void> {
    this.calls.push(`mount:${options.viewBox.width}`);
    this.viewBox = { ...options.viewBox };
    this.size = { width: container.clientWidth || 1, height: container.clientHeight || 1 };
  }

  unmount(): void {
    this.calls.push('unmount');
  }

  applySnapshot(options: ViewportApplySnapshotOptions): void {
    this.calls.push(`apply:${Object.keys(options.snapshot?.batches ?? {}).length}`);
    const grid = options.grid ?? null;
    this.grid = grid
      ? { x: grid.x, y: grid.y, cols: grid.cols, rows: grid.rows, cellWidth: grid.cellWidth, cellHeight: grid.cellHeight }
      : null;
  }

  getCamera(): Camera2D {
    // 必须返回纯值：每次新建对象，不返回内部引用。
    return { scale: this.camera.scale, pan: { ...this.camera.pan }, ...(this.camera.rotation ? { rotation: this.camera.rotation } : {}) };
  }

  setCamera(camera: Camera2D): void {
    this.calls.push('setCamera');
    this.camera = { scale: camera.scale, pan: { ...camera.pan } };
    if (typeof camera.rotation === 'number' && camera.rotation !== 0) this.camera.rotation = camera.rotation;
    for (const listener of this.listeners) listener(this.getCamera());
  }

  onCameraChange(listener: (camera: Camera2D) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== listener);
    };
  }

  screenToWorld(point: Vec2): Vec2 {
    return { x: point.x / this.camera.scale - this.camera.pan.x, y: point.y / this.camera.scale - this.camera.pan.y };
  }

  worldToScreen(point: Vec2): Vec2 {
    return { x: (point.x + this.camera.pan.x) * this.camera.scale, y: (point.y + this.camera.pan.y) * this.camera.scale };
  }

  pickCell(screen: Vec2): { col: number; row: number } | null {
    if (!this.grid) return null;
    const world = this.screenToWorld(screen);
    const col = Math.floor((world.x - this.grid.x) / this.grid.cellWidth);
    const row = Math.floor((world.y - this.grid.y) / this.grid.cellHeight);
    if (col < 0 || row < 0 || col >= this.grid.cols || row >= this.grid.rows) return null;
    return { col, row };
  }

  resize(width: number, height: number): void {
    this.calls.push(`resize:${width}x${height}`);
    this.size = { width, height };
  }

  requestRender(): void {
    this.calls.push('requestRender');
  }

  getHandle(): ViewportHandle {
    return {
      getSize: () => ({ ...this.size }),
      getRootObject: () => null,
      requestRender: () => this.requestRender(),
    };
  }

  fitToBounds(viewBox?: ViewBox): void {
    this.calls.push('fit');
    if (viewBox) this.viewBox = { ...viewBox };
  }

  setViewBox(viewBox: ViewBox): void {
    this.calls.push('setViewBox');
    this.viewBox = { ...viewBox };
  }

  getViewBox(): ViewBox {
    return { ...this.viewBox };
  }
}

const fakeContainer = (width = 320, height = 240): HTMLElement =>
  ({ clientWidth: width, clientHeight: height }) as unknown as HTMLElement;

describe('core/rendering ViewportBackend 契约', () => {
  test('生命周期调用序列：mount → applySnapshot → resize → unmount', async () => {
    const backend = new FakeBackend();
    await backend.mount(fakeContainer(), { viewBox: { x: 0, y: 0, width: 200, height: 100 } });
    backend.applySnapshot({
      snapshot: { bounds: { x: 0, y: 0, width: 10, height: 10 }, batches: { a: { kind: 'a', count: 0, columns: {}, geometry: 'point' } } },
      grid: { x: 0, y: 0, cols: 8, rows: 8, cellWidth: 10, cellHeight: 10 },
    });
    backend.resize(640, 480);
    backend.requestRender();
    backend.unmount();

    expect(backend.calls).toEqual(['mount:200', 'apply:1', 'resize:640x480', 'requestRender', 'unmount']);
  });

  test('capabilities 在 mount 之前即可读（运行时探测的前提）', () => {
    const backend = new FakeBackend();
    expect(backend.capabilities.dimensions).toEqual([2, 3]);
    expect(backend.capabilities.name).toBe('fake');
  });

  test('getCamera 返回纯值：不与内部状态共享引用', () => {
    const backend = new FakeBackend();
    backend.setCamera({ scale: 2, pan: { x: 5, y: 7 } });
    const first = backend.getCamera();
    first.pan.x = 999;
    expect(backend.getCamera().pan.x).toBe(5);
    // 可结构化克隆（纯值判据）
    expect(() => structuredClone(backend.getCamera())).not.toThrow();
  });

  test('setCamera 触发 onCameraChange，退订后不再触发', () => {
    const backend = new FakeBackend();
    const seen: Camera2D[] = [];
    const off = backend.onCameraChange((camera) => seen.push(camera));
    backend.setCamera({ scale: 3, pan: { x: 1, y: 2 } });
    off();
    backend.setCamera({ scale: 4, pan: { x: 0, y: 0 } });
    expect(seen).toHaveLength(1);
    expect(seen[0].scale).toBe(3);
  });

  test('pickCell 保留网格语义：边界与越界', () => {
    const backend = new FakeBackend();
    backend.setCamera({ scale: 1, pan: { x: 0, y: 0 } });
    backend.applySnapshot({ grid: { x: 0, y: 0, cols: 4, rows: 4, cellWidth: 10, cellHeight: 10 } });
    expect(backend.pickCell({ x: 5, y: 5 })).toEqual({ col: 0, row: 0 });
    expect(backend.pickCell({ x: 25, y: 35 })).toEqual({ col: 2, row: 3 });
    expect(backend.pickCell({ x: -1, y: 5 })).toBeNull();
    expect(backend.pickCell({ x: 999, y: 5 })).toBeNull();
  });

  test('无网格配置时 pickCell 返回 null（不以几何替代）', () => {
    const backend = new FakeBackend();
    backend.applySnapshot({ snapshot: null, grid: null });
    expect(backend.pickCell({ x: 5, y: 5 })).toBeNull();
  });

  test('getHandle 提供最小句柄三件套', () => {
    const backend = new FakeBackend();
    const handle = backend.getHandle();
    expect(typeof handle.getSize).toBe('function');
    expect(typeof handle.getRootObject).toBe('function');
    expect(typeof handle.requestRender).toBe('function');
    handle.requestRender();
    expect(backend.calls).toContain('requestRender');
  });

  test('viewBox 往返为纯值副本', () => {
    const backend = new FakeBackend();
    backend.setViewBox({ x: 1, y: 2, width: 3, height: 4 });
    const box = backend.getViewBox();
    box.width = 999;
    expect(backend.getViewBox().width).toBe(3);
  });
});

describe('core/rendering 后端注册表（维度能力运行时探测）', () => {
  test('只装二维后端时 supportsDimension(3) 为 false', () => {
    const registry = createBackendRegistry();
    registry.register({
      key: 'pixi-2d',
      label: '2D',
      factory: () => new FakeBackend(),
      capabilities: { dimensions: [2] },
    });
    expect(registry.supportsDimension(2)).toBe(true);
    expect(registry.supportsDimension(3)).toBe(false);
    expect(registry.supportedDimensions()).toEqual([2]);
  });

  test('同时装二维与三维后端时维度并集为 [2,3]', () => {
    const registry = createBackendRegistry();
    registry.register({ key: 'pixi-2d', label: '2D', factory: () => new FakeBackend(), capabilities: { dimensions: [2] } });
    registry.register({ key: 'three-3d', label: '3D', factory: () => new FakeBackend(), capabilities: { dimensions: [2, 3] } });
    expect(registry.supportedDimensions()).toEqual([2, 3]);
    expect(registry.list()).toHaveLength(2);
  });

  test('同键覆盖、unregister 与 clear', () => {
    const registry = createBackendRegistry();
    registry.register({ key: 'a', label: 'A', factory: () => new FakeBackend(), capabilities: { dimensions: [2] } });
    registry.register({ key: 'a', label: 'A2', factory: () => new FakeBackend(), capabilities: { dimensions: [3] } });
    expect(registry.get('a')?.label).toBe('A2');
    registry.unregister('a');
    expect(registry.get('a')).toBeUndefined();
    expect(registry.supportedDimensions()).toEqual([]);
    registry.register({ key: 'b', label: 'B', factory: () => new FakeBackend(), capabilities: { dimensions: [2] } });
    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });

  test('默认注册表是独立单例（可清空）', () => {
    defaultBackendRegistry.clear();
    expect(defaultBackendRegistry.list()).toHaveLength(0);
  });
});

describe('core/rendering 二维 ↔ 三维相机换算（坐标约定翻转单点）', () => {
  const viewportPx = { width: 800, height: 600 };

  test('planeToGround / groundToPlane 翻转单点：世界 y → three z', () => {
    expect(planeToGround({ x: 3, y: 7 })).toEqual({ x: 3, y: 0, z: 7 });
    expect(groundToPlane({ x: 3, z: 7 })).toEqual({ x: 3, y: 7 });
  });

  test('二维相机 ↔ 轨道相机往返一致', () => {
    const camera: Camera2D = { scale: 2, pan: { x: 40, y: 30 } };
    const orbit = camera2DToOrbit(camera, viewportPx);
    const back = orbitToCamera2D(orbit, viewportPx);
    expect(back.scale).toBeCloseTo(camera.scale, 6);
    expect(back.pan.x).toBeCloseTo(camera.pan.x, 6);
    expect(back.pan.y).toBeCloseTo(camera.pan.y, 6);
  });

  test('带旋转的二维相机同样精确往返', () => {
    const camera: Camera2D = { scale: 1.5, pan: { x: -12, y: 8 }, rotation: 0.7 };
    const orbit = camera2DToOrbit(camera, viewportPx);
    const back = orbitToCamera2D(orbit, viewportPx);
    expect(back.scale).toBeCloseTo(camera.scale, 6);
    expect(back.pan.x).toBeCloseTo(camera.pan.x, 6);
    expect(back.pan.y).toBeCloseTo(camera.pan.y, 6);
    expect(back.rotation).toBeCloseTo(0.7, 6);
  });

  test('正交档 viewHeight 与二维 scale 互为倒数', () => {
    const orbit = camera2DToOrbit({ scale: 2, pan: { x: 0, y: 0 } }, viewportPx);
    expect(orbit.viewHeight).toBeCloseTo(viewportPx.height / 2, 6);
    expect(orbitToCamera2D(orbit, viewportPx).scale).toBeCloseTo(2, 6);
  });

  test('轨道相机增量算子：pan / zoom / rotate', () => {
    const orbit = camera2DToOrbit({ scale: 1, pan: { x: 0, y: 0 } }, viewportPx);

    const panned = orbitPan(orbit, { x: 5, y: -3 });
    expect(panned.target.x).toBeCloseTo(orbit.target.x + 5, 6);
    expect(panned.target.z).toBeCloseTo(orbit.target.z - 3, 6);

    const zoomed = orbitZoom(orbit, 2);
    expect(zoomed.viewHeight).toBeCloseTo(orbit.viewHeight / 2, 6);
    expect(zoomed.distance).toBeCloseTo(orbit.distance / 2, 6);

    const rotated = orbitRotate(orbit, 0.5);
    expect(rotated.azimuth).toBeCloseTo(orbit.azimuth + 0.5, 6);
  });

  test('clampPolar 夹住极点奇异区间', () => {
    // 下限 0.02：极角 0 = 正俯视，但恰好为 0 时 up 与视线平行会退化，故不允许取到 0。
    expect(clampPolar(-1)).toBe(0.02);
    expect(clampPolar(Math.PI)).toBeCloseTo(Math.PI / 2, 6);
    expect(clampPolar(1)).toBe(1);
  });

  test('cameraUpForPolar：俯视档用 -Z 作 up，避免与视线平行', () => {
    // 正俯视（极角≈0）时 up=(0,1,0) 与视线平行 → lookAt 产生 NaN。
    expect(cameraUpForPolar(0)).toEqual({ x: 0, y: 0, z: -1 });
    expect(cameraUpForPolar(DEFAULT_TOP_POLAR)).toEqual({ x: 0, y: 0, z: -1 });
    // 斜视/水平档恢复常规 up
    expect(cameraUpForPolar(Math.PI / 3)).toEqual({ x: 0, y: 1, z: 0 });
  });

  test('DEFAULT_TOP_POLAR 是接近正俯视的小角度（不是接近水平）', () => {
    // 历史缺陷：曾取 π/2 - 0.02（接近水平），导致二维档画面被压成一条线。
    expect(DEFAULT_TOP_POLAR).toBeLessThan(0.3);
    expect(DEFAULT_TOP_POLAR).toBeGreaterThan(0);
  });

  test('轨道相机可结构化克隆（纯值判据）', () => {
    const orbit = camera2DToOrbit({ scale: 1, pan: { x: 0, y: 0 } }, viewportPx);
    expect(() => structuredClone(orbit)).not.toThrow();
  });
});
