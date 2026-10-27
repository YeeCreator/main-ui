/**
 * render-3d/benchmark —— 渲染吞吐的观测工具（通用，不含宿主语义）。
 *
 * 设计 §十九 13 判据 8：万级实例基准中，**渲染吞吐**与**物理宽相**必须分开测。
 * 本文件只覆盖渲染侧，且只做「采样与读数」，不做判定 —— 阈值由实测回填，不预设。
 *
 * 观测项对齐 TresJS devtools 的思路（FPS / 内存 / draw call），但不引入该库：
 * 它是 Vue custom renderer，与本项目的「外部快照 → 命令式更新实例属性」模型相反
 * （MUI 总设计 §十九 4 已有此判据）。
 */

import type { EntitySnapshot } from '@main-ui/core/primitives';
import { buildScenePlan, findInstancingViolations, type ScenePlan } from './primitive-plan';

/** 从渲染器读到的统计量（three 无关的最小结构）。 */
export interface RendererStats {
  /** 本帧 draw call 数。 */
  drawCalls: number;
  /** 本帧三角面数。 */
  triangles: number;
  /** 已分配几何数。 */
  geometries: number;
  /** 已分配纹理数。 */
  textures: number;
  /** 已编译程序数。 */
  programs: number;
}

/** 采样器读数。 */
export interface FrameStats extends RendererStats {
  /** 平均帧时间（毫秒）。 */
  frameMs: number;
  /** 平均帧率。 */
  fps: number;
  /** 采到的帧数。 */
  samples: number;
  /** 采样窗口内的最大帧时间（毫秒），用来看抖动而非均值。 */
  maxFrameMs: number;
}

/** 帧采样器。 */
export interface FrameSampler {
  /**
   * 记录一帧的**耗时**（毫秒）。
   *
   * 只接受 delta 而非时间戳：双模式（时间戳或 delta）会让首帧语义含混
   * （无法区分「第一次调用」与「距上一帧 0 毫秒」），这类含糊在基准里会直接污染读数。
   * 调用方用 `performance.now()` 自行差分即可。
   */
  tick(deltaMs: number): void;
  /** 读取当前统计（滚动窗口）。 */
  read(stats?: RendererStats): FrameStats;
  /** 清空样本。 */
  reset(): void;
  /** 采样窗口大小。 */
  readonly windowSize: number;
}

/**
 * 创建帧采样器。
 *
 * 用**滚动窗口**而非累计平均：长跑基准里前几帧的编译抖动会把均值抹平，
 * 而抖动恰恰是"掉帧"的真实体感来源，故另给 `maxFrameMs`。
 *
 * @param windowSize 保留的样本数（缺省 120，约 2 秒 @60fps）。
 * @returns 采样器。
 * @example
 * ```ts
 * const sampler = createFrameSampler();
 * let last = performance.now();
 * const loop = () => {
 *   const t = performance.now();
 *   sampler.tick(t - last);
 *   last = t;
 *   requestAnimationFrame(loop);
 * };
 * ```
 */
export function createFrameSampler(windowSize = 120): FrameSampler {
  let samples: number[] = [];

  return {
    windowSize,
    tick(deltaMs: number) {
      if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
      samples.push(deltaMs);
      // 滚动窗口：只保留最近 windowSize 帧
      if (samples.length > windowSize) samples = samples.slice(-windowSize);
    },
    read(stats?: RendererStats): FrameStats {
      const empty: RendererStats = { drawCalls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0 };
      const merged = { ...empty, ...(stats ?? {}) };
      if (samples.length === 0) {
        return { ...merged, frameMs: 0, fps: 0, samples: 0, maxFrameMs: 0 };
      }
      const total = samples.reduce((sum, v) => sum + v, 0);
      const frameMs = total / samples.length;
      return {
        ...merged,
        frameMs,
        fps: frameMs > 0 ? 1000 / frameMs : 0,
        samples: samples.length,
        maxFrameMs: Math.max(...samples),
      };
    },
    reset() {
      samples = [];
    },
  };
}

/**
 * 从 three 渲染器读统计量。
 *
 * 参数类型收窄为结构类型（而不是 `WebGPURenderer`）：本文件因此**不 import three**，
 * 可在 Node 里单测，也让调用方不必为读一个计数而引入渲染库类型。
 *
 * @param renderer 具备 `info.render` / `info.memory` 的对象。
 * @returns 统计量。
 */
export function readRendererStats(renderer: {
  info?: {
    render?: { calls?: number; triangles?: number };
    memory?: { geometries?: number; textures?: number };
    programs?: unknown[] | null;
  };
}): RendererStats {
  const info = renderer.info;
  return {
    drawCalls: info?.render?.calls ?? 0,
    triangles: info?.render?.triangles ?? 0,
    geometries: info?.memory?.geometries ?? 0,
    textures: info?.memory?.textures ?? 0,
    programs: Array.isArray(info?.programs) ? info.programs.length : 0,
  };
}

