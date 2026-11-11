/**
 * rendering/backend —— 世界视口渲染后端接口（`ViewportBackend`）。
 *
 * 定位（设计 §十九 3）：把"真正画图的那一层"从视图模板里抽成可插拔契约。
 * 二维（Pixi）与三维（three）各自实现本接口，`view-world` 只依赖本接口，
 * 不直接 import 任何渲染库。
 *
 * 硬约束：
 * 1. 本文件**不得**出现任何渲染库类型（pixi / three）—— 渲染库依赖止于 `render-*` 包
 *    与各自的实现文件。
 * 2. 相机与快照**必须是可序列化纯值**（沿用 `world-state.ts` 防 `structuredClone` 崩溃的
 *    既有做法）。
 * 3. `capabilities` 由后端**运行时声明**，宿主据此探测维度，不在 `EditorDescriptor` 上静态声明。
 */

import type { EntitySnapshot, GridSpec } from '../primitives/types';
import type { Camera2D, Vec2, ViewBox } from './camera';
import type { OrbitCamera } from './camera-bridge';
import type { FlyInput, FreeCamera } from './free-camera';

/** 后端支持的视图维度。 */
export type BackendDimension = 2 | 3;

/**
 * 后端能力声明（运行时探测的唯一来源）。
 *
 * 只声明"本后端能做什么"，不声明"本编辑器是什么"。宿主把已装后端的能力取并集，
 * 维度开关据此决定是否渲染。
 */
export interface BackendCapabilities {
  /** 支持的维度集合（至少一项；二维后端为 `[2]`，三维后端为 `[2, 3]`）。 */
  dimensions: readonly BackendDimension[];
  /** 是否支持粗线（屏幕空间宽度）。 */
  wideLines?: boolean;
  /** 是否支持挤出厚度（`extrude`）。 */
  extrude?: boolean;
  /** 是否支持 MSDF 文字。 */
  msdfText?: boolean;
  /** 是否支持实例化渲染（`InstancedMesh` 类）。 */
  instancing?: boolean;
  /** 后端名（诊断用，不参与判据）。 */
  name?: string;
}

/** 网格命中结果。 */
export interface BackendCellHit {
  col: number;
  row: number;
}

/**
 * 手动模式最小句柄：`@ready` 逃生舱的返回类型。
 *
 * 关键取舍（设计 §十九 3）：Pixi `Application` 与 three `Scene` 这类专属对象
 * **不再由模板暴露**，改由各自后端包在自己的公开面上提供。模板只给这个后端无关句柄。
 */
export interface ViewportHandle {
  /** 容器尺寸（CSS 像素）。 */
  getSize(): { width: number; height: number };
  /**
   * 后端专属根对象（Pixi `Container` / three `Scene`）。
   *
   * 类型为 `unknown`：模板不解释它，宿主要用它时从后端包导入类型断言。
   * 之所以给出口子而非彻底封死 —— 手动模式的意义就是逃生舱。
   */
  getRootObject(): unknown;
  /** 请求重绘（手动模式下由宿主驱动）。 */
  requestRender(): void;
}

/** 后端装配选项。 */
export interface ViewportBackendMountOptions {
  /** 世界范围（相机 fit 目标）。 */
  viewBox: ViewBox;
  minScale?: number;
  maxScale?: number;
  paddingPx?: number;
  /** 背景色（0xRRGGBB）。 */
  background?: number;
  /** 设备像素比（缺省读 `window.devicePixelRatio`）。 */
  devicePixelRatio?: number;
}

/** 快照应用选项。 */
export interface ViewportApplySnapshotOptions {
  snapshot?: EntitySnapshot | null;
  grid?: GridSpec | null;
}

/**
 * 世界视口渲染后端。
 *
 * 生命周期：`mount` → (零到多次 `resize` / `applySnapshot` / 相机读写 / 命中反算) → `unmount`。
 * `unmount` 必须幂等；`mount` 之后对外成员才可用。
 */
export interface ViewportBackend {
  /** 后端名（诊断与日志用）。 */
  readonly name: string;
  /** 能力声明（构造后即可读，不必等 `mount`）。 */
  readonly capabilities: BackendCapabilities;

  /** 装配到容器（异步；内部完成渲染器初始化与首帧）。 */
  mount(container: HTMLElement, options: ViewportBackendMountOptions): Promise<void>;
  /** 幂等销毁。 */
  unmount(): void;

  /** 应用快照与网格（自动渲染模式的唯一入口）。 */
  applySnapshot(options: ViewportApplySnapshotOptions): void;

  /** 读取相机（可序列化纯值）。 */
  getCamera(): Camera2D;
  /** 设置相机（越界由后端按自身 min/max 收敛）。 */
  setCamera(camera: Camera2D): void;
  /** 相机变化回调；返回取消订阅函数。 */
  onCameraChange(listener: (camera: Camera2D) => void): () => void;

