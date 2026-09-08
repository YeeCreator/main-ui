/**
 * @main-ui/view-run-control 数据契约：宿主适配层负责把仿真/控制后端状态经 Props 注入，
 * 视图只呈现运行态与抛出操作意图（Emits），绝不发起任何请求，也不绑定任何领域语义。
 *
 * 独立性约束：全部术语为通用仿真/控制语义（status/rate/tick），不含游戏或棋类专属概念。
 */

/** 运行状态（通用仿真/控制语义）。 */
export const RUN_CONTROL_STATUSES = ['idle', 'running', 'paused'] as const;
export type RunControlStatus = (typeof RUN_CONTROL_STATUSES)[number];

/** 运行控制状态快照（宿主注入）。 */
export interface RunControlState {
  /** 当前运行状态。 */
  status: RunControlStatus;
  /** 速率（tick/s，语义由宿主定义，视图只呈现与回传数值）。 */
  rate: number;
  /** 当前帧/步计数。 */
  tick: number;
}

/**
 * 运行控制操作契约（宿主侧处理句柄的形态）。
 * 视图通过 Emits 抛出对应意图，宿主可据此构造该句柄集合。
 */
export interface RunControlEvents {
  play: () => void;
  pause: () => void;
  step: () => void;
  reset: () => void;
  rateChange: (rate: number) => void;
}

/** 各操作按钮的可用性（视图据连接态/能力计算默认值，宿主可显式覆盖）。 */
export interface RunControlAvailability {
  play: boolean;
  pause: boolean;
  step: boolean;
  reset: boolean;
  rateEditable: boolean;
}

/** 速率输入的数值边界。 */
export interface RunControlRateBounds {
  min: number;
  max: number;
  step: number;
}

/** 视图状态契约（MainUiViewLifecycle.getViewState 的产出形态；仅含本地呈现态）。 */
export type RunControlViewState = {
  /** 速率输入框的草稿文本（尚未提交的编辑态）。 */
  rateDraft: string;
};

/** 速率输入默认边界。 */
export const DEFAULT_RUN_CONTROL_RATE_BOUNDS: RunControlRateBounds = { min: 0.1, max: 1000, step: 1 };