/** 绘制计划构建基准的读数。 */
export interface ScenePlanBenchResult {
  /** 快照里的实体总数。 */
  entityCount: number;
  /** 原型几何数（实例化判据的分子）。 */
  prototypeCount: number;
  /** 实例总数。 */
  instanceCount: number;
  /** 独立几何数（多边形/折线，无法共享原型）。 */
  uniqueGeometryCount: number;
  /** 文字数。 */
  textCount: number;
  /** 构建耗时（毫秒，取多次中位数）。 */
  planMs: number;
  /** 实例化违规描述；空数组 = 合规。 */
  violations: string[];
}

/**
 * 测量「快照 → 绘制计划」的构建成本与实例化合规性。
 *
 * 之所以把这一步单独测：它是**每次 `applySnapshot` 都要跑**的纯 CPU 路径，
 * 与 GPU 帧时间无关。把两者混在一起测，会把归因搞错（任务书 §四 4c 的明确要求）。
 *
 * @param snapshot 目标快照。
 * @param options 重复次数（取中位数，缺省 7 次）。
 * @returns 读数。
 * @example
 * ```ts
 * const result = benchScenePlan(bigSnapshot, { repeat: 9 });
 * console.log(result.planMs, result.prototypeCount, result.instanceCount);
 * ```
 */
export function benchScenePlan(
  snapshot: EntitySnapshot,
  options: { repeat?: number; grid?: Parameters<typeof buildScenePlan>[0]['grid'] } = {},
): ScenePlanBenchResult {
  const repeat = Math.max(1, options.repeat ?? 7);
  const timings: number[] = [];
  let plan: ScenePlan | null = null;

  for (let i = 0; i < repeat; i += 1) {
    const start = now();
    plan = buildScenePlan({ snapshot, grid: options.grid ?? null });
    timings.push(now() - start);
  }

  const built = plan as ScenePlan;
  timings.sort((a, b) => a - b);
  const median = timings[Math.floor(timings.length / 2)];

  let entityCount = 0;
  for (const batch of Object.values(snapshot.batches)) entityCount += batch.count;

  return {
    entityCount,
    prototypeCount: built.prototypeCount,
    instanceCount: built.instanceCount,
    uniqueGeometryCount: built.unique.length,
    textCount: built.texts.length,
    planMs: median,
    violations: findInstancingViolations(built),
  };
}

/** 高精度时钟（Node 与浏览器通用）。 */
function now(): number {
  const perf = (globalThis as { performance?: { now(): number } }).performance;
  return perf ? perf.now() : Date.now();
}

/**
 * 生成用于基准的合成快照（**通用**：不绑定任何业务语义）。
 *
 * 用途：万级实例基准需要一个可重复的数据源。这里只造图元层面的分布，
 * 不假设实体代表什么。
 *
 * @param options 数量与分布参数。
 * @returns 快照。
 */
export function makeBenchSnapshot(options: {
  count: number;
  /** 世界范围（缺省 1000×1000）。 */
  width?: number;
  height?: number;
  /** 每多少个实体换一种颜色（缺省 8 → 少量原型）。 */
  colorVariants?: number;
  /** 是否给每实体不同尺寸（true 会显著增加原型数，用于对照）。 */
  uniqueSizes?: boolean;
}): EntitySnapshot {
  const width = options.width ?? 1000;
  const height = options.height ?? 1000;
  const variants = Math.max(1, options.colorVariants ?? 8);
  const count = Math.max(0, options.count);

  const xs: number[] = [];
  const ys: number[] = [];
  const colors: number[] = [];
  const widths: number[] = [];
  const heights: number[] = [];
  const zs: number[] = [];
  const extrudes: number[] = [];

  // 确定性伪随机（避免每次基准数据不同，便于对比）
  let seed = 20261027;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i += 1) {
    xs.push(rand() * width);
    ys.push(rand() * height);
    colors.push(0x334455 + (i % variants) * 0x111111);
    widths.push(options.uniqueSizes ? 4 + (i % 97) : 8);
    heights.push(options.uniqueSizes ? 4 + (i % 89) : 8);
    zs.push(0);
    extrudes.push(0);
  }

  return {
    bounds: { x: 0, y: 0, width, height },
    batches: {
      entities: {
        kind: 'entities',
        count,
        geometry: 'point',
        columns: { x: xs, y: ys, z: zs, extrude: extrudes, width: widths, height: heights, color: colors },
      },
    },
  };
}
