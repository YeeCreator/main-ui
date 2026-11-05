import { describe, expect, test } from 'vitest';
import { shouldRenderSidePanel } from '../src/ViewportCanvasShell';

/**
 * 侧面板「占位还是收起」的裁决（**回归锁**）。
 *
 * ## 守的是两个真实事故
 *
 * ### 事故一：中间转发层让收起彻底失效（2026-11-05）
 *
 * 某宿主在 `ViewportCanvasShell` 之上又包了一层壳，并**无条件**转发：
 *
 * ```html
 * <template #left><slot name="left" /></template>
 * ```
 *
 * 转发生成的插槽函数**恒存在**，于是 `Boolean(slots.left)` 恒为真，
 * `collapseEmptySidePanels` 无论真假都不收起 —— 表现为主区左右各留一个
 * 只剩内距与边框的空壳（实测 21px = 0 宽内容 + 10px×2 内距 + 1px 边框）。
 *
 * 该宿主的修法是把转发写成 `<template v-if="$slots.left" #left>`。
 * **本函数无法识破转发层的假阳性** —— 它能做的只是把「给了判据之后怎么裁决」钉死，
 * 使排错时能明确区分「判定错了」与「判据本身是假的」。
 *
 * ### 事故二：以为「传 0 宽就能隐藏」
 *
 * 宽度与是否占位是**两个正交维度**：`leftPanelWidth=0` 只把内容压成 0 宽，
 * 面板自身的内距与边框照旧占位。隐藏必须由本函数裁决，不能靠传 0。
 */

describe('shouldRenderSidePanel', () => {
  test('有插槽 → 占位（与是否收起无关）', () => {
    expect(shouldRenderSidePanel(true, true)).toBe(true);
    expect(shouldRenderSidePanel(true, false)).toBe(true);
  });

  test('无插槽 + 收起空面板 → 不占位（正是被转发层破坏的那一档）', () => {
    expect(shouldRenderSidePanel(false, true)).toBe(false);
  });

  test('无插槽 + 明确要求保留空面板 → 占位（宿主预留布局位时用）', () => {
    expect(shouldRenderSidePanel(false, false)).toBe(true);
  });

  test('判据只有两个输入，两者互不覆盖', () => {
    // 穷举四个组合，确认语义是「或」而不是任一输入单独决定
    const table = [
      { hasSlot: true, collapse: true, expected: true },
      { hasSlot: true, collapse: false, expected: true },
      { hasSlot: false, collapse: true, expected: false },
      { hasSlot: false, collapse: false, expected: true },
    ];
    for (const row of table) {
      expect(
        shouldRenderSidePanel(row.hasSlot, row.collapse),
        `hasSlot=${row.hasSlot} collapse=${row.collapse}`,
      ).toBe(row.expected);
    }
  });
});
