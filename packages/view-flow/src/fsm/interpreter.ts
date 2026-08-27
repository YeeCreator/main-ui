/**
 * FSM 解释器：驱动状态机运行并收集转换日志（框架无关纯 TS）。
 */

import type { MachineInstance } from './machine';
import type { EventId, MachineSnapshot } from './types';

/** 转换日志条目。 */
export type TransitionLog = {
  from: string;
  to: string;
  event: EventId;
  timestamp: number;
};

/** FSM 解释器实例。 */
export type InterpreterInstance<TContext = unknown> = {
  readonly machine: MachineInstance<TContext>;
  readonly history: readonly TransitionLog[];
  /** 发送事件并记录转换；转换失败时返回 null。 */
  send(event: EventId): InterpreterInstance<TContext> | null;
  /** 快照（含历史）。 */
  snapshot(): MachineSnapshot & { history: TransitionLog[] };
};

/**
 * 创建 FSM 解释器（纯函数工厂）。
 *
 * 在机器实例之上叠加转换历史记录。
 */
export const createInterpreter = <TContext = unknown>(
  machine: MachineInstance<TContext>,
  history: TransitionLog[] = [],
): InterpreterInstance<TContext> => {
  const interpreter: InterpreterInstance<TContext> = {
    machine,
    history,

    send(event: EventId): InterpreterInstance<TContext> | null {
      const from = machine.currentState;
      const nextMachine = machine.send(event);
      if (!nextMachine) return null;
      const log: TransitionLog = {
        from,
        to: nextMachine.currentState,
        event,
        timestamp: Date.now(),
      };
      return createInterpreter(nextMachine, [...history, log]);
    },

    snapshot() {
      return { ...machine.snapshot(), history: [...history] };
    },
  };

  return interpreter;
};
