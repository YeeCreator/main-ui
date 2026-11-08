/**
 * input/fly-keys —— 飞行模式的键位映射（纯函数，零 DOM）。
 *
 * ## 为什么键位要单独定义
 *
 * 键位是**约定**，不是实现细节。散在组件里会导致：
 * - 想换键位要改多个文件；
 * - 无法单测「按住 W 时 forward 是否为 +1」；
 * - 与其他宿主的键位冲突无从发现。
 *
 * ## 键位取自 UE（业界最通用的飞行键位）
 *
 * | 键 | 作用 | UE 对应 |
 * | --- | --- | --- |
 * | `W` / `S` | 沿视线前进 / 后退 | Move Forward / Backward（Dolly） |
 * | `A` / `D` | 左右横移 | Strafe |
 * | `Q` / `E` | 上升 / 下降 | Move Up / Down（Pedestal） |
 * | `Shift` | 加速（×4） | — |
 * | `Alt` | 减速（×0.25，便于微调） | — |
 *
 * `Q`/`E` 而非 `R`/`F`：`F` 已被「聚焦」占用，且 UE 用的就是 `Q`/`E`。
 */

import type { FlyInput } from '../rendering/free-camera';

/** 飞行模式的按键状态（由组件维护，逐帧交给 `flyInputFromKeys`）。 */
export type FlyKeyState = Set<string>;

/**
 * 一个按键是否为「飞行方向键」。
 *
 * 用于判断「是否应当进入飞行移动状态」——只有按着方向键时才需要跑动画循环，
 * 否则每帧空转浪费电。
 *
 * @param key `KeyboardEvent.key`。
 * @returns 是否为方向键。
 */
export function isFlyMovementKey(key: string): boolean {
  const k = key.toLowerCase();
  return k === 'w' || k === 'a' || k === 's' || k === 'd' || k === 'q' || k === 'e';
}

/**
 * 一个按键是否为「飞行修饰键」（加速 / 减速）。
 *
 * @param key `KeyboardEvent.key`。
 * @returns 是否为修饰键。
 */
export function isFlyModifierKey(key: string): boolean {
  return key === 'Shift' || key === 'Alt';
}

/**
 * 由当前按住的键算出本帧的飞行输入。
 *
 * 只返回「方向分量 + 速度倍率」，不碰相机 —— 这样单测无需构造相机对象，
 * 且能断言「同时按 W 和 S 是否互相抵消」这类边界。
 *
 * @param keys 当前按住的键集合（`KeyboardEvent.key`，大小写不敏感）。
 * @returns 方向分量（−1 / 0 / +1）与速度倍率。
 * @example
 * ```ts
 * flyInputFromKeys(new Set(['w']));                  // { forward: 1, speedScale: 1 }
 * flyInputFromKeys(new Set(['w', 'Shift']));         // { forward: 1, speedScale: 4 }
 * flyInputFromKeys(new Set(['w', 's']));             // { forward: 0, speedScale: 1 }
 * ```
 */
export function flyInputFromKeys(keys: FlyKeyState): {
  forward: number;
  strafe: number;
  elevate: number;
  speedScale: number;
} {
  const has = (k: string): boolean => {
    for (const raw of keys) {
      if (raw.toLowerCase() === k) return true;
    }
    return false;
  };

  /**
   * 相反方向同时按住时**互相抵消为 0**，而不是让后按的那个胜出。
   * 后者在快速换向（松 W 前先按 S）时会产生一次意外猛冲。
   */
  const axis = (pos: string, neg: string): number => {
    const p = has(pos) ? 1 : 0;
    const n = has(neg) ? 1 : 0;
    return p - n;
  };

  const speedScale = has('shift') ? 4 : keys.has('Alt') || keys.has('alt') ? 0.25 : 1;

  return {
    forward: axis('w', 's'),
    strafe: axis('d', 'a'),
    elevate: axis('q', 'e'),
    speedScale,
  };
}

/**
 * 把键位状态转成 `FlyInput`（补上速度倍率）。
 *
 * 与 `flyInputFromKeys` 分开是因为**速度倍率的应用方式与相机有关**
 * （乘在 `speed` 上，而不是乘在位移上），由调用方决定更清楚。
 *
 * @param keys 当前按住的键集合。
 * @returns `FlyInput` 与建议的速度倍率。
 */
export function flyInputFromKeysToInput(keys: FlyKeyState): {
  input: FlyInput;
  speedScale: number;
} {
  const { forward, strafe, elevate, speedScale } = flyInputFromKeys(keys);
  return { input: { forward, strafe, elevate }, speedScale };
}
