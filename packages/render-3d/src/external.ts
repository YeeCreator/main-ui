/**
 * render-3d/external —— 外接两档契约（设计 §十九 10）。
 *
 * ## 档位判据（不看引擎名字，只看一件事）
 *
 * **能不能被喂帧** —— 该引擎的 JS/TS 运行时能否被 import 进来、
 * 由我们每帧调它的场景接口。
 *
 * | 档 | 数据流 | 典型对象 |
 * | --- | --- | --- |
 * | **纯渲染外接** | 每帧喂 `EntitySnapshot` | 自研 JS 引擎 · Babylon（可选适配器） |
 * | **全引擎外接** | 消息桥，非喂帧 | Cocos Creator · LayaAir · Godot · 虚幻（评估档） |
 *
 * ## 本文件的限度（「先实现、先不用」）
 *
 * 只定义**契约**与一个**最小验证宿主**（`runExternalContractSmoke`），不做多引擎适配。
 * 理由（设计原文）：无消费者的通道必腐烂，但也不该提前建。
 *
 * ## 三字段纪律（每个清单项必须带）
 *
 * 1. `granularity` —— 接入粒度（视图级转播 / 条目级整包）
 * 2. `snapshotFlow` —— 数据能否流入我们的快照
 * 3. `cost` —— 构建与运行成本
 *
 * 缺字段的清单不是决策工具，是愿望列表。
 */

import type { EntitySnapshot } from '@main-ui/core/primitives';

/** 外接档位。 */
export type ExternalTier =
  /** 纯渲染：每帧喂快照，我们持主循环。 */
  | 'pure-render'
  /** 全引擎：引擎持主循环与场景所有权，我们只传消息。 */
  | 'full-engine';

/** 接入粒度。 */
export type ExternalGranularity =
  /** 视图级转播：嵌在某个视图槽位里。 */
  | 'view-relay'
  /** 条目级整包：整个条目都由外部引擎负责。 */
  | 'entry-whole';

/**
 * 全引擎外接的最小桥（复用既有 `view-host-engine` 的 `ExternalEngineApi` 语义）。
 *
 * 注意：**没有 `feedFrame`** —— 这正是"全引擎"档的定义特征。
 */
export interface ExternalEngineBridge {
  /** 装配到容器。 */
  mount(container: HTMLElement, options: { width: number; height: number }): Promise<void> | void;
  /** 尺寸变化（引擎自行处理 resize 后重绘 —— 见 HOST_ADAPTER_GUIDE 的既有约定）。 */
  onResize(width: number, height: number): void;
  /** 向引擎投递消息（全引擎档的唯一数据通道）。 */
  postMessage(message: { type: string; payload?: unknown }): void;
  /** 幂等销毁。 */
  destroy(): void;
}

/**
 * 纯渲染外接的最小契约：能被我们每帧喂快照。
 *
 * 与 `ViewportBackend` 的关系：本契约是**更薄的子集** —— 只要求"吃快照 + 画一帧"，
 * 不要求相机读写与命中反算（那些是内置后端才需要的能力）。
 */
export interface PureRenderBridge {
  /** 装配到容器。 */
  mount(container: HTMLElement, options: { width: number; height: number }): Promise<void> | void;
  /** 喂一帧快照（由我们的主循环驱动）。 */
  feedFrame(snapshot: EntitySnapshot): void;
  /** 尺寸变化。 */
  onResize(width: number, height: number): void;
  /** 幂等销毁。 */
  destroy(): void;
}

/** 外接清单项（三字段齐全才算决策工具）。 */
export interface ExternalEngineEntry {
  /** 引擎名（清单展示用）。 */
  name: string;
  /** 档位。 */
  tier: ExternalTier;
  /** ① 接入粒度。 */
  granularity: ExternalGranularity;
  /** ② 数据能否流入我们的快照。 */
  snapshotFlow: 'full' | 'partial' | 'none';
  /** ③ 构建与运行成本（人读，写清关键约束）。 */
  cost: string;
  /** 备注（为何归此档 / 观察结论）。 */
  note?: string;
}

/**
 * 校验清单项三字段是否齐全（缺字段就不是决策工具）。
 *
 * @param entries 待校验清单。
 * @returns 问题描述数组；空数组 = 合格。
 * @example
 * ```ts
 * validateExternalRegistry([{ name: 'X', tier: 'pure-render', granularity: 'view-relay', snapshotFlow: 'full', cost: '~200KB' }]);
 * // []
 * ```
 */
