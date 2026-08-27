/**
 * FSM 类型定义：框架无关的有限状态机纯 TS 库。
 *
 * 移植自 finite-state-machine 项目 src/lib（备忘录 -009 D5）。
 * 与 FlowDocument 的关系：FSM 定义 → machineToFlowDocument → 流程图文档。
 */

/** FSM 状态标识。 */
export type StateId = string;

/** FSM 事件标识。 */
export type EventId = string;

/** FSM 转换守卫（纯函数，判断是否允许转换）。 */
export type TransitionGuard<TContext = unknown> = (
  context: TContext,
  event: EventId,
) => boolean;

/** FSM 转换动作（纯函数，返回新 context）。 */
export type TransitionAction<TContext = unknown> = (
  context: TContext,
  event: EventId,
) => TContext;

/** FSM 转换定义。 */
export type Transition<TContext = unknown> = {
  event: EventId;
  target: StateId;
  guard?: TransitionGuard<TContext>;
  actions?: TransitionAction<TContext>[];
};

/** FSM 状态定义。 */
export type StateDefinition<TContext = unknown> = {
  id: StateId;
  label?: string;
  /** 进入动作。 */
  onEntry?: TransitionAction<TContext>[];
  /** 退出动作。 */
  onExit?: TransitionAction<TContext>[];
  /** 该状态可触发的转换。 */
  transitions: Transition<TContext>[];
  /** 宿主业务元数据（透传）。 */
  meta?: Record<string, unknown>;
};

/** FSM 机器定义（纯数据，可序列化）。 */
export type MachineDefinition<TContext = unknown> = {
  id: string;
  label?: string;
  initial: StateId;
  states: StateDefinition<TContext>[];
  /** 初始 context。 */
  context?: TContext;
};

/** FSM 运行时快照（用于调试/序列化）。 */
export type MachineSnapshot = {
  machineId: string;
  currentState: StateId;
  context: unknown;
};
