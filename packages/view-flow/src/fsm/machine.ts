/**
 * FSM 机器：创建并管理有限状态机实例（框架无关纯 TS）。
 */

import type {
  EventId,
  MachineDefinition,
  MachineSnapshot,
  StateDefinition,
  StateId,
} from './types';

/** FSM 实例（运行时状态机）。 */
export type MachineInstance<TContext = unknown> = {
  readonly definition: MachineDefinition<TContext>;
  readonly currentState: StateId;
  readonly context: TContext;
  /** 尝试触发事件；返回新实例（不可变）或 null（转换不允许）。 */
  send(event: EventId): MachineInstance<TContext> | null;
  /** 当前状态的定义（便捷访问）。 */
  getCurrentStateDef(): StateDefinition<TContext> | undefined;
  /** 快照序列化。 */
  snapshot(): MachineSnapshot;
};

/**
 * 创建 FSM 实例（纯函数工厂）。
 *
 * 不可变设计：每次 `send` 返回新实例，原实例不变。
 */
export const createMachine = <TContext = unknown>(
  definition: MachineDefinition<TContext>,
  currentState?: StateId,
  context?: TContext,
): MachineInstance<TContext> => {
  const state = currentState ?? definition.initial;
  const ctx = context ?? (definition.context as TContext);

  const getCurrentStateDef = (): StateDefinition<TContext> | undefined =>
    definition.states.find((s) => s.id === state);

  const instance: MachineInstance<TContext> = {
    definition,
    currentState: state,
    context: ctx,

    send(event: EventId): MachineInstance<TContext> | null {
      const stateDef = getCurrentStateDef();
      if (!stateDef) return null;

      const transition = stateDef.transitions.find((t) => t.event === event);
      if (!transition) return null;

      // 守卫检查
      if (transition.guard && !transition.guard(ctx, event)) return null;

      // 执行退出动作
      let newCtx = ctx;
      for (const action of stateDef.onExit ?? []) {
        newCtx = action(newCtx, event);
      }

      // 执行转换动作
      for (const action of transition.actions ?? []) {
        newCtx = action(newCtx, event);
      }

      // 进入目标状态
      const targetDef = definition.states.find((s) => s.id === transition.target);
      for (const action of targetDef?.onEntry ?? []) {
        newCtx = action(newCtx, event);
      }

      return createMachine(definition, transition.target, newCtx);
    },

    getCurrentStateDef,

    snapshot(): MachineSnapshot {
      return {
        machineId: definition.id,
        currentState: state,
        context: ctx,
      };
    },
  };

  return instance;
};
