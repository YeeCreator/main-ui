/**
 * core/rendering/text-resolution —— 文字纹理的缩放档位与滞回。
 *
 * 守护目标：
 * 1. 档位只取阶梯值（避免 1.5× 这类需重采样的中间档）；
 * 2. **滞回带存在**（升档阈值 ≠ 降档阈值），否则边界会反复重建纹理；
 * 3. 缩小相机时不降档（避免「缩回去再放大」更糊）。
 */
import { describe, expect, test } from 'vitest';
import {
  TEXT_RESOLUTION_DOWN_FACTOR,
  TEXT_RESOLUTION_LADDER,
  TEXT_RESOLUTION_UP_FACTOR,
  nextTextResolution,
  textResolutionFor,
  textResolutionTarget,
} from '../src/rendering/text-resolution';

describe('textResolutionTarget', () => {
  test('等于缩放 × DPR', () => {
    expect(textResolutionTarget(1, 2)).toBe(2);
    expect(textResolutionTarget(3, 2)).toBe(6);
  });

  test('缩放小于 1 时取 1（不降分辨率）', () => {
    expect(textResolutionTarget(0.5, 1)).toBe(1);
    expect(textResolutionTarget(0.1, 2)).toBe(2);
  });

  test('非法输入回退安全值', () => {
    expect(textResolutionTarget(Number.NaN, 1)).toBe(1);
    expect(textResolutionTarget(1, Number.NaN)).toBe(1);
    expect(textResolutionTarget(0, 0)).toBe(1);
  });
});

describe('textResolutionFor · 无滞回档位', () => {
  test('取刚好覆盖目标的阶梯值', () => {
    expect(textResolutionFor(1, 1)).toBe(1);
    expect(textResolutionFor(2, 1)).toBe(2);
    expect(textResolutionFor(1.5, 1)).toBe(2);
    expect(textResolutionFor(2, 2)).toBe(4);
  });

  test('封顶到阶梯最大值（显存保护）', () => {
    expect(textResolutionFor(100, 1)).toBe(TEXT_RESOLUTION_LADDER.at(-1));
    expect(textResolutionFor(1000, 4)).toBe(TEXT_RESOLUTION_LADDER.at(-1));
  });

  test('结果必在阶梯上', () => {
    for (const scale of [0.25, 0.5, 1, 1.5, 2, 3, 5, 9, 20]) {
      expect(TEXT_RESOLUTION_LADDER).toContain(textResolutionFor(scale, 2));
    }
  });
});

describe('nextTextResolution · 滞回', () => {
  test('滞回带内保持当前档（不抖动）', () => {
    // 当前 2 档：目标 > 4 才升、< 3.2 才降
    // DPR=1 时缩放即目标，便于精确落点
    expect(nextTextResolution(2, 1.5, 1)).toBe(2); // 目标 1.5，带内
    expect(nextTextResolution(2, 3, 1)).toBe(2);   // 目标 3（<2×2=4），带内
    expect(nextTextResolution(2, 3.2, 1)).toBe(2); // 目标 3.2，边界上仍保持
  });

  test('明显放大时升档', () => {
    // 当前 2 档，目标 > 4 才升
    expect(nextTextResolution(2, 4.1, 1)).toBe(8);
  });

  test('明显缩小时降档', () => {
    // 当前 8 档，目标 < 8×1.6=12.8 时降；DPR=1、scale=0.5 → 目标 1
    expect(nextTextResolution(8, 0.5, 1)).toBe(1);
  });

  test('滞回带确实存在：升档阈值不等于降档阈值', () => {
    expect(TEXT_RESOLUTION_UP_FACTOR).not.toBe(TEXT_RESOLUTION_DOWN_FACTOR);
    expect(TEXT_RESOLUTION_UP_FACTOR).toBeGreaterThan(TEXT_RESOLUTION_DOWN_FACTOR);
  });

  test('非法当前档按 1 处理（不产生阶梯外值）', () => {
    expect(TEXT_RESOLUTION_LADDER).toContain(nextTextResolution(3, 1, 1));
  });

  test('反复在边界附近微调不会连续换档（模拟滚轮抖动）', () => {
    let tier = 2;
    const history: number[] = [];
    for (const scale of [1.2, 1.3, 1.2, 1.35, 1.25, 1.3]) {
      tier = nextTextResolution(tier, scale, 2);
      history.push(tier);
    }
    // 全程应保持在同一档
    expect(new Set(history).size).toBe(1);
  });
});
