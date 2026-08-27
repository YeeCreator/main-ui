/**
 * FSM Hub：机器定义注册表（框架无关纯 TS）。
 *
 * 管理多个 FSM 定义，供下游按 id 查找与实例化。
 */

import type { MachineDefinition } from './types';
import { createMachine, type MachineInstance } from './machine';
import { createInterpreter, type InterpreterInstance } from './interpreter';

/** FSM Hub 实例。 */
export type FsmHub = {
  /** 注册机器定义（幂等：相同 id 覆写）。 */
  register(definition: MachineDefinition): void;
  /** 查询已注册的机器定义。 */
  get(machineId: string): MachineDefinition | undefined;
  /** 列出全部已注册的机器 id。 */
  list(): string[];
  /** 实例化机器（创建运行时实例）。 */
  create(machineId: string): MachineInstance | null;
  /** 实例化并创建解释器。 */
  interpret(machineId: string): InterpreterInstance | null;
  /** 移除机器定义。 */
  unregister(machineId: string): void;
};

/** 创建 FSM Hub（纯函数工厂）。 */
export const createFsmHub = (): FsmHub => {
  const registry = new Map<string, MachineDefinition>();

  return {
    register(definition: MachineDefinition): void {
      registry.set(definition.id, definition);
    },

    get(machineId: string): MachineDefinition | undefined {
      return registry.get(machineId);
    },

    list(): string[] {
      return [...registry.keys()];
    },

    create(machineId: string): MachineInstance | null {
      const def = registry.get(machineId);
      if (!def) return null;
      return createMachine(def);
    },

    interpret(machineId: string): InterpreterInstance | null {
      const machine = this.create(machineId);
      if (!machine) return null;
      return createInterpreter(machine);
    },

    unregister(machineId: string): void {
      registry.delete(machineId);
    },
  };
};
