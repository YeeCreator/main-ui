import {
  RUN_CONTROL_STATUSES,
  type RunControlAvailability,
  type RunControlStatus,
} from './types';

/** 运行状态归一（纯函数，可单测）：未知状态一律按 idle 呈现。 */
export const normalizeRunControlStatus = (status: string): RunControlStatus =>
  (RUN_CONTROL_STATUSES as readonly string[]).includes(status) ? (status as RunControlStatus) : 'idle';

/** 速率钳制（纯函数，可单测）：非有限值回退到 min，其余钳制到 [min, max]。 */
export const clampRate = (rate: number, min: number, max: number): number => {
  if (!Number.isFinite(rate)) return min;
  return Math.min(max, Math.max(min, rate));
};

/** 速率输入解析（纯函数，可单测）：非法输入回退到 fallback，再钳制到边界。 */
export const parseRate = (input: string, fallback: number, min: number, max: number): number => {
  const parsed = Number.parseFloat(input);
  if (!Number.isFinite(parsed)) return clampRate(fallback, min, max);
  return clampRate(parsed, min, max);
};

/**
 * 计算各操作按钮的默认可用性（纯函数，可单测）。
 *
 * 采用「按连接态放行」的宽松默认（与常见仿真宿主一致）：play/pause/step 仅受连接态约束，
 * reset 额外受宿主能力 `canReset` 约束；rateEditable 受连接态与 `rateEditable` 约束。
 * 宿主如需按 status 精细禁用（如运行中禁用 play），可显式传入 `availability` prop 覆盖。
 */
export const computeRunControlAvailability = (
  options: { connected?: boolean; canReset?: boolean; rateEditable?: boolean } = {},
): RunControlAvailability => {
  const connected = options.connected ?? true;
  const canReset = options.canReset ?? true;
  const rateEditable = options.rateEditable ?? true;
  return {
    play: connected,
    pause: connected,
    step: connected,
    reset: connected && canReset,
    rateEditable: connected && rateEditable,
  };
};
