/**
 * view-world/types —— 世界可视化视图模板的公共类型（后端无关）。
 *
 * view-world 是 MUI 的 L1 中级游戏引擎层：消费通用 EntitySnapshot 自动渲染图元，
 * 或经 onReady 逃生舱手动渲染（取代已废弃的 view-2d）。
 *
 * 后端由 `ViewportBackend`（`@main-ui/core/rendering`）抽象：二维档走 Pixi 后端，
 * 三维档走 `@main-ui/render-3d`（three），模板本身**不 import 任何渲染库**。
 */
import type { EntitySnapshot, GridSpec } from '@main-ui/core/primitives';
import type { TextureResolver } from '@main-ui/core/primitives';
import type {
  BackendDimension,
  Camera2D,
  OrbitCamera,
  Vec2,
  ViewBox,
  ViewportBackend,
  ViewportBackendFactory,
} from '@main-ui/core/rendering';

export type { EntitySnapshot, GridSpec, TextureResolver, Camera2D, ViewBox, Vec2, BackendDimension, OrbitCamera, ViewportBackend, ViewportBackendFactory };

/** 默认世界范围（无 snapshot/grid 时兜底）。 */
export const DEFAULT_WORLD_VIEWBOX: ViewBox = { x: 0, y: 0, width: 800, height: 600 };

/** 相机状态（进视图状态契约；纯值，不含响应式 Proxy）。 */
export type WorldCameraState = {
  scale: number;
  pan: { x: number; y: number };
  /** 旋转角（弧度，缺省 0）。旧快照无此字段，属向后兼容的可选字段。 */
  rotation?: number;
};

/** view-world 的视图状态快照（type 别名以兼容 Record<string, unknown> 契约）。 */
export type WorldViewState = {
  camera: WorldCameraState;
  /** 三维轨道相机（可选；仅三维后端会写，二维后端不下发）。 */
  orbit?: OrbitCamera;
  /** 当前维度（可选；缺省视为 2）。 */
  dimension?: BackendDimension;
};

/** 指针事件的修饰键状态。 */
export interface WorldPointerModifiers {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

/**
 * 世界坐标命中结果（InteractionLayer 抛出）。
 *
 * `button` / `modifiers` 为**可选字段**（对手势/键盘来源的事件可能缺省），
 * 既有只读 `world`/`screen` 的消费者完全兼容。
 */
export interface WorldPointerPayload {
  /** 世界坐标。 */
  world: Vec2;
  /** 相对画布左上角的屏幕坐标（CSS 像素）。 */
  screen: Vec2;
  /** 鼠标键：0 左 / 1 中 / 2 右（PointerEvent.button）。 */
  button?: number;
  /** 修饰键状态。 */
  modifiers?: WorldPointerModifiers;
}

/** 网格命中结果（InteractionLayer 抛出）。 */
export interface WorldCellPayload extends WorldPointerPayload {
  col: number;
  row: number;
}

/**
 * 滚轮分流策略：
 * - `auto`（默认）：捏合（ctrlKey）→ 缩放；非 ctrlKey wheel → 平移（双指滑视口/离散滚轮）。
 * - `zoom`：一律缩放（旧行为）。
 * - `pan`：一律平移。
 */
export type WorldWheelMode = 'zoom' | 'pan' | 'auto';

/**
 * `world-click` 抛出策略：
 * - `left`（默认）：仅左键（button===0）抛 `world-click`；右键抛 `world-contextmenu`。
 * - `any`：任意键都抛 `world-click`（v0.6.0 旧行为，供向后兼容 opt-out）。
 */
export type WorldClickButtonPolicy = 'left' | 'any';

/**
 * onReady 逃生舱交给宿主的命令式 API（手动模式）。
 *
 * **后端无关最小句柄**（设计 §十九 3）：画布尺寸 · 根容器/场景对象 · `requestRender`。
 * Pixi `Application` 与 three `Scene` 这类专属对象**不再由模板暴露**——
 * 需要时从各自后端包（`@main-ui/core/rendering` 的 `PixiViewport` / `@main-ui/render-3d`）
 * 的公开面上取。`getRootObject()` 返回的即世界坐标内容根（相机已应用）：
 * 二维为 Pixi `Container`，三维为 three `Scene` 的世界组。
 */
export interface WorldReadyApi {
  /** 画布尺寸（CSS 像素）。 */
  getSize: () => { width: number; height: number };
  /** 世界坐标内容根（相机已应用；三维档下为 `Object3D` 容器）。 */
  getRootObject: () => unknown;
  /** 请求重绘（手动模式下由宿主驱动）。 */
  requestRender: () => void;
  /** 屏幕坐标 -> 世界坐标（二维平面）。 */
  screenToWorld: (point: Vec2) => Vec2;
  /** 世界坐标 -> 屏幕坐标。 */
  worldToScreen: (point: Vec2) => Vec2;
  /** 适配世界范围到容器。 */
  fitToBounds: (viewBox?: ViewBox) => void;
  /** 读取当前相机。 */
  getCamera: () => Camera2D;
  /** 设置相机。 */
  setCamera: (camera: Camera2D) => void;
  /** 以屏幕锚点旋转相机（缩放不变）。 */
  rotateAtScreenPoint: (deltaAngle: number, anchorScreen: Vec2) => void;
  /** 当前后端实例（后端无关；供宿主读 `capabilities` 与专用出口）。 */
  getBackend: () => ViewportBackend | null;
}
