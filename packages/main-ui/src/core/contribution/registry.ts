import type { ContributionContext } from './types';
import type { ActivityContribution, PanelContribution, StatusContribution, ViewContribution } from './types';
import { evaluateWhen } from '../command/keybindings';

export class ContributionRegistry {
  private readonly views = new Map<string, ViewContribution>();
  private readonly panels = new Map<string, PanelContribution>();
  private readonly activities = new Map<string, ActivityContribution>();
  private readonly statuses = new Map<string, StatusContribution>();
  registerView(view: ViewContribution): void { this.views.set(view.id, { location: 'primary-sidebar', ...view }); }
  registerPanel(panel: PanelContribution): void { this.panels.set(panel.id, { location: 'bottom-panel', ...panel }); }
  registerActivity(item: ActivityContribution): void { this.activities.set(item.id, { ...item }); }
  registerStatus(item: StatusContribution): void { this.statuses.set(item.id, { ...item }); }
  unregister(id: string): void { this.views.delete(id); this.panels.delete(id); this.activities.delete(id); this.statuses.delete(id); }
  listViews(context?: ContributionContext): ViewContribution[] { return this.visible([...this.views.values()], context); }
  listPanels(context?: ContributionContext): PanelContribution[] { return this.visible([...this.panels.values()], context); }
  listActivities(context?: ContributionContext): ActivityContribution[] { return this.visible([...this.activities.values()], context); }
  listStatuses(context?: ContributionContext): StatusContribution[] { return this.visible([...this.statuses.values()], context); }
  clear(): void { this.views.clear(); this.panels.clear(); this.activities.clear(); this.statuses.clear(); }
  private visible<T extends { when?: ViewContribution['when']; order?: number }>(items: T[], context?: ContributionContext): T[] { return items.filter((item) => !context || evaluateWhen(item.when, { workspaceId: context.workspaceId, activeGroupId: null, keys: context.keys })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); }
}
