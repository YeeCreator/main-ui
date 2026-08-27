import type { Camera2D, Vec2 } from './viewportMath';
import { zoomAtScreenPoint } from './viewportMath';
import { animateCamera } from './animation';

/**
 * 视口相机状态序列化格式。
 *
 * 设计目标：
 * - 结构稳定：便于不同项目/不同版本之间迁移
 * - 易读：方便调试
 */
export type SerializedCamera2D = {
  v: 1;
  scale: number;
  pan: { x: number; y: number };
};

export function serializeCamera(camera: Camera2D): SerializedCamera2D {
  return {
    v: 1,
    scale: camera.scale,
    pan: { x: camera.pan.x, y: camera.pan.y },
  };
}

export function deserializeCamera(data: SerializedCamera2D): Camera2D {
  if (!data || data.v !== 1) {
    throw new Error('Unsupported camera serialization format');
  }
  return {
    scale: data.scale,
    pan: { x: data.pan.x, y: data.pan.y },
  };
}

/**
 * 一个更通用的相机控制 API（与 React 无关），方便被协作、撤销栈、工具栏复用。
 */
export type ViewportController = {
  fitToCenter: () => void;
  getCamera: () => Camera2D;
  setCamera: (camera: Camera2D) => void;

  /** 常用命令 */
  zoomIn: (factor?: number) => void;
  zoomOut: (factor?: number) => void;
  /**
   * 缩放到指定 scale（以 anchorScreen 为锚点；默认 viewport 中心）。
   * 说明：scale 是绝对值（world->screen）。
   */
  zoomTo: (scale: number, opts?: { anchorScreen?: Vec2 }) => void;

  /** 将相机动画到目标。 */
  animateToCamera: (target: Camera2D, opts?: { durationMs?: number; signal?: AbortSignal }) => Promise<void>;
};

/**
 * 根据 get/set 生成一个带常用命令的 controller。
 *
 * 说明：
 * - anchorScreen 默认是 viewport 中心；
 * - 若你想用“鼠标点为 anchor”缩放，可以把 anchorScreen 传进来。
 */
export function createViewportController(args: {
  getCamera: () => Camera2D;
  setCamera: (c: Camera2D) => void;
  fitToCenter: () => void;
  getViewportCenterPx?: () => Vec2 | null;
}): ViewportController {
  const { getCamera, setCamera, fitToCenter, getViewportCenterPx } = args;

  const getCenter = (): Vec2 => getViewportCenterPx?.() ?? { x: 0, y: 0 };

  const zoomTo = (scale: number, opts?: { anchorScreen?: Vec2 }) => {
    const current = getCamera();
    const anchor = opts?.anchorScreen ?? getCenter();
    const factor = scale / current.scale;
    if (!Number.isFinite(factor) || factor === 0) return;
    setCamera(zoomAtScreenPoint(current, { factor, anchorScreen: anchor }));
  };

  const zoomIn = (factor = 1.2) => {
    const current = getCamera();
    zoomTo(current.scale * factor, { anchorScreen: getCenter() });
  };

  const zoomOut = (factor = 1.2) => {
    const current = getCamera();
    zoomTo(current.scale / factor, { anchorScreen: getCenter() });
  };

  const animateToCameraFn = (target: Camera2D, opts?: { durationMs?: number; signal?: AbortSignal }) => {
    return animateCamera({
      get: getCamera,
      set: setCamera,
      to: target,
      options: { durationMs: opts?.durationMs, signal: opts?.signal },
    });
  };

  return {
    fitToCenter,
    getCamera,
    setCamera,
    zoomIn,
    zoomOut,
    zoomTo,
    animateToCamera: animateToCameraFn,
  };
}
