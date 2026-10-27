/**
 * render-3d/threeBackend —— 三维渲染后端（three.js）对 `ViewportBackend` 的实现。
 *
 * 设计要点（§十九 3–8）：
 * - `mount` 装配 `WebGPURenderer`（异步 `init` 隔离在 `renderer-factory`）+ 正交/透视相机；
 * - `applySnapshot` 依据 `primitive-plan` 的**绘制计划**构建场景：实例化分组走
 *   `InstancedMesh`，多边形/折线走真几何，文字走 MSDF；
 * - **二维档预设六条**写死在本包：正交投影 / 无光照 / 线条禁贴图 / DPR 对齐 /
 *   网格命中 `col`·`row` 优先 / 悬停反馈由上层（`hover` 高亮对象专门保留）；
 * - 不得 materialize 逐实体 `Object3D`：同类实体共享原型几何 + 实例矩阵。
 */

import {
  AmbientLight,
  Color,
  Group,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import type { EntitySnapshot, GridSpec } from '@main-ui/core/primitives';
import type { Camera2D, OrbitCamera, Vec2, ViewBox } from '@main-ui/core/rendering';
import {
  camera2DToOrbit,
  cameraUpForPolar,
  clampPolar,
  orbitPan,
  orbitRotate,
  orbitToCamera2D,
  orbitZoom,
} from '@main-ui/core/rendering';
import type {
  BackendCapabilities,
  BackendCellHit,
  ViewportApplySnapshotOptions,
  ViewportBackend,
  ViewportBackendMountOptions,
  ViewportHandle,
} from '@main-ui/core/rendering';
import { hitTestGrid } from '@main-ui/core/primitives';
import {
  planCamera,
  screenToWorldOrtho,
  worldToScreenOrtho,
  type CameraPlan,
  type OrthoCameraPlan,
} from './camera-plan';
import { buildScenePlan, type ScenePlan } from './primitive-plan';
import { createRenderer } from './renderer-factory';
import { disposePrototypeGeometries } from './geometry-factory';
import { planToSceneObjects, type BuiltScene } from './scene-builder';
import { DEFAULT_BACKGROUND, ORTHO_PRESET, colorToCss } from './units';

export interface ThreeBackendOptions {
  /** 强制走 WebGL2 后端（缺省 false：有 WebGPU 则用 WebGPU）。 */
  forceWebGL?: boolean;
  /** 是否开启抗锯齿（缺省 false）。 */
  antialias?: boolean;
  /** 三维档缺省投影（缺省 `orthographic`：二维档预设必须正交）。 */
  projection?: 'orthographic' | 'perspective';
}

/**
 * 三维视口后端。
 *
 * `capabilities.dimensions = [2, 3]`：二维档是**本后端内的一个预设**（设计 §十九 8），
 * 因此三维后端天然支持二维档 —— 这是"拨开关切档"成立的前提。
 */
export class ThreeViewportBackend implements ViewportBackend {
  readonly name = 'three-3d';
  readonly capabilities: BackendCapabilities = {
    dimensions: [2, 3],
    wideLines: true,
    extrude: true,
    msdfText: true,
    instancing: true,
    name: 'three-3d',
  };

  private renderer: WebGPURenderer | null = null;
  private scene: Scene | null = null;
  /** 世界组：承载所有内容（相机变换由 three 相机的视图矩阵承担，不用组变换）。 */
  private world: Group | null = null;
  private built: BuiltScene | null = null;
  private orthoCamera: OrthographicCamera;
  private perspCamera: PerspectiveCamera;
  private orbit: OrbitCamera;
  private currentPlan: CameraPlan | null = null;
  private projection: 'orthographic' | 'perspective';
  private size = { width: 1, height: 1 };
  private viewBox: ViewBox = { x: 0, y: 0, width: 800, height: 600 };
  /** 取景留白（像素），与二维后端 `paddingPx` 同语义。 */
  private paddingPx = 0;
  private grid: GridSpec | null = null;
  private snapshot: EntitySnapshot | null = null;
  private listeners: Array<(camera: Camera2D) => void> = [];
  private mounted = false;
  private frameHandle: number | null = null;
  private options: ThreeBackendOptions;

  constructor(options: ThreeBackendOptions = {}) {
    this.options = options;
    this.projection = options.projection ?? 'orthographic';
    this.orthoCamera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    this.perspCamera = new PerspectiveCamera(45, 1, 0.1, 1000);
    this.orbit = camera2DToOrbit({ scale: 1, pan: { x: 400, y: 300 } }, this.size);
  }

  async mount(container: HTMLElement, options: ViewportBackendMountOptions): Promise<void> {
    if (this.mounted) return;
    this.viewBox = { ...options.viewBox };
    this.paddingPx = options.paddingPx ?? 0;
    this.size = {
      width: Math.max(1, Math.round(container.clientWidth || 1)),
      height: Math.max(1, Math.round(container.clientHeight || 1)),
    };

    const renderer = await createRenderer({
      forceWebGL: this.options.forceWebGL,
      antialias: this.options.antialias,
      devicePixelRatio: options.devicePixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
    });
    this.renderer = renderer;

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const scene = new Scene();
    scene.background = new Color(colorToCss(options.background, DEFAULT_BACKGROUND));
    // 二维档保真预设第 2 条：无光照 —— 场景内不建灯。
    // （AmbientLight 保留在 scene-builder 的 lighting 分支，本后端缺省不启用）
    this.scene = scene;

    const world = new Group();
    world.name = 'world';
    scene.add(world);
    this.world = world;

    // setSize(..., false) 只改绘图缓冲，不一定同步 viewport；而屏幕空间粗线
    // （webgpu 版 LineSegments2）在 onBeforeRender 里用 renderer.getViewport() 换算线宽，
    // viewport 为 0 时线宽也变 0 → 线完全不可见（2026-10-27 实测）。故显式设置。
    renderer.setSize(this.size.width, this.size.height, false);
    renderer.setViewport(0, 0, this.size.width, this.size.height);
    // 必须先按传入的 viewBox 适配一次：否则相机会停在构造默认值，
    // 表现为「画面空 + pickCell 全 null」（2026-10-27 保真对照实测踩到）。
    // 二维后端（PixiViewport.init）在装配时就 fit，两边语义必须一致。
    this.fitToBounds();
    this.rebuildScene();
    this.renderOnce();
    this.startLoop();
    this.mounted = true;
  }

  unmount(): void {
    this.mounted = false;
    if (this.frameHandle !== null) {
      const raf = typeof cancelAnimationFrame !== 'undefined' ? cancelAnimationFrame : null;
      if (raf) raf(this.frameHandle);
      this.frameHandle = null;
    }
    this.built?.dispose();
    this.built = null;
    this.world?.clear();
    this.world = null;
    this.scene = null;
    // 几何缓存按整数键共享：销毁后端时一并释放，避免跨后端泄漏。
    disposePrototypeGeometries();
    this.renderer?.dispose();
    const canvas = this.renderer?.domElement;
    canvas?.parentElement?.removeChild(canvas);
    this.renderer = null;
    this.listeners = [];
  }

  applySnapshot(options: ViewportApplySnapshotOptions): void {
    this.grid = options.grid ?? null;
    this.snapshot = options.snapshot ?? null;
    this.rebuildScene();
  }

  getCamera(): Camera2D {
    // 二维档统一表示：平面 scale + pan（首个后端实现的语义在三维侧同样成立）。
    return orbitToCamera2D(this.orbit, this.size);
  }

  setCamera(camera: Camera2D): void {
    this.orbit = camera2DToOrbit(camera, this.size);
    this.applyCameraToThree();
    this.notifyCamera();
  }

  onCameraChange(listener: (camera: Camera2D) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== listener);
    };
  }

  screenToWorld(point: Vec2): Vec2 {
    if (!this.currentPlan || this.currentPlan.kind !== 'orthographic') {
      // 透视档：以平面映射近似（二维档语义只在正交档下精确；透视档由三维交互自行处理）
      return { x: point.x, y: point.y };
    }
    return screenToWorldOrtho({
      screen: point,
      plan: this.currentPlan as OrthoCameraPlan,
      viewportPx: this.size,
      screenRotation: -this.orbit.azimuth,
    });
  }

  worldToScreen(point: Vec2): Vec2 {
    if (!this.currentPlan || this.currentPlan.kind !== 'orthographic') return { x: point.x, y: point.y };
    return worldToScreenOrtho({
      world: point,
      plan: this.currentPlan as OrthoCameraPlan,
      viewportPx: this.size,
      screenRotation: -this.orbit.azimuth,
    });
  }

  /** 网格命中保留 `col`/`row` 语义（设计 §十九 8 第 5 条：不用射线打几何）。 */
  pickCell(screen: Vec2): BackendCellHit | null {
    if (!this.grid) return null;
    const world = this.screenToWorld(screen);
    const hit = hitTestGrid(world.x, world.y, this.grid);
    return hit ? { col: hit.col, row: hit.row } : null;
  }

  resize(width: number, height: number): void {
    this.size = { width: Math.max(1, width), height: Math.max(1, height) };
    this.renderer?.setSize(this.size.width, this.size.height, false);
    this.renderer?.setViewport(0, 0, this.size.width, this.size.height);
    this.applyCameraToThree();
    this.built?.syncLineResolution(this.size.width, this.size.height);
    this.renderOnce();
  }

  requestRender(): void {
    this.renderOnce();
  }

  getHandle(): ViewportHandle {
    return {
      getSize: () => ({ ...this.size }),
      // 三维档的"世界根对象"= world 组（与二维的 pixi world 容器同位）
      getRootObject: () => this.world,
      requestRender: () => this.requestRender(),
    };
  }

  /**
   * 适配世界范围到容器（与二维后端 `fitCameraToViewBox` **逐字节同语义**）。
   *
   * 早期实现用硬编码的 1.1 倍系数，导致两个后端的取景不一致：
   * 同一 viewBox 下三维档整体缩小 10% 并偏移约 18px —— 保真对照里表现为
   * 「画面偏、命中格错位」（2026-10-27 实测）。
   *
   * 对齐算法：`scale = min((W-2p)/boxW, (H-2p)/boxH)`，视锥高度 `= H / scale`。
   */
  fitToBounds(viewBox?: ViewBox): void {
    if (viewBox) this.viewBox = { ...viewBox };
    const W = Math.max(1, this.size.width);
    const H = Math.max(1, this.size.height);
    const pad = Math.max(0, this.paddingPx);
    const boxW = Math.max(1, this.viewBox.width);
    const boxH = Math.max(1, this.viewBox.height);

    // 与 fitCameraToViewBox 一致：padding 从两边扣除
    const usableW = Math.max(1, W - pad * 2);
    const usableH = Math.max(1, H - pad * 2);
    const scale = Math.min(usableW / boxW, usableH / boxH);
    const viewHeight = H / scale;

    const center = {
      x: this.viewBox.x + this.viewBox.width / 2,
      y: this.viewBox.y + this.viewBox.height / 2,
    };
    this.orbit = {
      target: { x: center.x, y: 0, z: center.y },
      azimuth: 0,
      polar: ORTHO_PRESET.polar,
      distance: viewHeight * 2,
      viewHeight,
    };
    this.applyCameraToThree();
    this.notifyCamera();
  }

  setViewBox(viewBox: ViewBox): void {
    this.viewBox = { ...viewBox };
    this.fitToBounds();
  }

  getViewBox(): ViewBox {
    return { ...this.viewBox };
  }

  /** 轨道相机读写（三维档专属；模板不依赖）。 */
  getOrbit(): OrbitCamera {
    return structuredClone(this.orbit);
  }

  setOrbit(orbit: OrbitCamera): void {
    this.orbit = { ...orbit, polar: clampPolar(orbit.polar) };
    this.applyCameraToThree();
    this.notifyCamera();
  }

  /** 轨道增量算子（供交互层调用）。 */
  orbitPanBy(deltaWorld: Vec2): void {
    this.orbit = orbitPan(this.orbit, deltaWorld);
    this.applyCameraToThree();
    this.notifyCamera();
  }

  orbitZoomBy(factor: number): void {
    this.orbit = orbitZoom(this.orbit, factor);
    this.applyCameraToThree();
    this.notifyCamera();
  }

  orbitRotateBy(deltaAzimuth: number, deltaPolar = 0): void {
    this.orbit = orbitRotate(this.orbit, deltaAzimuth, deltaPolar);
    this.applyCameraToThree();
    this.notifyCamera();
  }

  /** 读取当前绘制计划（诊断与保真对照用）。 */
  getScenePlan(): ScenePlan | null {
    return this.lastPlan;
  }

  private lastPlan: ScenePlan | null = null;

  private rebuildScene(): void {
    if (!this.world) return;
    this.built?.dispose();
    this.built = null;

    const plan = buildScenePlan({ snapshot: this.snapshot, grid: this.grid });
    this.lastPlan = plan;
    const built = planToSceneObjects(plan, { projection: this.projection });
    this.world.add(built.root);
    this.built = built;
    built.syncLineResolution(this.size.width, this.size.height);
    this.renderOnce();
  }

  private applyCameraToThree(): void {
    const plan = planCamera({
      orbit: this.orbit,
      viewportPx: this.size,
      projection: this.projection,
      preset: ORTHO_PRESET,
    });
    this.currentPlan = plan;

    if (plan.kind === 'orthographic') {
      this.orthoCamera.left = plan.left;
      this.orthoCamera.right = plan.right;
      this.orthoCamera.top = plan.top;
      this.orthoCamera.bottom = plan.bottom;
      this.orthoCamera.near = plan.near;
      this.orthoCamera.far = plan.far;
      this.orthoCamera.position.set(plan.position.x, plan.position.y, plan.position.z);
      // 正俯视时 up=(0,1,0) 与视线平行，lookAt 会退化（NaN）；按极角切换 up。
      const up = cameraUpForPolar(this.orbit.polar);
      this.orthoCamera.up.set(up.x, up.y, up.z);
      this.orthoCamera.lookAt(new Vector3(plan.target.x, plan.target.y, plan.target.z));
      this.orthoCamera.updateProjectionMatrix();
    } else {
      this.perspCamera.fov = plan.fov;
      this.perspCamera.aspect = plan.aspect;
      this.perspCamera.near = plan.near;
      this.perspCamera.far = plan.far;
      this.perspCamera.position.set(plan.position.x, plan.position.y, plan.position.z);
      const up = cameraUpForPolar(this.orbit.polar);
      this.perspCamera.up.set(up.x, up.y, up.z);
      this.perspCamera.lookAt(new Vector3(plan.target.x, plan.target.y, plan.target.z));
      this.perspCamera.updateProjectionMatrix();
    }

    // 二维档保真预设第 2 条：无光照 —— 若场景里残留灯则移除（本后端从不建灯）。
    this.scene?.traverse((child) => {
      if (child instanceof AmbientLight) child.parent?.remove(child);
    });
  }

  private renderOnce(): void {
    if (!this.renderer || !this.scene) return;
    const camera = this.currentPlan?.kind === 'perspective' ? this.perspCamera : this.orthoCamera;
    // `'axis'` 档贴片必须在**每次渲染前**重新对齐相机 —— 放在这里而不是
    // 相机变更回调里，是因为渲染可由「相机变、快照变、resize、手动 requestRender」
    // 多条路径触发，而这里是唯一必经点（无 axis 贴片时是空操作）。
    this.built?.syncBillboards(
      { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      { x: camera.up.x, y: camera.up.y, z: camera.up.z },
    );
    this.renderer.render(this.scene, camera);
  }

  private startLoop(): void {
    // 三维档需要持续渲染（旋转/缩放动画）；用 rAF 而非每帧红raw 全量重建场景。
    if (typeof requestAnimationFrame === 'undefined') return;
    const loop = (): void => {
      if (!this.mounted) return;
      this.renderOnce();
      this.frameHandle = requestAnimationFrame(loop);
    };
    this.frameHandle = requestAnimationFrame(loop);
  }

  private notifyCamera(): void {
    const camera = this.getCamera();
    for (const listener of this.listeners) listener(camera);
  }
}

/** 工厂：宿主注册表用。 */
export function createThreeBackend(options?: Record<string, unknown>): ViewportBackend {
  return new ThreeViewportBackend(options as ThreeBackendOptions);
}
