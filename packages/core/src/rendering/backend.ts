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
}

/**
 * 后端工厂：由 `render-*` 包导出，宿主注册到运行时。
 *
 * 之所以要工厂而非直接给实例：后端构造函数可能持有渲染器状态，
 * 每次编辑器挂载必须拿**新实例**（`view-world` 切后端时旧实例已销毁）。
 */
export type ViewportBackendFactory = (options?: Record<string, unknown>) => ViewportBackend;
