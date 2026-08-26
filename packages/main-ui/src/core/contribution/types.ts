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

/**
 * 插件契约预埋（v0.2 纯类型，无运行时调度）。
 *
 * 明确不实现：manifest 解析、activate/deactivate、动态加载、插件注册表。
 * 仅先固定类型形状，供未来插件系统与模板库对齐。
 */
export interface DockingViewContribution {
  /** 视图类型标识，对齐 rendererKey / Slot viewType 命名空间 */
  viewType: string;
  /** Vue Component；为避免核心对 vue 类型的强依赖用 unknown，消费侧自行收窄 */
  component: unknown;
  /** 默认标题，缺省时由宿主/模板库自行推导 */
  title?: string;
}

export interface PluginContributes {
  views?: DockingViewContribution[];
  // commands / menus / keybindings / panels 等域按 contribution registry 既有域预留，暂不实现。
  commands?: unknown[];
  menus?: unknown[];
  keybindings?: unknown[];
  panels?: unknown[];
}
