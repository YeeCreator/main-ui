import type { JsonObject } from '../types';

export type CommandWhenClause = (context: CommandRunContext) => boolean;

export type CommandRunContext = {
  workspaceId: string;
  activeGroupId: string | null;
  payload?: JsonObject;
};

export type CommandDescriptor = {
  id: string;
  title: string;
  category?: string;
  icon?: string;
  when?: CommandWhenClause;
  run: (context: CommandRunContext) => void | Promise<void>;
};
