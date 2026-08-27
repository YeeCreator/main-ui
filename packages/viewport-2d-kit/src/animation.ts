import type { Camera2D } from './viewportMath';

export type EasingFn = (t: number) => number;

export const easeOutCubic: EasingFn = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic: EasingFn = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpCamera(a: Camera2D, b: Camera2D, t: number): Camera2D {
  return {
    scale: lerp(a.scale, b.scale, t),
    pan: {
      x: lerp(a.pan.x, b.pan.x, t),
      y: lerp(a.pan.y, b.pan.y, t),
    },
  };
}

export type AnimateCameraOptions = {
  durationMs?: number;
  easing?: EasingFn;
  /** 当外部控制器需要停止动画时调用（例如用户开始拖拽）。 */
  signal?: AbortSignal;
};

/**
 * 通用相机动画：只依赖 get/set。
 *
 * 设计目标：
 * - 无框架依赖（可用于 React/非 React）
 * - 可中断（AbortSignal）
 */
export function animateCamera(opts: {
  get: () => Camera2D;
  set: (c: Camera2D) => void;
  to: Camera2D;
  options?: AnimateCameraOptions;
}): Promise<void> {
  const { get, set, to } = opts;
  const durationMs = opts.options?.durationMs ?? 220;
  const easing = opts.options?.easing ?? easeOutCubic;
  const signal = opts.options?.signal;

  const from = get();
  if (durationMs <= 0) {
    set(to);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const start = performance.now();

    const step = () => {
      if (signal?.aborted) {
        resolve();
        return;
      }

      const now = performance.now();
      const t = Math.min(1, Math.max(0, (now - start) / durationMs));
      const k = easing(t);
      set(lerpCamera(from, to, k));

      if (t >= 1) {
        resolve();
        return;
      }

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  });
}