  /** 屏幕坐标（容器左上角原点，CSS 像素）→ 世界坐标（二维平面）。 */
  screenToWorld(point: Vec2): Vec2;
  /** 世界坐标（二维平面）→ 屏幕坐标。 */
  worldToScreen(point: Vec2): Vec2;

  /**
   * 网格命中（`col` / `row`）。
   *
   * 二维档**必须保留此语义**，不得用射线打几何替代（边界抖动会破坏确定性）。
   * 无网格配置时返回 `null`。
   */
  pickCell(screen: Vec2): BackendCellHit | null;

  /** 尺寸变更（含 `devicePixelRatio` 对齐）。 */
  resize(width: number, height: number): void;

  /** 请求一次重绘（自动渲染模式下由 `applySnapshot` 内部触发）。 */
  requestRender(): void;

  /** 手动模式最小句柄。 */
  getHandle(): ViewportHandle;

  /** 适配世界范围到容器（缺省用当前 viewBox）。 */
  fitToBounds(viewBox?: ViewBox): void;
  /** 更新世界范围并重新 fit。 */
  setViewBox(viewBox: ViewBox): void;
  /** 读取当前世界范围。 */
  getViewBox(): ViewBox;

  /**
   * 轨道相机读写（**可选**，仅三维档实现）。
   *
   * 为什么不把轨道塞进 `getCamera/setCamera`：`Camera2D` 是**所有后端共用的
   * 统一表示**，它的 `scale/pan/rotation/polar` 已足够表达「看哪里、看多大、
   * 以什么姿态看」。轨道参数（`distance` / `target.y`）是三维后端**内部**的
   * 实现细节，二维后端不该看见。
   *
   * 但模板层需要能问一句「你有轨道吗」，才能把三维档的旋转路由到
   * `orbitRotateBy`（含俯仰），而不是二维的 `rotateAtScreenPoint`（只转画面）。
   */
  readonly orbit?: OrbitBackendApi;

  /**
   * 离屏纹理的**就地刷新**接口（**可选**，仅实现了 `texture-quad` 的后端提供）。
   *
   * ## 为什么不能靠重跑 `applySnapshot`
   *
   * `applySnapshot` 是**全量重建**：销毁并重建几何、材质、实例矩阵与场景节点。
   * 这对「结构变了」是正确的，但对「结构没变、只有纹理像素变了」极度浪费 ——
   * 实时内容（元胞自动机逐代、实时游戏逐帧）每帧重建一次树，帧率必然崩。
   *
   * 本接口只做一件事：**让已绑定的纹理重新上传像素**，场景结构完全不动。
   *
   * @example
   * ```ts
   * // 宿主每帧重画 canvas 后：
   * canvasBackend.textures?.refresh('automaton');
   * ```
   */
  readonly textures?: TextureRefreshApi;
}

/**
 * 三维后端暴露的最小轨道接口（**可选能力**）。
 *
 * 模板层用法（`view-world`）：
 *
 * ```ts
 * if (backend.orbit) backend.orbit.rotateBy(deltaAzimuth, deltaPolar);
 * else backend.setCamera(rotateAtScreenPoint(backend.getCamera(), ...));
 * ```
 *
 * 即：**有轨道走轨道，没轨道退回二维旋转** —— 同一套手势在两种后端下都成立。
 */
/**
 * 离屏纹理就地刷新接口。
 *
 * 只登记「已经绑定到场景的纹理键」，不负责创建/销毁场景对象 ——
 * 增删面片仍然是 `applySnapshot` 的职责。
 */
export interface TextureRefreshApi {
  /**
   * 让指定纹理键重新上传像素。
   *
   * @param key 纹理键（与快照 `texture` 列同值）。
   * @returns 是否命中。键不存在时返回 `false`，**不抛错** ——
   *   宿主在「面片还没建好」或「键拼错」时不应崩服。
   */
  refresh(key: string): boolean;
}

