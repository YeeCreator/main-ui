/**
 * @main-ui/view-console 数据契约：宿主适配层负责取数/订阅日志流并转成条目经 Props 注入，
 * 视图只呈现与抛出操作意图（Emits），绝不发起网络请求。
 */

/** 日志等级（视图内置着色，未知等级归一到 info 呈现）。 */
export const CONSOLE_LEVELS = ['debug', 'info', 'warn', 'error', 'success'] as const;
export type ConsoleLevel = (typeof CONSOLE_LEVELS)[number];

/** 单条日志/控制台输出。 */
export type ConsoleEntry = {
  id: string;
  level: ConsoleLevel | string;
  message: string;
  /** 毫秒时间戳（宿主注入；缺省则不呈现时间列） */
  timestamp?: number;
};

/** 视图状态契约（MainUiViewLifecycle.getViewState 的产出形态）。 */
export type ConsoleViewState = {
  scrollTop: number;
  /** 自动跟随底部（追加时滚动到底）；用户上滑即锁滚 */
  autoScroll: boolean;
  /** 等级过滤（空数组 = 全部显示） */
  levels: ConsoleLevel[];
  /** 文本过滤（不区分大小写） */
  query: string;
};

/** 行高（等宽单行呈现，虚拟滚动定高假设）。 */
export const DEFAULT_CONSOLE_ROW_HEIGHT = 20;
