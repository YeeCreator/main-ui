import { describe, expect, test } from 'vitest';
import {
  FIDELITY_CRITERIA,
  buildFidelityReport,
  formatFidelityReport,
  judgeMeasurement,
  type FidelityMeasurement,
} from '../src/fidelity';

/**
 * WP6 用例：二维档保真对照的四判据判定逻辑。
 *
 * 钉死三件容易出错的事：
 * 1. 「越大越好」与「越小越好」的方向不能写反（历史上长度比判据写反过）；
 * 2. 参照值为 0 时**不得**静默放行（除零会掩盖问题）；
 * 3. **缺项不得视为通过**（四项齐全才允许放行）。
 */

const passAll: FidelityMeasurement[] = [
  { key: 'line-width', baseline: 2, candidate: 2, higherIsBetter: false },
  { key: 'text-clarity', baseline: 0.8, candidate: 0.85, higherIsBetter: true },
  { key: 'piece-edge', baseline: 12, candidate: 10, higherIsBetter: false },
  { key: 'cell-hit-accuracy', baseline: 1, candidate: 1, higherIsBetter: true },
];

describe('render-3d 保真对照四判据', () => {
  test('四项判据定义齐全且与设计一致', () => {
    expect(FIDELITY_CRITERIA.map((c) => c.key)).toEqual([
      'line-width',
      'text-clarity',
      'piece-edge',
      'cell-hit-accuracy',
    ]);
    // 方向：线条宽度/边缘锯齿越小越好；文字清晰度/命中率越大越好
    const dir = Object.fromEntries(FIDELITY_CRITERIA.map((c) => [c.key, c.higherIsBetter]));
    expect(dir['line-width']).toBe(false);
    expect(dir['text-clarity']).toBe(true);
    expect(dir['piece-edge']).toBe(false);
    expect(dir['cell-hit-accuracy']).toBe(true);
  });

  test('四项全不劣 → 允许放行', () => {
    const report = buildFidelityReport('飞行棋', passAll);
    expect(report.allowed).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.verdicts.every((v) => v.passed)).toBe(true);
  });

  test('min 类判据劣化即不通过', () => {
    const verdict = judgeMeasurement({ key: 'line-width', baseline: 2, candidate: 3, higherIsBetter: false });
    expect(verdict.passed).toBe(false);
  });

  test('max 类判据劣化即不通过', () => {
    const verdict = judgeMeasurement({ key: 'cell-hit-accuracy', baseline: 0.99, candidate: 0.95, higherIsBetter: true });
    expect(verdict.passed).toBe(false);
  });

  test('容差比例生效（允许小幅劣化）', () => {
    const strict = judgeMeasurement({ key: 'piece-edge', baseline: 100, candidate: 105, higherIsBetter: false });
    expect(strict.passed).toBe(false);
    const lenient = judgeMeasurement({ key: 'piece-edge', baseline: 100, candidate: 105, higherIsBetter: false, toleranceRatio: 0.1 });
    expect(lenient.passed).toBe(true);
  });

  test('任一项不达标 → 整条不放行', () => {
    const report = buildFidelityReport('五子棋', [
      ...passAll.filter((m) => m.key !== 'text-clarity'),
      { key: 'text-clarity', baseline: 0.9, candidate: 0.7, higherIsBetter: true },
    ]);
    expect(report.allowed).toBe(false);
  });

  test('缺项不得视为通过', () => {
    const report = buildFidelityReport('跳棋', passAll.filter((m) => m.key !== 'cell-hit-accuracy'));
    expect(report.allowed).toBe(false);
    expect(report.missing).toEqual(['cell-hit-accuracy']);
    expect(formatFidelityReport(report)).toContain('未测项');
  });

  test('参照值为 0 时判不通过并要求人工复核', () => {
    const verdict = judgeMeasurement({ key: 'piece-edge', baseline: 0, candidate: 0, higherIsBetter: false });
    expect(verdict.passed).toBe(false);
    expect(verdict.detail).toContain('参照值为 0');
  });

  test('NaN 实测值判不通过', () => {
    const verdict = judgeMeasurement({ key: 'line-width', baseline: 2, candidate: Number.NaN, higherIsBetter: false });
    expect(verdict.passed).toBe(false);
  });

  test('人读摘要含结论与逐项结果', () => {
    const text = formatFidelityReport(buildFidelityReport('飞行棋', passAll));
    expect(text).toContain('飞行棋');
    expect(text).toContain('允许切三维后端');
    expect(text.split('\n').length).toBeGreaterThanOrEqual(5);
  });
});