export interface OrbitBackendApi {
  /** 读取轨道相机（可序列化纯值）。 */
  getOrbit(): OrbitCamera;
  /** 写入轨道相机。 */
  setOrbit(orbit: OrbitCamera): void;
  /** 绕目标点旋转（弧度增量；`deltaPolar` 缺省 0）。 */
  rotateBy(deltaAzimuth: number, deltaPolar?: number): void;
  /**
   * 按**屏幕像素位移**旋转（推荐入口；模板层应优先用它）。
   *
   * ## 为什么不再让模板传角度
   *
   * 两种旋转模型的天然输入不同：
   * - **转盘**按「方位角/极角增量」理解拖拽，角度是原生单位；
   * - **轨迹球**按「拖拽方向本身」定转轴（`轴 = 屏幕法线 × 位移`），
   *   **像素位移**才是原生单位。
   *
   * 早期让模板统一传角度，backend 在轨迹球档下把角度「折算回像素」，
   * 这一趟来回需要用两个不同的灵敏度系数（0.01 rad/px 与极角 0.006 rad/px），
   * 极易错配 —— 2026-11-08 实测就出现了「轨迹球方向与光标相反」
   * 与「纵向灵敏度不对」两个症状。
   *
   * 改由本方法接收原始像素，backend 按自己的 `rotationModel` 分派，
   * 模板层**完全不必知道自己接的是哪种模型**。
   *
   * @param deltaX 水平屏幕位移（CSS 像素，向右为正）。
   * @param deltaY 垂直屏幕位移（CSS 像素，**向下为正**）。
   * @param pivot 枢轴（世界地面点）。给了就绕它转，且不预先改写 target
   *   —— 后者会让画面在按下瞬间跳一下。
   */
  rotateByPixels?(deltaX: number, deltaY: number, pivot?: Vec2): void;
  /**
   * 绕**视线轴**自转（roll，弧度增量）。
   *
   * 这是 turntable 模式表达不出的自由度：`azimuth/polar` 只描述「往哪看」，
   * 描述不了「脑袋歪多少」。触控板双指扭转接的就是这里。
   */
  rollBy?(angle: number): void;
  /**
   * 清掉累积的 roll，把地平线摆正（保持视线方向不变）。
   *
   * trackball 模式会累积 roll，需要这个复位入口；turntable 天然无 roll，调用无副作用。
   */
  resetRoll?(): void;
  /**
   * 按世界平面位移平移目标点。
   *
   * 模板层应优先用 `screenToWorld` 两点差自己算位移 —— 那天然包含
   * 极角/方位角/缩放的全部影响，而本方法只管把算好的位移写进去。
   */
  panBy(deltaWorld: Vec2): void;
  /**
   * 按倍率缩放（正交档改 `viewHeight`，透视档改 `distance`）。
   *
   * **以 target 为中心**。要把缩放中心改到光标处，用 `zoomAt`。
   */
  zoomBy(factor: number): void;
  /**
   * **以指定世界点为锚**缩放（锚点屏幕位置保持不动）。
   *
   * 使用者 2026-11-08 的诉求「缩放中心改为光标映射的方向」。模板层把光标经
   * `screenToWorld` 换成世界点传进来即可 —— 不要在外面自己反推 target 位移，
   * 那是本方法内部该做的事（且它依赖 viewHeight 的语义，外面推容易漏项）。
   */
  zoomAt?(factor: number, anchorWorld: Vec2): void;
  /** 切换旋转模型（`'turntable'` 地平线水平 / `'trackball'` 万向）。 */
  setRotationModel?(model: 'turntable' | 'trackball'): void;
  /**
   * **完整复位**：朝向、平移、缩放全部回到默认（等价于「刚打开时」）。
   *
   * 与 `resetRoll`（只清自转）和 `zoomBy`（只改缩放）都不同 ——
   * 使用者 2026-11-08 要的是「一键回到初始状态」。
   */
  resetView?(): void;
  /**
   * **聚焦**到世界范围：只改平移与缩放，**保留当前朝向**。
   *
   * 与 `fitToBounds` 的区别：`fitToBounds` 是「把整个世界装进视口」，
   * 而聚焦可以指向**局部范围**（比如选中的对象），且会按当前极角补偿纵向压缩。
   *
   * @param world 要聚焦的地面范围（缺省 = 当前 viewBox）。
   */
  focusOn?(world?: { x: number; y: number; width: number; height: number }): void;

  // ---------- 自由相机（飞行模式） ----------

  /** 当前是否处于飞行模式。 */
  isFlying?(): boolean;
  /** 读取自由相机（飞行模式外返回 `null`）。 */
  getFreeCamera?(): FreeCamera | null;
  /** 直接设置自由相机。 */
  setFreeCamera?(camera: FreeCamera): void;
  /**
   * 进入飞行模式：从当前轨道姿态**无缝接管**（位置与朝向连续，画面不跳）。
   *
   * 飞行模式下：`W`/`S` 沿视线前后、`A`/`D` 横移、`Q`/`E` 世界竖直升降、
   * 鼠标拖动转向。它与轨道模式的本质差别是**没有注视点**，因此能仰头看天。
   */
  enterFly?(): void;
  /**
   * 退出飞行模式：把当前自由姿态**投影回轨道相机**（画面不跳）。
   *
   * 注视点取「相机前方 `distance` 处」，`distance` 沿用进入前的轨道半径。
   */
  exitFly?(): void;
  /** 施加飞行输入（按 `dtSeconds` 积分；不要传固定值，否则帧率不同速度不同）。 */
  flyBy?(input: FlyInput, dtSeconds: number): void;
}

/**
 * 后端工厂：由 `render-*` 包导出，宿主注册到运行时。
 *
 * 之所以要工厂而非直接给实例：后端构造函数可能持有渲染器状态，
 * 每次编辑器挂载必须拿**新实例**（`view-world` 切后端时旧实例已销毁）。
 */
export type ViewportBackendFactory = (options?: Record<string, unknown>) => ViewportBackend;
