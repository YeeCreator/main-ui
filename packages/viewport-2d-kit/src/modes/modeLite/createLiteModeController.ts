import type { RefObject } from 'react';
import type { InfiniteViewerRef } from 'react-infinite-viewer';
import type { Camera2D, Vec2 } from '../../viewportMath';
import { clamp, fitCameraToViewBox, zoomAtScreenPoint } from '../../viewportMath';
import { animateCamera } from '../../animation';
import type { ViewportLiteController } from './types';

/**
 * 轻量模式控制器参数。
 */
export type CreateLiteModeControllerArgs = {
  /** Viewer 引用。 */
  viewerRef: RefObject<InfiniteViewerRef | null>;
  /** 相机读取。 */
  getCamera: () => Camera2D;
  /** 相机写入。 */
  setCamera: (camera: Camera2D) => void;
  /** 视口像素大小。 */
  getViewportSize: () => { width: number; height: number } | null;
  /** 世界边界。 */
  viewBox: { x: number; y: number; width: number; height: number };
  /** 最小缩放。 */
  minScale: number;
  /** 最大缩放。 */
  maxScale: number;
  /** fit 内边距。 */
  paddingPx?: number;
};

/**
 * 创建轻量模式控制器。
 *
 * @param args 参数对象。
 * @returns 控制器实例。
 */
export function createLiteModeController(args: CreateLiteModeControllerArgs): ViewportLiteController {
  /**
   * 限制缩放到合法区间。
   *
   * @param camera 输入相机。
   * @returns 约束后相机。
   */
  const constrain = (camera: Camera2D): Camera2D => ({
    ...camera,
    scale: clamp(camera.scale, args.minScale, args.maxScale),
  });

  /**
   * 同步 Viewer 实例滚动/缩放到当前相机。
   *
   * @param camera 输入相机。
   */
  const syncViewer = (camera: Camera2D) => {
    const viewer = args.viewerRef.current;
    if (!viewer) return;

    viewer.setZoom?.(camera.scale);
    // 约定：pan 与 scroll 采用同向映射，便于业务理解。
    viewer.scrollTo?.(camera.pan.x, camera.pan.y);
  };

  /**
   * 设置相机并回写 Viewer。
   *
   * @param camera 输入相机。
   */
  const writeCamera = (camera: Camera2D) => {
    const next = constrain(camera);
    args.setCamera(next);
    syncViewer(next);
  };

  /**
   * 适配并居中。
   */
  const fitToCenter = () => {
    const viewportSize = args.getViewportSize();
    if (!viewportSize) return;

    const fit = fitCameraToViewBox({
      containerPx: viewportSize,
      viewBox: args.viewBox,
      paddingPx: args.paddingPx ?? 12,
    });

    writeCamera(fit);
  };

  /**
   * 按锚点绝对缩放。
   *
   * @param scale 目标缩放。
   * @param opts 可选锚点。
   */
  const zoomTo = (scale: number, opts?: { anchorScreen?: Vec2 }) => {
    const current = args.getCamera();
    const safeScale = clamp(scale, args.minScale, args.maxScale);
    const factor = safeScale / current.scale;
    if (!Number.isFinite(factor) || factor === 0) return;

    const viewportSize = args.getViewportSize();
    const anchor = opts?.anchorScreen ?? {
      x: (viewportSize?.width ?? 0) / 2,
      y: (viewportSize?.height ?? 0) / 2,
    };

    writeCamera(zoomAtScreenPoint(current, { factor, anchorScreen: anchor }));
  };

  /**
   * 放大。
   *
   * @param factor 缩放因子。
   */
  const zoomIn = (factor = 1.2) => {
    const current = args.getCamera();
    zoomTo(current.scale * factor);
  };

  /**
   * 缩小。
   *
   * @param factor 缩放因子。
   */
  const zoomOut = (factor = 1.2) => {
    const current = args.getCamera();
    zoomTo(current.scale / factor);
  };

  /**
   * 动画过渡到目标相机。
   *
   * @param target 目标相机。
   * @param opts 可选动画参数。
   * @returns 动画完成 Promise。
   */
  const animateToCameraFn = (target: Camera2D, opts?: { durationMs?: number; signal?: AbortSignal }) => {
    return animateCamera({
      get: args.getCamera,
      set: writeCamera,
      to: constrain(target),
      options: { durationMs: opts?.durationMs, signal: opts?.signal },
    });
  };

  return {
    getCamera: args.getCamera,
    setCamera: writeCamera,
    fitToCenter,
    zoomIn,
    zoomOut,
    zoomTo,
    animateToCamera: animateToCameraFn,
  };
}
