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
  defaultOrbitCamera,
  groundToScreenOrtho,
  orbitBasis,
  orbitFocus,
  orbitPan,
  orbitResetRoll,
  orbitRoll,
  orbitRotate,
  orbitRotatePixels,
  orbitToCamera2D,
  orbitZoom,
  orbitZoomAtPoint,
  screenToGroundOrtho,
} from '@main-ui/core/rendering';
import type {
  BackendCapabilities,
  BackendCellHit,
  OrbitBackendApi,
  ViewportApplySnapshotOptions,
  ViewportBackend,
  ViewportBackendMountOptions,
  ViewportHandle,
} from '@main-ui/core/rendering';
import { hitTestGrid } from '@main-ui/core/primitives';
import {
  fitViewHeightForWorld,
  planCamera,
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
  private orbitState: OrbitCamera;
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
    this.orbitState = camera2DToOrbit({ scale: 1, pan: { x: 400, y: 300 } }, this.size);
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
    // viewport 为 0 时线宽也变 0 → 线完全不可见（2026-10-27 实测）。
    //
    // ⚠ **viewport 单位是物理像素**（= CSS 尺寸 × pixelRatio），不是 CSS 像素。
    // 设成 CSS 尺寸时，高清屏（dpr=2）下只画到左下 1/4，表现为「内容缩在角落」。
    // three 的 `setSize` 会自动把 viewport 设成 `size × pixelRatio`，故只需调它；
    // 显式重设时也必须换单位。
    renderer.setSize(this.size.width, this.size.height, true);
    this.syncViewport();
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
    return orbitToCamera2D(this.orbitState, this.size);
  }

  setCamera(camera: Camera2D): void {
    this.orbitState = camera2DToOrbit(camera, this.size);
    this.applyCameraToThree();
    this.notifyCamera();
  }

  onCameraChange(listener: (camera: Camera2D) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== listener);
    };
  }

  /**
   * 屏幕像素 → 地面世界坐标。
   *
   * **用相机的真实基向量做正交反投影**，而不是「屏幕旋转 + `cos(polar)`」的简化模型。
   *
   * 简化模型隐含「相机 up 与世界 Y 同向」的假设，一旦姿态带 roll
   * （轨迹球 / 绕视线自转）就失效 —— 表现为「平移方向错乱」
   * 与「旋转按下瞬间定位偏移」。两者都是同一个根因：
   * `screenToWorld` 与真实相机姿态不自洽。
   */
  screenToWorld(point: Vec2): Vec2 {
    const frame = this.groundFrame();
    if (!frame) return { x: point.x, y: point.y };
    return screenToGroundOrtho({
      screen: point,
      basis: frame.basis,
      target: this.orbitState.target,
      halfWidth: frame.halfWidth,
      halfHeight: frame.halfHeight,
      viewportPx: this.size,
    });
  }

  worldToScreen(point: Vec2): Vec2 {
    const frame = this.groundFrame();
    if (!frame) return { x: point.x, y: point.y };
    return groundToScreenOrtho({
      world: point,
      basis: frame.basis,
      target: this.orbitState.target,
      halfWidth: frame.halfWidth,
      halfHeight: frame.halfHeight,
      viewportPx: this.size,
    });
  }

  /**
   * 取当前视锥的「地面换算框架」：相机基向量 + 视锥半宽/半高。
   *
   * 正交档下才有精确的地面投影语义（透视档一个像素对应一条**不同方向**的射线，
   * 不能整体反投影），故透视档返回 `null`，调用方退回恒等映射。
   */
  private groundFrame(): {
    basis: { forward: { x: number; y: number; z: number }; up: { x: number; y: number; z: number }; right: { x: number; y: number; z: number } };
    halfWidth: number;
    halfHeight: number;
  } | null {
    if (!this.currentPlan || this.currentPlan.kind !== 'orthographic') return null;
    const plan = this.currentPlan as OrthoCameraPlan;
    return {
      basis: orbitBasis(this.orbitState),
      halfWidth: (plan.right - plan.left) / 2,
      halfHeight: (plan.top - plan.bottom) / 2,
    };
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
    this.renderer?.setSize(this.size.width, this.size.height, true);
    this.syncViewport();
    this.applyCameraToThree();
    this.built?.syncLineResolution(this.size.width, this.size.height);
    this.renderOnce();
  }

  /**
   * 把 viewport 同步到当前尺寸。
   *
   * **单位是 CSS 像素，不是绘图缓冲像素。**
   *
   * `WebGLRenderer.setViewport` 内部会自己做 `multiplyScalar(_pixelRatio)`
   * （three r186 `WebGLRenderer.js` 的 `state.viewport(_currentViewport.copy(_viewport)
   * .multiplyScalar(_pixelRatio).floor())`），因此这里传 CSS 像素才是对的。
   *
   * 若在这里先乘一遍 `devicePixelRatio`，视口会被放大成 2 倍：
   * 视锥中心被推到 canvas 可见区之外，`drawCalls` 与三角面计数都正常，
   * **但画面上一个像素都不出现** —— 2026-11-07 实测踩到，且极难从
   * 「渲染统计正常」反推，因为统计来自提交给 GPU 的数据，与落在哪无关。
   */
  private syncViewport(): void {
    if (!this.renderer) return;
    this.renderer.setViewport(0, 0, Math.round(this.size.width), Math.round(this.size.height));
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

    /**
     * 视锥高度：让世界**恰好贴边**填满容器（含 padding 留白）。
     *
     * 算法与单测共用同一份实现（`fitViewHeightForWorld`）—— 两处各写一份
     * 会重现「后端算一套、测试断言另一套」的假绿灯。
     */
    const viewHeight = fitViewHeightForWorld({
      containerPx: { width: W, height: H },
      world: { width: boxW, height: boxH },
      paddingPx: pad,
    });

    const center = {
      x: this.viewBox.x + this.viewBox.width / 2,
      y: this.viewBox.y + this.viewBox.height / 2,
    };
    this.orbitState = {
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
    return structuredClone(this.orbitState);
  }

  setOrbit(orbit: OrbitCamera): void {
    this.orbitState = { ...orbit, polar: clampPolar(orbit.polar) };
    this.applyCameraToThree();
    this.notifyCamera();
  }

  /** 轨道增量算子（供交互层调用）。 */
  orbitPanBy(deltaWorld: Vec2): void {
    this.orbitState = orbitPan(this.orbitState, deltaWorld);
    this.applyCameraToThree();
    this.notifyCamera();
  }

  orbitZoomBy(factor: number): void {
    this.orbitState = orbitZoom(this.orbitState, factor);
    this.applyCameraToThree();
    this.notifyCamera();
  }

  /** 以世界锚点缩放（锚点屏幕位置不动）。 */
  orbitZoomAt(factor: number, anchorWorld: Vec2): void {
    this.orbitState = orbitZoomAtPoint(this.orbitState, factor, anchorWorld);
    this.applyCameraToThree();
    this.notifyCamera();
  }

  /** 绕视线轴自转（roll）。 */
  orbitRollBy(angle: number): void {
    this.orbitState = orbitRoll(this.orbitState, angle);
    this.applyCameraToThree();
    this.notifyCamera();
  }

  /** 清掉累积 roll（保持视线方向）。 */
  orbitResetRoll(): void {
    this.orbitState = orbitResetRoll(this.orbitState);
    this.applyCameraToThree();
    this.notifyCamera();
  }

  /** 切换旋转模型。 */
  orbitSetRotationModel(model: 'turntable' | 'trackball'): void {
    if (this.orbitState.rotationModel === model) return;
    this.orbitState = { ...this.orbitState, rotationModel: model };
    // 切回 turntable 时清掉四元数姿态，否则它仍压着角度、切换看起来无效
    if (model === 'turntable') delete this.orbitState.orientation;
    this.applyCameraToThree();
    this.notifyCamera();
  }

  /**
   * 完整复位：朝向、平移、缩放全部回到默认。
   *
   * 用 `defaultOrbitCamera` 而不是「记快照再恢复」：后者会把
   * 「第一次 fit 时的偶然值」当成默认值，跟着世界尺寸变化就失准。
   */
  resetView(): void {
    this.orbitState = defaultOrbitCamera({ world: this.viewBox, paddingPx: 0 });
    // 复位后按视口宽高比重新求视锥高度，保证内容不溢出
    const aspect = this.size.height > 0 ? this.size.width / this.size.height : 1;
    this.orbitState = orbitFocus(this.orbitState, this.viewBox, { aspect, padding: 0 });
    this.applyCameraToThree();
    this.notifyCamera();
  }

  /** 聚焦到世界范围：只改平移与缩放，保留当前朝向。 */
  focusOn(world?: { x: number; y: number; width: number; height: number }): void {
    const target = world ?? this.viewBox;
    const aspect = this.size.height > 0 ? this.size.width / this.size.height : 1;
    this.orbitState = orbitFocus(this.orbitState, target, { aspect, padding: 0.05 });
    this.applyCameraToThree();
    this.notifyCamera();
  }

  orbitRotateBy(deltaAzimuth: number, deltaPolar = 0): void {
    this.orbitState = orbitRotate(this.orbitState, deltaAzimuth, deltaPolar);
    this.applyCameraToThree();
    this.notifyCamera();
  }

  /**
   * 按屏幕像素位移旋转（模板层的推荐入口）。
   *
   * **枢轴一经传入就固定**：绕「按下时光标下的地面点」转，且**不预先改写 target**
   * ——早期实现先把 target 挪到枢轴、再旋转，那一步会让画面在按下瞬间跳一下。
   * 现在由 `orbitRotatePixels` 直接做「绕枢轴旋转 + 补偿 target」的等价变换，
   * 枢轴点的屏幕位置保持不变，其余点绕它转动。
   *
   * 两种模型各走各的原生单位，**不做角度 ↔ 像素的来回折算**：
   * - 转盘：横向像素 → 方位角，纵向像素 → 绕相机右轴的俯仰；
   * - 轨迹球：像素位移直送，按「轴 = 屏幕法线 × 位移」求转轴。
   */
  orbitRotateByPixels(deltaX: number, deltaY: number, pivot?: Vec2): void {
    const next = orbitRotatePixels(this.orbitState, deltaX, deltaY, pivot);
    if (next === this.orbitState) return;
    this.orbitState = next;
    this.applyCameraToThree();
    this.notifyCamera();
  }

  /** 读取当前绘制计划（诊断与保真对照用）。 */
  getScenePlan(): ScenePlan | null {
    return this.lastPlan;
  }

  private lastPlan: ScenePlan | null = null;

  /**
   * 轨道能力（`ViewportBackend.orbit`，可选）。
   *
   * 模板层据此判断「该把三维档的旋转路由到轨道算子（含俯仰），
   * 还是退回二维的画面旋转」。用 getter 返回一个绑定了 `this` 的稳定对象，
   * 避免每次 `backend.orbit` 都新建一份。
   */
  readonly orbit: OrbitBackendApi = {
    getOrbit: () => this.getOrbit(),
    setOrbit: (orbit) => this.setOrbit(orbit),
    rotateBy: (deltaAzimuth, deltaPolar = 0) => this.orbitRotateBy(deltaAzimuth, deltaPolar),
    rotateByPixels: (deltaX, deltaY, pivot) => this.orbitRotateByPixels(deltaX, deltaY, pivot),
    rollBy: (angle) => this.orbitRollBy(angle),
    resetRoll: () => this.orbitResetRoll(),
    panBy: (deltaWorld) => this.orbitPanBy(deltaWorld),
    zoomBy: (factor) => this.orbitZoomBy(factor),
    zoomAt: (factor, anchorWorld) => this.orbitZoomAt(factor, anchorWorld),
    setRotationModel: (model) => this.orbitSetRotationModel(model),
    resetView: () => this.resetView(),
    focusOn: (world) => this.focusOn(world),
  };

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
      orbit: this.orbitState,
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
      /**
       * 上方向：**plan 给了就用 plan 的**。
       *
       * trackball / roll 档下的姿态含自转，极角无法表达 —— 若仍按
       * `cameraUpForPolar(polar)` 推导，滚过的画面会被强行摆正（视觉上「转不上去」）。
       * 只有在无 orientation 的 turntable 档才走极角推导（那也是避免正俯视退化的路径）。
       */
      const up = plan.up ?? cameraUpForPolar(this.orbitState.polar);
      this.orthoCamera.up.set(up.x, up.y, up.z);
      this.orthoCamera.lookAt(new Vector3(plan.target.x, plan.target.y, plan.target.z));
      this.orthoCamera.updateProjectionMatrix();
    } else {
      this.perspCamera.fov = plan.fov;
      this.perspCamera.aspect = plan.aspect;
      this.perspCamera.near = plan.near;
      this.perspCamera.far = plan.far;
      this.perspCamera.position.set(plan.position.x, plan.position.y, plan.position.z);
      const up = plan.up ?? cameraUpForPolar(this.orbitState.polar);
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
