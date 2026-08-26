import type { CommandRunContext } from '../command/types';
import type { MenuContribution, MenuLocation, MenuRenderItem } from './types';
import { evaluateMenuWhen } from './types';

export class MenuRegistry {
  private readonly contributions = new Map<string, MenuContribution>();

  register(contribution: MenuContribution): void {
    this.contributions.set(contribution.id, { ...contribution });
  }

  unregister(id: string): void {
    this.contributions.delete(id);
  }

  get(id: string): MenuContribution | undefined {
    return this.contributions.get(id);
  }

  list(location?: MenuLocation): MenuContribution[] {
    return [...this.contributions.values()]
      .filter((item) => !location || item.location === location)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.group ?? '').localeCompare(b.group ?? '') || a.label.localeCompare(b.label));
  }

  build(location: MenuLocation, context: CommandRunContext, isCommandEnabled: (commandId: string) => boolean): MenuRenderItem[] {
    const roots = this.list(location).filter((item) => evaluateMenuWhen(item.when, context));
    const submenus = new Map(this.list().filter((item) => item.submenu && item.location === 'menubar').map((item) => [item.id, item]));
    return roots.map((item) => ({
      ...item,
      enabled: item.separator ? false : !item.commandId || isCommandEnabled(item.commandId),
      children: item.submenu ? this.list().filter((child) => child.submenu === item.submenu && evaluateMenuWhen(child.when, context)).map((child) => ({
        ...child,
        enabled: child.separator ? false : !child.commandId || isCommandEnabled(child.commandId),
      })) : undefined,
    })).filter((item) => !item.submenu || submenus.has(item.submenu) || item.children?.length);
  }

  clear(): void {
    this.contributions.clear();
  }
}
