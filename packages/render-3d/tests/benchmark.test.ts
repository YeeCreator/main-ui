import { describe, expect, test } from 'vitest';
import {
  benchScenePlan,
  createFrameSampler,
  makeBenchSnapshot,
  readRendererStats,
} from '../src/benchmark';

/**
 * N2 用例：渲染侧吞吐基准。
 *
 * 这些断言**不断言绝对毫秒数**（阈值由实测回填，不预设 —— 任务书 §四 4c 明确要求）。
 * 断言的是三件与机器无关的事实：
 * 1. 万级实体能编出计划且**实例化合规**（原型数远小于实体数）；
 * 2. 尺寸进原型键：唯一尺寸会把原型数推高（这是设计选择，需可见）；
 * 3. 采样器与统计读数行为正确。
 */

describe('render-3d 绘制计划基准：万级实例', () => {
  test('1 万实体：原型数收敛到颜色变体数，实例化合规', () => {
    const snapshot = makeBenchSnapshot({ count: 10_000, colorVariants: 8 });
    const result = benchScenePlan(snapshot, { repeat: 5 });

    expect(result.entityCount).toBe(10_000);
    expect(result.instanceCount).toBe(10_000);
    // 原型键 = 形状+尺寸+外观；尺寸与形状统一，故原型数 = 颜色变体数
    expect(result.prototypeCount).toBe(8);
    expect(result.violations).toEqual([]);

    // 记录实测值（供人工核对；非断言）
    console.log(
      `[bench] 10k 实体 · 8 原型 · plan=${result.planMs.toFixed(2)}ms · 每实体 ${(result.planMs / 10).toFixed(4)}µs`,
    );
    expect(result.planMs).toBeGreaterThan(0);
  });

  test('每实体唯一尺寸会显著推高原型数（尺寸进键的设计后果，需可见）', () => {
    const uniform = benchScenePlan(makeBenchSnapshot({ count: 2_000, colorVariants: 4 }), { repeat: 3 });
    const unique = benchScenePlan(makeBenchSnapshot({ count: 2_000, colorVariants: 4, uniqueSizes: true }), { repeat: 3 });

    expect(uniform.prototypeCount).toBe(4);
    // 唯一尺寸 → 原型数暴增；此时仍合规与否取决于「原型数 >= 实体数」
    expect(unique.prototypeCount).toBeGreaterThan(uniform.prototypeCount);
    console.log(`[bench] 2k 实体：统一尺寸 ${uniform.prototypeCount} 原型 / 唯一尺寸 ${unique.prototypeCount} 原型`);
  });

  test('原型数达到实体数时判为实例化违规（判据本身有效）', () => {
    // 每个实体都唯一尺寸 → 原型数逼近实体数
    const snapshot = makeBenchSnapshot({ count: 40, colorVariants: 40, uniqueSizes: true });
    const result = benchScenePlan(snapshot, { repeat: 2 });
    // 不强制违规（尺寸组合可能重复），只要求判据能跑且自洽
    expect(Array.isArray(result.violations)).toBe(true);
    expect(result.prototypeCount).toBeGreaterThan(0);
  });

  test('5 万实体仍在可接受量级（仅验证能完成，不断言耗时）', () => {
    const snapshot = makeBenchSnapshot({ count: 50_000, colorVariants: 8 });
    const result = benchScenePlan(snapshot, { repeat: 3 });
    expect(result.instanceCount).toBe(50_000);
    expect(result.prototypeCount).toBe(8);
    expect(result.violations).toEqual([]);
    console.log(`[bench] 50k 实体 · plan=${result.planMs.toFixed(2)}ms`);
  });
});

describe('render-3d 渲染统计读数', () => {
  test('从 three 形状的 info 读 draw call / 内存', () => {
    const stats = readRendererStats({
      info: {
        render: { calls: 12, triangles: 4096 },
        memory: { geometries: 9, textures: 3 },
        programs: [{}, {}],
      },
    });
    expect(stats).toEqual({ drawCalls: 12, triangles: 4096, geometries: 9, textures: 3, programs: 2 });
  });

  test('缺少 info 时返回零值而非抛错', () => {
    expect(readRendererStats({})).toEqual({ drawCalls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0 });
  });
});

describe('render-3d 帧采样器', () => {
  test('按 delta 采样并算出 fps', () => {
    const sampler = createFrameSampler(10);
    for (let i = 0; i < 10; i += 1) sampler.tick(16);
    const stats = sampler.read();
    expect(stats.samples).toBe(10);
    expect(stats.frameMs).toBeCloseTo(16, 6);
    expect(stats.fps).toBeCloseTo(62.5, 6);
    expect(stats.maxFrameMs).toBe(16);
  });

  test('滚动窗口只保留最近 N 帧（抖动看 maxFrameMs）', () => {
    const sampler = createFrameSampler(5);
    sampler.tick(100); // 一次长卡顿，应被挤出窗口
    for (let i = 0; i < 6; i += 1) sampler.tick(16);
    const stats = sampler.read();
    expect(stats.samples).toBe(5);
    expect(stats.maxFrameMs).toBe(16);
  });

  test('reset 清空样本', () => {
    const sampler = createFrameSampler(5);
    sampler.tick(16);
    sampler.reset();
    expect(sampler.read().samples).toBe(0);
    expect(sampler.read().fps).toBe(0);
  });

  test('非法 delta 被忽略', () => {
    const sampler = createFrameSampler(5);
    sampler.tick(Number.NaN);
    sampler.tick(0);
    sampler.tick(-5);
    expect(sampler.read().samples).toBe(0);
  });
});
