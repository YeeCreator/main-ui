/**
 * view-world/types —— 2D 世界可视化视图模板的公共类型。
 *
 * view-world 是 MUI 的 L1 中级游戏引擎层：消费通用 EntitySnapshot 自动渲染图元，
 * 或经 onReady 逃生舱手动渲染（取代已废弃的 view-2d）。
 */
import type { EntitySnapshot, GridSpec } from '@main-ui/core/primitives';
import type { Camera2D, ViewBox, Vec2 } from '@main-ui/core/rendering';

export type { EntitySnapshot, GridSpec, Camera2D, ViewBox, Vec2 };

/** 默认世界范围（无 snapshot/grid 时兜底）。 */
export const DEFAULT_WORLD_VIEWBOX: ViewBox = { x: 0, y: 0, width: 800, height: 600 };

/** 相机状态（进视图状态契约；纯值，不含响应式 Proxy）。 */
export type WorldCameraState = {
  scale: number;
  pan: { x: number; y: number };
};

/** view-world 的视图状态快照（type 别名以兼容 Record<string, unknown> 契约）。 */
export type WorldViewState = {
  camera: WorldCameraState;
};

/** 世界坐标命中结果（InteractionLayer 抛出）。 */
export interface WorldPointerPayload {
  /** 世界坐标。 */
  world: Vec2;
  /** 相对画布左上角的屏幕坐标（CSS 像素）。 */
  screen: Vec2;
}

/** 网格命中结果（InteractionLayer 抛出）。 */
export interface WorldCellPayload extends WorldPointerPayload {
  col: number;
  row: number;
}

/**
 * onReady 逃生舱交给宿主的命令式 API（手动模式）。
 *
 * 宿主拿到 `world` 容器后可直接往里 addChild 任意 PixiJS 对象（世界坐标），
 * 相机由 view-world 唯一管理。
 */
export interface WorldReadyApi {
  /** 世界坐标容器（相机已应用）。 */
  world: import('pixi.js').Container;
  /** 屏幕坐标 -> 世界坐标。 */
  screenToWorld: (point: Vec2) => Vec2;
  /** 世界坐标 -> 屏幕坐标。 */
  worldToScreen: (point: Vec2) => Vec2;
  /** 适配世界范围到容器。 */
  fitToBounds: (viewBox?: ViewBox) => void;
  /** 读取当前相机。 */
  getCamera: () => Camera2D;
  /** 设置相机。 */
  setCamera: (camera: Camera2D) => void;
  /** 读取容器渲染尺寸（CSS 像素）。 */
  getSize: () => { width: number; height: number };
}
