import type { CommandWhenClause } from '../command/types';

export type ContributionContext = { workspaceId: string; keys?: Record<string, string | number | boolean | null> };
export type ViewLocation = 'primary-sidebar' | 'secondary-sidebar' | 'bottom-panel';

export type ViewContribution = {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  location?: ViewLocation;
  rendererKey?: string;
  providerKey?: string;
  when?: CommandWhenClause;
  defaultVisible?: boolean;
  order?: number;
  minSize?: number;
};

export type PanelContribution = Omit<ViewContribution, 'location'> & { location?: 'bottom-panel'; closable?: boolean };
export type ActivityContribution = { id: string; title: string; icon?: string; viewId?: string; order?: number; when?: CommandWhenClause };
export type StatusContribution = { id: string; text: string; tooltip?: string; commandId?: string; order?: number; when?: CommandWhenClause };