export function validateExternalRegistry(entries: readonly ExternalEngineEntry[]): string[] {
  const issues: string[] = [];
  for (const entry of entries) {
    if (!entry.name?.trim()) issues.push('存在无名条目');
    if (!entry.granularity) issues.push(`${entry.name}：缺「接入粒度」`);
    if (!entry.snapshotFlow) issues.push(`${entry.name}：缺「数据能否流入快照」`);
    if (!entry.cost?.trim()) issues.push(`${entry.name}：缺「构建与运行成本」`);
    if (entry.tier === 'pure-render' && entry.snapshotFlow === 'none') {
      issues.push(`${entry.name}：纯渲染档却声明快照不可流入，自相矛盾`);
    }
    if (entry.tier === 'full-engine' && entry.granularity === 'view-relay' && entry.snapshotFlow === 'full') {
      // 允许，但要显式说明 —— 全引擎档拿到完整快照意味着它得自己解释快照语义
      issues.push(`${entry.name}：全引擎档声明「视图级转播 + 完整快照」，须在 note 说明由谁解释快照`);
    }
  }
  return issues;
}

/** 一个最小验证宿主需要跑通的四步。 */
export interface ContractSmokeResult {
  mounted: boolean;
  /** 喂帧 / 投消息是否成功。 */
  fed: boolean;
  resized: boolean;
  destroyed: boolean;
  /** 各步耗时（毫秒）。 */
  timings: { mountMs: number; feedMs: number; resizeMs: number; destroyMs: number };
  /** 失败原因（成功时为 null）。 */
  error: string | null;
}

/**
 * 跑通外接契约的四步生命周期（**最小验证宿主**）。
 *
 * 只验契约，不验渲染效果：证明"这个桥能被装配、被喂、被 resize、被销毁"。
 * 这是"先实现先不用"的限度 —— 有真实消费者时再补适配实现。
 *
 * @param bridge 任一档的桥。
 * @param options 容器与快照来源。
 * @returns 四步结果。
 * @example
 * ```ts
 * const result = await runExternalContractSmoke(myBridge, {
 *   container: document.body,
 *   snapshot: mySnapshot,
 * });
 * result.error; // null 表示四步全通
 * ```
 */
export async function runExternalContractSmoke(
  bridge: PureRenderBridge | ExternalEngineBridge,
  options: {
    container: HTMLElement;
    /** 纯渲染档必需；全引擎档可省略。 */
    snapshot?: EntitySnapshot | null;
    width?: number;
    height?: number;
  },
): Promise<ContractSmokeResult> {
  const width = options.width ?? 320;
  const height = options.height ?? 200;
  const timings = { mountMs: 0, feedMs: 0, resizeMs: 0, destroyMs: 0 };
  const result: ContractSmokeResult = {
    mounted: false, fed: false, resized: false, destroyed: false, timings, error: null,
  };

  const mark = (key: keyof typeof timings, start: number): void => {
    timings[key] = Math.round((nowMs() - start) * 100) / 100;
  };

  try {
    let t = nowMs();
    await bridge.mount(options.container, { width, height });
    mark('mountMs', t);
    result.mounted = true;

    t = nowMs();
    if (isPureRender(bridge)) {
      if (options.snapshot) bridge.feedFrame(options.snapshot);
      else throw new Error('纯渲染档必须提供 snapshot');
    } else {
      bridge.postMessage({ type: 'smoke' });
    }
    mark('feedMs', t);
    result.fed = true;

    t = nowMs();
    bridge.onResize(width + 16, height + 16);
    mark('resizeMs', t);
    result.resized = true;

    t = nowMs();
    bridge.destroy();
    mark('destroyMs', t);
    result.destroyed = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/** 档位判定：有 `feedFrame` 即纯渲染档（不看名字，只看能力）。 */
export function isPureRender(
  bridge: PureRenderBridge | ExternalEngineBridge,
): bridge is PureRenderBridge {
  return typeof (bridge as PureRenderBridge).feedFrame === 'function';
}

/** 按能力推断档位（判据落地为代码，避免靠人记）。 */
export function detectTier(bridge: PureRenderBridge | ExternalEngineBridge): ExternalTier {
  return isPureRender(bridge) ? 'pure-render' : 'full-engine';
}

function nowMs(): number {
  const perf = (globalThis as { performance?: { now(): number } }).performance;
  return perf ? perf.now() : Date.now();
}
