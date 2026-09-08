/**
 * @main-ui/view-timeline 数据契约：宿主适配层负责把帧序列经 Props 注入，
 * 视图只呈现时间轴与抛出定位意图（Emits），绝不发起任何请求，也不绑定任何领域语义。
 *
 * 独立性约束：全部术语为通用时间轴语义（tick/time/frame/index），不含游戏或棋类专属概念。
 */

/** 单个时间轴帧。 */
export interface TimelineFrame {
  /** 帧对应的步/帧计数。 */
  tick: number;
  /** 帧对应的时间（单位由宿主定义，视图仅格式化呈现）。 */
  time: number;
  /** 可选帧标签（呈现于滑块下方）。 */
  label?: string;
}

/** 时间轴状态快照（宿主注入）。 */
export interface TimelineState {
  /** 帧序列（按时间递增）。 */
  frames: TimelineFrame[];
  /** 当前定位帧索引；null = 实时（跟随最新帧）。 */
  currentIndex: number | null;
  /** 时间轴覆盖的总 tick 数（呈现用）。 */
  totalTicks: number;
}

/**
 * 时间轴定位操作契约（宿主侧处理句柄的形态）。
 * 视图通过 Emits 抛出对应意图（seek 提交定位、scrub 拖拽中定位）。
 */
export interface TimelineEvents {
  seek: (index: number) => void;
  scrub: (index: number) => void;
}

/** 视图状态契约（MainUiViewLifecycle.getViewState 的产出形态；仅含本地呈现态）。 */
export type TimelineViewState = {
  /** 本地定位帧索引；null = 实时。 */
  currentIndex: number | null;
};
