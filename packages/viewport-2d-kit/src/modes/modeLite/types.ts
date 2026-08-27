import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { Camera2D, Vec2, ViewBox } from '../../viewportMath';

/**
 * 轻量模式渲染参数。
 */
export type ViewportLiteRenderArgs = {
  /** 当前相机。 */
  camera: Camera2D;
  /** 居中适配。 */
  fitToCenter: () => void;
};

/**
 * 轻量模式组件属性。
 */
export type ViewportLiteProps = {
  /** 固定宽度。 */
  width?: number | string;
  /** 固定高度。 */
  height?: number | string;
  /** 背景色。 */
  background?: string;
  /** 业务世界边界。 */
  viewBox: ViewBox;
  /** 初始相机。 */
  initialCamera?: Camera2D;
  /** 最小缩放。 */
  minScale?: number;
  /** 最大缩放。 */
  maxScale?: number;
  /** 缩放步长。 */
  zoomStep?: number;
  /** fit 计算内边距。 */
  paddingPx?: number;
  /** viewBox 变化时是否自动 fit。 */
  autoFitOnViewBoxChange?: boolean;
  /** 样式。 */
  style?: CSSProperties;
  /** 相机变化回调。 */
  onCamera?: (camera: Camera2D) => void;
  /** 可选：外部控制器引用。 */
  controllerRef?: RefObject<ViewportLiteController | null>;
  /** 固定在屏幕坐标系的覆盖层。 */
  overlay?: ReactNode | ((args: ViewportLiteRenderArgs) => ReactNode);
  /** 子元素。 */
  children?: ReactNode | ((args: ViewportLiteRenderArgs) => ReactNode);
};

/**
 * 轻量模式控制器。
 */
export type ViewportLiteController = {
  /** 读取相机。 */
  getCamera: () => Camera2D;
  /** 写入相机。 */
  setCamera: (camera: Camera2D) => void;
  /** 居中适配。 */
  fitToCenter: () => void;
  /** 放大。 */
  zoomIn: (factor?: number) => void;
  /** 缩小。 */
  zoomOut: (factor?: number) => void;
  /** 绝对缩放。 */
  zoomTo: (scale: number, opts?: { anchorScreen?: Vec2 }) => void;
  /** 动画过渡到目标相机。 */
  animateToCamera: (target: Camera2D, opts?: { durationMs?: number; signal?: AbortSignal }) => Promise<void>;
};
