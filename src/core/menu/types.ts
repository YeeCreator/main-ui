import type { CommandRunContext, CommandWhenClause } from '../command/types';

export type MenuLocation = 'menubar' | 'editor/title' | 'editor/tab' | 'workspace' | 'view' | 'panel' | 'context';

export type MenuContribution = {
  id: string;
  location: MenuLocation;
  label: string;
  commandId?: string;
  submenu?: string;
  group?: string;
  order?: number;
  when?: CommandWhenClause;
  separator?: boolean;
  icon?: string;
};

export type MenuRenderItem = MenuContribution & {
  enabled: boolean;
  children?: MenuRenderItem[];
};

export const evaluateMenuWhen = (when: CommandWhenClause | undefined, context: CommandRunContext): boolean => {
  if (!when) return true;
  if (typeof when === 'function') return Boolean(when(context));
  return when.split(/\s*(?:&&|and)\s*/i).every((part) => {
    const clause = part.trim();
    const negated = clause.startsWith('!');
    const [key, expected] = clause.replace(/^!/, '').split(/\s*(?:==|=)\s*/);
    const value = context.keys?.[key];
    const matches = expected === undefined ? Boolean(value) : String(value) === expected.replace(/^['"]|['"]$/g, '');
    return negated ? !matches : matches;
  });
};
