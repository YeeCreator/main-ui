import type { JsonObject } from '../types';
import type { InputTrigger } from '@main-ui/core/input';

/** A small, serialisable set of context values used by commands and menus. */
export type CommandContextValue = string | number | boolean | null | undefined;

export type CommandRunContext = {
  workspaceId: string;
  activeGroupId: string | null;
  payload?: JsonObject;
  /** The currently focused UI scope (for example `workbench`, `editor` or `input`). */
  scope?: string;
  /** Host-provided context keys. */
  keys?: Readonly<Record<string, CommandContextValue>>;
  /** 触发来源：仅当命令由输入系统触发时存在。 */
  trigger?: InputTrigger;
};

/** Legacy function clauses remain supported; string clauses are useful for contributions. */
export type CommandWhenClause = ((context: CommandRunContext) => boolean) | string;

export type CommandExecutionResult = {
  commandId: string;
  executed: boolean;
  durationMs: number;
  error?: string;
};

export type CommandDescriptor = {
  id: string;
  title: string;
  category?: string;
  description?: string;
  icon?: string;
  when?: CommandWhenClause;
  /** Optional explicit enablement predicate. `when` is still honoured for compatibility. */
  enablement?: (context: CommandRunContext) => boolean;
  /**
   * 是否可被连续手势（`stream` 绑定）反复调用。
   *
   * 拖拽平移、参数拖拽这类命令必须声明；未声明时对其建 `stream` 绑定会得到警告。
   */
  streamable?: boolean;
  run: (context: CommandRunContext) => void | CommandExecutionResult | Promise<void | CommandExecutionResult>;
};

export type CommandInvocation = {
  commandId: string;
  context: CommandRunContext;
  result: CommandExecutionResult;
  invokedAt: string;
};

export type KeyModifier = 'ctrl' | 'cmd' | 'alt' | 'shift' | 'meta';

export type ParsedKeybinding = {
  key: string;
  modifiers: KeyModifier[];
  /** Canonical, platform-neutral representation. */
  canonical: string;
};

export type KeybindingDescriptor = {
  commandId: string;
  keybinding: string;
  when?: CommandWhenClause;
  /** Higher weights win when a host overrides a default binding. */
  weight?: number;
  source?: string;
  allowInInput?: boolean;
};
