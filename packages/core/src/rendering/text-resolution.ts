/**
 * rendering/text-resolution —— 文字纹理的**缩放档位**（纯函数，可单测）。
 *
 * ## 为什么需要档位
 *
 * GPU 视口缩放的本质是 `world.scale.set(k)` —— 对**已光栅化**内容整体放大，
 * 不重绘。文字是先渲染成位图再放大的，所以放大即糊。
 *
 * 修法不是「无限分辨率」（显存会爆），而是**按档位重建**：
 * 相机跨过一个档位才重画文字纹理，档位内继续用 GPU 放大。
 *
 * 这一做法是业界共识而非本库发明：公开的节点图编辑器普遍用
 * `scale = 2^(level/2)` 这类**离散档**处理公式节点的缩放。
 *
 * ## 为什么需要滞回
 *
 * 档位边界上相机会来回抖动（滚轮微调、平移换算误差），若不带滞回，
 * 会在边界反复重建纹理，表现为卡顿 + 闪烁。
 *
 * 滞回做法：升档用 `×2` 的**上界**判定，降档用 `×1.6` 的**下界**判定，
 * 两者之间保持当前档（公式见 {@link nextTextResolution}）。
 */

/**
 * 档位阶梯（相对 DPR 的倍数）。
 *
 * 间距取 2 的幂：与设备像素比的常见倍数对齐，避免出现 1.5× 这类
 * 需要额外重采样的中间档。
 */
export const TEXT_RESOLUTION_LADDER: readonly number[] = [1, 2, 4, 8, 16];

/** 升档阈值：当前档 × 该系数 > 目标时升档。 */
export const TEXT_RESOLUTION_UP_FACTOR = 2;

/** 降档阈值：当前档 × 该系数 < 目标时降档（比升档更保守，构成滞回）。 */
export const TEXT_RESOLUTION_DOWN_FACTOR = 1.6;

/**
 * 求「刚好覆盖目标」的档位下标。
 *
 * @param target 目标倍数（已含 DPR 与相机缩放）。
 * @returns 阶梯下标。
 */
function ladderIndexFor(target: number): number {
  const safe = Number.isFinite(target) && target > 0 ? target : 1;
  for (let i = 0; i < TEXT_RESOLUTION_LADDER.length; i += 1) {
    if (safe <= TEXT_RESOLUTION_LADDER[i]) return i;
  }
  return TEXT_RESOLUTION_LADDER.length - 1;
}

/**
 * 由相机缩放与设备像素比求**目标**倍数。
 *
 * @param scale 相机缩放。
 * @param devicePixelRatio 设备像素比（缺省 1）。
 * @returns 目标倍数（≥1）。
 * @example
 * textResolutionTarget(1, 2)   // 2
 * textResolutionTarget(3, 2)   // 6
 * textResolutionTarget(0.5, 2) // 2（小于 1 不降分辨率，避免文字先糊）
 */
export function textResolutionTarget(scale: number, devicePixelRatio = 1): number {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  // 缩小相机时不降低文字分辨率：文字在缩小态已经看得清，
  // 降档只会让「缩回去再放大」那一下更糊。
  return Math.max(1, s) * dpr;
}

/**
 * 求当前缩放应使用的纹理档位（无滞回版本，供首帧与显式重设使用）。
 *
 * @param scale 相机缩放。
 * @param devicePixelRatio 设备像素比。
 * @returns 档位倍数（取自 {@link TEXT_RESOLUTION_LADDER}）。
 * @example
 * textResolutionFor(1, 1)  // 1
 * textResolutionFor(2, 2)  // 4
 * textResolutionFor(100, 1) // 16（封顶）
 */
export function textResolutionFor(scale: number, devicePixelRatio = 1): number {
  return TEXT_RESOLUTION_LADDER[ladderIndexFor(textResolutionTarget(scale, devicePixelRatio))];
}

/**
 * 带**滞回**的档位迁移：给定当前档位与新缩放，返回应使用的档位。
 *
 * 只有满足下列之一才换档，否则保持当前档：
 *
 * - 目标 > 当前 × {@link TEXT_RESOLUTION_UP_FACTOR} → 升到刚好覆盖的档；
 * - 目标 < 当前 × {@link TEXT_RESOLUTION_DOWN_FACTOR} → 降到刚好覆盖的档。
 *
 * 这两个阈值不相等，构成滞回带，避免边界抖动导致反复重建。
 *
 * @param current 当前档位（应为阶梯上的值；非法值按 1 处理）。
 * @param scale 相机缩放。
 * @param devicePixelRatio 设备像素比。
 * @returns 新的档位倍数。
 * @example
 * // 当前 2 档，目标 2.4：未超过 2×2=4，也未低于 2×1.6=3.2 → 保持 2
 * nextTextResolution(2, 1.2, 2)  // 2
 * // 目标 6 > 4 → 升档
 * nextTextResolution(2, 3, 2)    // 8
 */
export function nextTextResolution(current: number, scale: number, devicePixelRatio = 1): number {
  const currentValid = TEXT_RESOLUTION_LADDER.includes(current) ? current : 1;
  const target = textResolutionTarget(scale, devicePixelRatio);
  const ideal = TEXT_RESOLUTION_LADDER[ladderIndexFor(target)];

  // **方向必须由 desired 与 current 的关系决定**，不能只看阈值 ——
  // 否则目标落在「略高于当前档」时会误走降档分支，反而把档位升上去。
  if (ideal > currentValid) {
    // 升档：目标必须真的够高才换，避免边界抖动
    return target >= currentValid * TEXT_RESOLUTION_UP_FACTOR ? ideal : currentValid;
  }
  if (ideal < currentValid) {
    // 降档：目标必须明显偏低才换（阈值比升档保守，构成滞回带）
    return target * TEXT_RESOLUTION_DOWN_FACTOR <= currentValid ? ideal : currentValid;
  }
  return currentValid;
}
