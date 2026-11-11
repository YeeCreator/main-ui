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
  applyFlyInput,
  camera2DToOrbit,
  cameraUpForPolar,
  clampPolar,
  defaultOrbitCamera,
  DEFAULT_FLY_SPEED,
  freeBasis,
  freeFromOrbitPose,
  freeQuat,
  freeToOrbitTarget,
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
  withOrientation,
} from '@main-ui/core/rendering';
import type { FreeCamera, FlyInput } from '@main-ui/core/rendering';
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
import type { QuadTextureResolver } from './texture-quad';
import { DEFAULT_BACKGROUND, ORTHO_PRESET, colorToCss } from './units';

/**
 * 飞行模式的视场角（度）。
 *
 * 取 70 而非 45：飞行需要更宽的视野才能感知速度与周边环境。
 * 第一人称游戏的默认 FOV 普遍在 60–90 之间，70 是其中较稳的中间值
 * （过窄看不出运动，过宽边缘畸变明显）。
 */
const FLY_FOV_DEG = 70;

export interface ThreeBackendOptions {
  /** 强制走 WebGL2 后端（缺省 false：有 WebGPU 则用 WebGPU）。 */
  forceWebGL?: boolean;
  /** 是否开启抗锯齿（缺省 false）。 */
  antialias?: boolean;
  /** 三维档缺省投影（缺省 `orthographic`：二维档预设必须正交）。 */
  projection?: 'orthographic' | 'perspective';
  /**
   * 纹理键 → 图像源（离屏纹理面片用）。
   *
   * 宿主把一块离屏 canvas 注册进解析器，就能用「一个面片」呈现
   * 整幅二维栅格内容（元胞自动机、像素场、位图）。
   * 缺省时这类图元**不渲染**（不画纯色占位板，避免让宿主误以为内容已加载）。
   */
  textureResolver?: QuadTextureResolver | null;
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
  /**
   * 自由相机状态（飞行模式）。
   *
   * **与 `orbitState` 并存而非替换**：飞行模式是一层「覆盖」，退出时清空它
   * 即可回到轨道模式，且轨道状态保留原样。若直接覆盖 `orbitState`，
   * 退出飞行后就没法还原「原来在看哪儿」——那正是使用者最容易感到困惑的地方。
   *
   * `null` 表示当前处于轨道模式。
   */
  private freeState: FreeCamera | null = null;
  /** 飞行模式的移动速度（世界单位/秒；随缩放自动适配）。 */
  private flySpeed = DEFAULT_FLY_SPEED;
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
   * **三条路径**，按当前相机模式分派：
   * 1. **飞行模式**（透视 + 自由相机）：真实射线与 `y = 0` 求交；
   * 2. **正交档**：用相机真实基向量做正交反投影；
   * 3. 其它（透视轨道档）：恒等映射（无精确地面语义）。
   *
   * 三条路径共用一个约定：**返回 `y = 0` 平面上的点**。
   */
  screenToWorld(point: Vec2): Vec2 {
    if (this.freeState) {
      const ground = this.flyScreenToGround(point);
      return ground ?? { x: this.freeState.position.x, y: this.freeState.position.z };
    }
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
    if (this.freeState) {
      const screen = this.flyGroundToScreen(point);
      return screen ?? { x: this.size.width / 2, y: this.size.height / 2 };
    }
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
   * 飞行模式：屏幕点投一条射线，求它与地面 `y = 0` 的交点。
   *
   * ## 为什么不能沿用正交公式
   *
   * 正交投影下所有射线**平行**，可以用「基点 + 沿线偏移」直接反解；
   * 透视投影下每个像素对应一条**方向不同**的射线，必须逐个求交。
   * 用正交公式处理透视，表现为「越靠画面边缘，点击位置偏得越离谱」。
   *
   * @param screen 屏幕像素坐标。
   * @returns 地面交点；视线朝上（永不落到地面）时返回 `null`。
   */
  private flyScreenToGround(screen: Vec2): Vec2 | null {
    if (!this.freeState) return null;
    const basis = freeBasis(this.freeState);
    const aspect = this.size.height > 0 ? this.size.width / this.size.height : 1;
    const halfH = Math.tan((FLY_FOV_DEG * Math.PI) / 180 / 2);

    // 归一化设备坐标（NDC，−1..1，y 向上）
    const ndcX = this.size.width > 0 ? (screen.x / this.size.width) * 2 - 1 : 0;
    const ndcY = this.size.height > 0 ? 1 - (screen.y / this.size.height) * 2 : 0;

    /**
     * 射线方向 = forward + right · (ndcX · halfH · aspect) + up · (ndcY · halfH)。
     * 这是透视投影的标准反投影（竖直半角 halfH，水平按 aspect 放大）。
     */
    const dir = {
      x: basis.forward.x + basis.right.x * (ndcX * halfH * aspect) + basis.up.x * (ndcY * halfH),
      y: basis.forward.y + basis.right.y * (ndcX * halfH * aspect) + basis.up.y * (ndcY * halfH),
      z: basis.forward.z + basis.right.z * (ndcX * halfH * aspect) + basis.up.z * (ndcY * halfH),
    };

    const origin = this.freeState.position;
    /** 射线朝上（或与地面平行）时永不落到地面。 */
    if (Math.abs(dir.y) < 1e-9) return null;
    const t = -origin.y / dir.y;
    if (t <= 0) return null;
    return { x: origin.x + dir.x * t, y: origin.z + dir.z * t };
  }

  /**
   * 飞行模式：地面点 → 屏幕像素（`flyScreenToGround` 的逆）。
   *
   * 做法是把地面点变换到相机空间，再按透视投影公式压缩到屏幕。
   *
   * @param world 地面点（`y = 0`）。
   * @returns 屏幕像素；点位于相机背后时返回 `null`。
   */
  private flyGroundToScreen(world: Vec2): Vec2 | null {
    if (!this.freeState) return null;
    const basis = freeBasis(this.freeState);
    const aspect = this.size.height > 0 ? this.size.width / this.size.height : 1;
    const halfH = Math.tan((FLY_FOV_DEG * Math.PI) / 180 / 2);

    // 相机空间的偏移
    const d = {
      x: world.x - this.freeState.position.x,
      y: -this.freeState.position.y,
      z: world.y - this.freeState.position.z,
    };
    // 投影到相机三轴（相机看向自身 −Z，故沿 forward 的分量是「深度」）
    const depth = d.x * basis.forward.x + d.y * basis.forward.y + d.z * basis.forward.z;
    if (depth <= 1e-6) return null; // 在相机背后
    const sx = d.x * basis.right.x + d.y * basis.right.y + d.z * basis.right.z;
    const sy = d.x * basis.up.x + d.y * basis.up.y + d.z * basis.up.z;

    // 透视除法 → NDC → 屏幕
    const ndcX = sx / (depth * halfH * aspect);
    const ndcY = sy / (depth * halfH);
    return {
      x: ((ndcX + 1) / 2) * this.size.width,
      y: ((1 - ndcY) / 2) * this.size.height,
    };
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

  // ---------- 自由相机（飞行模式） ----------

  /** 当前是否处于飞行模式。 */
  isFlying(): boolean {
    return this.freeState !== null;
  }

  /** 读取自由相机（飞行模式外返回 `null`）。 */
  getFreeCamera(): FreeCamera | null {
    return this.freeState ? structuredClone(this.freeState) : null;
  }

  /**
   * 进入飞行模式：从当前轨道姿态**无缝接管**。
   *
   * 相机位置与朝向完全取自轨道相机的当前状态，所以进入的瞬间画面不变。
   * 速度按视锥高度自适应 —— 否则「缩得很近时一动就飞出去」或
   * 「缩得很远时怎么按都没动」。
   */
  enterFly(): void {
    if (this.freeState) return;
    const basis = orbitBasis(this.orbitState);
    const position = {
      x: this.orbitState.target.x - basis.forward.x * this.orbitState.distance,
      y: this.orbitState.target.y - basis.forward.y * this.orbitState.distance,
      z: this.orbitState.target.z - basis.forward.z * this.orbitState.distance,
    };
    /**
     * 速度与视锥高度挂钩：一屏大约 1 秒走完，无论当前缩放到什么程度。
     * 这是 DCC 的通行做法（Blender Walk 的速度也随场景尺度变）。
     */
    this.flySpeed = Math.max(1, this.orbitState.viewHeight);
    this.freeState = freeFromOrbitPose({ position, basis, speed: this.flySpeed });
    /**
     * **必须调用 `applyCameraToThree()`**，不能只 `notifyCamera()`。
     *
     * 前者把状态写进 three 的相机（位置 / 姿态 / near-far / 投影），
     * 后者只通知监听者「相机变了」。少这一步表现为：
     * 状态全对（`freeState` 正确）、通知也发了，但 `perspCamera` 还停在
     * 构造默认值 `pos=(0,0,0)` —— 于是**画面全空**，而看状态又查不出问题。
     *
     * 这正是 2026-11-08 首版踩的坑：`exitFly` 里有这一步、`enterFly` 里漏了。
     */
    this.applyCameraToThree();
    this.notifyCamera();
  }

  /**
   * 退出飞行模式：把当前自由姿态**投影回轨道相机**，画面不跳。
   *
   * 注视点取「相机前方 `distance` 处」；`distance` 沿用进入前的轨道半径
   * （保证退出后的缩放观感与进入前一致）。
   */
  exitFly(): void {
    if (!this.freeState) return;
    const free = this.freeState;
    const basis = freeBasis(free);
    const distance = Math.max(1, this.orbitState.distance);
    const target = freeToOrbitTarget(free, distance);
    this.orbitState = withOrientation(
      {
        ...this.orbitState,
        target,
        distance,
        rotationModel: this.orbitState.rotationModel,
      },
      freeQuat(free),
    );
    this.freeState = null;
    this.applyCameraToThree();
    this.notifyCamera();
  }

  /** 施加飞行输入（按 dt 积分）。 */
  flyBy(input: FlyInput, dtSeconds: number): void {
    if (!this.freeState) return;
    this.freeState = applyFlyInput(this.freeState, input, dtSeconds);
    this.applyCameraToThree();
    this.notifyCamera();
  }

  /** 直接设置自由相机（供宿主保存/恢复视图状态）。 */
  setFreeCamera(camera: FreeCamera): void {
    this.freeState = {
      ...camera,
      position: { ...camera.position },
      speed: camera.speed ?? this.flySpeed,
    };
    this.applyCameraToThree();
    this.notifyCamera();
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
    // 飞行模式下先退出：否则复位改的是 orbitState，画面上毫无反应
    if (this.freeState) this.exitFly();
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
    /**
     * 飞行模式下聚焦：把自由相机**移到能看全目标**的位置，
     * 而不是退出飞行 —— 否则「按 F 就掉出飞行模式」会很意外。
     *
     * 做法：保持当前朝向，把相机沿视线退到足够远，
     * 再把注视点对到目标中心（自由相机没有 target，故用地面交点表达）。
     */
    if (this.freeState) {
      const free = this.freeState;
      const { forward } = freeBasis(free);
      const cx = target.x + target.width / 2;
      const cz = target.y + target.height / 2;
      /** 需要的距离：按目标尺寸与视锥高度估算（正交档下取目标长边 1.6 倍）。 */
      const span = Math.max(target.width, target.height) * 1.6;
      /**
       * 让「相机 → 目标中心」的距离为 span：
       * 沿当前视线反推一个位于目标上方的相机位置。
       * 视线几乎水平时无法保证看全，故下限取 `span` 本身的高度。
       */
      const dy = Math.max(1, Math.abs(forward.y));
      const height = span / dy;
      this.freeState = {
        ...free,
        position: {
          x: cx - forward.x * height,
          y: height - forward.y * height,
          z: cz - forward.z * height,
        },
        speed: Math.max(1, span),
      };
      this.applyCameraToThree();
      this.notifyCamera();
      return;
    }
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
    isFlying: () => this.isFlying(),
    getFreeCamera: () => this.getFreeCamera(),
    setFreeCamera: (camera) => this.setFreeCamera(camera),
    enterFly: () => this.enterFly(),
    exitFly: () => this.exitFly(),
    flyBy: (input, dtSeconds) => this.flyBy(input, dtSeconds),
  };

  private rebuildScene(): void {
    if (!this.world) return;
    this.built?.dispose();
    this.built = null;

    const plan = buildScenePlan({ snapshot: this.snapshot, grid: this.grid });
    this.lastPlan = plan;
    const built = planToSceneObjects(plan, {
      projection: this.projection,
      textureResolver: this.options.textureResolver ?? null,
    });
    this.world.add(built.root);
    this.built = built;
    built.syncLineResolution(this.size.width, this.size.height);
    this.renderOnce();
  }

  private applyCameraToThree(): void {
    /**
     * **飞行模式下走另一条装配路径**。
     *
     * 自由相机没有 `target`，也没有「正交视锥高度」这个概念（它是真三维穿行）。
     * 若仍塞进 `planCamera`（那是按轨道语义写的），会出现两类错误：
     * 用 target 反推位置、以及把 viewHeight 当作画面尺寸。
     *
     * 故这里分支：飞行模式直接用自由相机的 position + quat 装配，
     * 投影固定用**透视**（正交投影下「飞近飞远」看不出距离感，
     * 那是飞行最需要的感觉）。
     */
    if (this.freeState) {
      this.applyFreeCameraToThree(this.freeState);
      return;
    }

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

  /**
   * 把自由相机装配到 three 的透视相机上。
   *
   * ## 为什么飞行模式固定用透视投影
   *
   * 正交投影下「向前飞」不会让物体变大 —— 因为正交投影丢弃了距离信息。
   * 而**距离感正是飞行最需要的东西**：飞近、飞远、贴着地面掠过，
   * 全都靠透视的「近大远小」来表达。故飞行档强制透视。
   *
   * 代价：从正交轨道切到飞行时透视关系会变一次。这是两种投影的固有差异，
   * 无法消除，只能让位置与朝向连续（那已经由 `enterFly` 保证了）。
   */
  private applyFreeCameraToThree(camera: FreeCamera): void {
    const aspect = this.size.height > 0 ? this.size.width / this.size.height : 1;

    /**
     * 远/近裁剪面按「相机高度 + 世界尺寸」推导。
     *
     * ## near/far 比值必须控制住
     *
     * 深度缓冲精度与 `far / near` 成反比：比值 80000:1 时，
     * 16 位深度只剩几个可用层级，地面与图元的细微高差全部塌到同一层 ——
     * 表现为「整个场景不渲染」或「大片 z-fighting 闪烁」。
     *
     * 早期写法 `near = span × 0.0005` / `far = span × 40` 得到 80000:1，
     * 实测结果就是画面全空。改为：`near` 取「到目标的最小合理距离」，
     * `far` 取「能看到最远内容的距离」，比值控制在 1000:1 以内。
     */
    const worldSpan = Math.max(this.viewBox.width, this.viewBox.height, 100);
    const altitude = Math.max(1, Math.abs(camera.position.y));
    /** 最远要看到的内容：世界对角线 + 相机高度。 */
    const far = Math.max(worldSpan * 3, altitude * 4) + worldSpan;
    /**
     * 最近要看到的内容：`far / 1000`。
     *
     * **这个分母直接钉死精度上界**：far/near 恒为 1000:1，
     * 与相机高低、世界大小都无关。
     *
     * 早期两种写法都踩过坑：
     * - `span × 0.0005` 配 `span × 40` ⇒ 80000:1（深度精度崩，画面全空）
     * - 加 `Math.max(0.1, …)` 绝对下限后，相机很低时 near 被钉在 0.1、
     *   而 far 仍是 2048 ⇒ 20480:1，同样超限
     *
     * 结论：**下限也必须用相对量表达**，不用绝对常数。
     */
    const near = far / 1000;

    const cam = this.perspCamera;
    cam.fov = FLY_FOV_DEG;
    cam.aspect = aspect;
    cam.near = near;
    cam.far = far;
    cam.position.set(camera.position.x, camera.position.y, camera.position.z);
    /**
     * 姿态用 `up` + `lookAt` 装配，而不是直接写 `quaternion`。
     *
     * ## 为什么不直接写四元数
     *
     * `quaternion.set()` 只改姿态分量，`matrixWorld` 要等渲染器在 `render()`
     * 里按 `matrixAutoUpdate` 重算。这条路**已经踩过坑**：飞行模式首版
     * 直接写 `quaternion` 后画面全空（状态全对、就是不渲染）。
     *
     * `lookAt` 是 three 的公开 API，它内部会同时处理 `quaternion` 与矩阵标记，
     * 且与本后端正交档的装配方式一致 —— 统一走一条路径，少一类边界。
     *
     * `up` 由四元数反算（含 roll），故 `lookAt` 能还原完整姿态：
     * `lookAt` 只保证「看向目标 + 尽量贴近 up」，而 up 已含 roll 信息。
     */
    const basis = freeBasis(camera);
    cam.up.set(basis.up.x, basis.up.y, basis.up.z);
    cam.lookAt(
      camera.position.x + basis.forward.x,
      camera.position.y + basis.forward.y,
      camera.position.z + basis.forward.z,
    );
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);

    /**
     * `currentPlan` 置 `null`：它描述的是**正交视锥**，飞行模式下没有对应物。
     * 下游 `screenToWorld` / `pickCell` 会据此走飞行专用分支（见那两处的守卫）。
     */
    this.currentPlan = null;

    this.scene?.traverse((child) => {
      if (child instanceof AmbientLight) child.parent?.remove(child);
    });
  }

  private renderOnce(): void {
    if (!this.renderer || !this.scene) return;
    /**
     * 飞行模式固定用透视相机（见 `applyFreeCameraToThree` 的说明）。
     * 正交档则按 `currentPlan` 选 —— 那是既有逻辑，逐字节不变。
     */
    const camera = this.freeState
      ? this.perspCamera
      : this.currentPlan?.kind === 'perspective'
        ? this.perspCamera
        : this.orthoCamera;
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
