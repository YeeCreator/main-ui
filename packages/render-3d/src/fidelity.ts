/**
 * render-3d/fidelity —— 二维档保真对照的四判据与可复用对照方法。
 *
 * 设计 §十九 8 / 13 判据 7：**四项都不劣**才允许切三维后端；**任一项不达标**
 * 则该条目声明不支持三维、继续走二维后端（通道永久保留，不复制内容）。
 *
 * 本文件只定义**判据与判定逻辑**（纯函数），观测手段（截图、像素比对、命中探针）
 * 由宿主在浏览器里执行后把数值填进来。这样做的理由：把「什么算不劣」写死在代码里，
 * 避免每条目各用一套心证。
 */

/** 单项判据的实测结果。 */
export interface FidelityMeasurement {
  /** 判据名（稳定键）。 */
  key: FidelityCriterionKey;
  /** 参照值（二维 Pixi 档实测）。 */
  baseline: number;
  /** 待评值（三维后端二维档实测）。 */
  candidate: number;
  /** 越大越好（true）还是越小越好（false）。 */
  higherIsBetter: boolean;
  /** 允许的劣化比例（缺省 0 = 严格不劣）。 */
  toleranceRatio?: number;
  /** 观测方法说明（人读；写清怎么量的）。 */
  method?: string;
}

/** 四判据的稳定键。 */
export type FidelityCriterionKey =
  | 'line-width'      // 线条宽度：同缩放比下截图像素级比对（含斜视角一档）
  | 'text-clarity'    // 文字清晰度：汉字在 1× / 2× / 4× 缩放下是否发虚
  | 'piece-edge'      // 棋子边缘：单色圆盘边缘锯齿与抗锯齿表现
  | 'cell-hit-accuracy'; // 命中格准确率：网格边缘与角点的 col/row 命中一致性

/** 条款说明（与设计 §十九 8 一一对应，防止键名与语义脱钩）。 */
export const FIDELITY_CRITERIA: ReadonlyArray<{
  key: FidelityCriterionKey;
  title: string;
  method: string;
  higherIsBetter: boolean;
}> = [
  {
    key: 'line-width',
    title: '线条宽度',
    method: '同缩放比下截图像素级比对（含斜视角一档）；量同一段网格线的横截面像素宽度',
    higherIsBetter: false,
  },
  {
    key: 'text-clarity',
    title: '文字清晰度',
    method: '汉字标签在 1× / 2× / 4× 缩放下是否发虚；量字形边缘的梯度锐度或人工分级',
    higherIsBetter: true,
  },
  {
    key: 'piece-edge',
    title: '棋子边缘',
    method: '单色圆盘边缘锯齿与抗锯齿表现；量边缘像素的二值化跳变数（越少越平滑）',
    higherIsBetter: false,
  },
  {
    key: 'cell-hit-accuracy',
    title: '命中格准确率',
    method: '网格边缘与角点的 col/row 命中与二维一致（含边界抖动）；量一致命中占比 0..1',
    higherIsBetter: true,
  },
];

/** 单项判定结果。 */
export interface FidelityVerdict {
  key: FidelityCriterionKey;
  title: string;
  passed: boolean;
  /** 差幅描述（人读）。 */
  detail: string;
}

/** 条目级放行结论。 */
export interface FidelityReport {
  /** 条目名（如「飞行棋」「五子棋」）。 */
  entry: string;
  /** 是否允许切三维后端（四项全过）。 */
  allowed: boolean;
  verdicts: FidelityVerdict[];
  /** 未覆盖的判据（不得视为通过）。 */
  missing: FidelityCriterionKey[];
}

/**
 * 判定单项是否「不劣」。
 *
 * 规则：`higherIsBetter` 时要求 `candidate >= baseline * (1 - tol)`；
 * 否则要求 `candidate <= baseline * (1 + tol)`。`baseline === 0` 视为无法比较，
 * 直接判不通过并要求人工复核（避免除零掩盖问题）。
 */
export function judgeMeasurement(m: FidelityMeasurement): FidelityVerdict {
  const title = FIDELITY_CRITERIA.find((c) => c.key === m.key)?.title ?? m.key;
  const tol = m.toleranceRatio ?? 0;

  if (!Number.isFinite(m.baseline) || !Number.isFinite(m.candidate)) {
    return { key: m.key, title, passed: false, detail: '实测值非法（NaN/Infinity），须重测' };
  }
  if (m.baseline === 0) {
    return {
      key: m.key,
      title,
      passed: false,
      detail: `参照值为 0（candidate=${m.candidate}），无法按比例判定，须人工复核`,
    };
  }

  const ratio = m.candidate / m.baseline;
  const passed = m.higherIsBetter
    ? ratio >= 1 - tol
    : ratio <= 1 + tol;

  return {
    key: m.key,
    title,
    passed,
    detail: `baseline=${m.baseline} candidate=${m.candidate} ratio=${ratio.toFixed(3)}（${m.higherIsBetter ? '越大越好' : '越小越好'}，容差 ${(tol * 100).toFixed(1)}%）`,
  };
}

/**
 * 生成条目级放行结论。
 *
 * @param entry 条目名。
 * @param measurements 已测项（四项应齐全；缺项记为 `missing` 且**不允许放行**）。
 * @returns 放行报告（可直接登记进迁移清单）。
 * @example
 * ```ts
 * const report = buildFidelityReport('飞行棋', [
 *   { key: 'line-width', baseline: 2, candidate: 2, higherIsBetter: false },
 *   { key: 'text-clarity', baseline: 0.8, candidate: 0.85, higherIsBetter: true },
 *   { key: 'piece-edge', baseline: 12, candidate: 10, higherIsBetter: false },
 *   { key: 'cell-hit-accuracy', baseline: 1, candidate: 1, higherIsBetter: true },
 * ]);
 * report.allowed; // true
 * ```
 */
export function buildFidelityReport(entry: string, measurements: readonly FidelityMeasurement[]): FidelityReport {
  const verdicts = measurements.map(judgeMeasurement);
  const seen = new Set(verdicts.map((v) => v.key));
  const missing = FIDELITY_CRITERIA.map((c) => c.key).filter((key) => !seen.has(key));
  return {
    entry,
    // 四项齐全且全过才允许放行：缺项不得视为通过
    allowed: missing.length === 0 && verdicts.every((v) => v.passed),
    verdicts,
    missing,
  };
}

/** 渲染人读摘要（供迁移清单与文档直接贴）。 */
export function formatFidelityReport(report: FidelityReport): string {
  const head = `【${report.entry}】${report.allowed ? '允许切三维后端' : '不允许（继续走二维后端）'}`;
  const lines = report.verdicts.map(
    (v) => `- ${v.passed ? '✅' : '❌'} ${v.title}：${v.detail}`,
  );
  if (report.missing.length > 0) {
    lines.push(`- ⚠️ 未测项：${report.missing.join(' / ')}（缺项不得视为通过）`);
  }
  return [head, ...lines].join('\n');
}
