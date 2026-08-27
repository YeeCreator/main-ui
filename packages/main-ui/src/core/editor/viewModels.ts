import type { IconToken, JsonObject } from '../types';

export type ToolbarActionTone = 'default' | 'primary' | 'success' | 'warning';

export type ToolbarActionDescriptor = {
  id: string;
  label: string;
  description?: string;
  icon?: IconToken;
  badge?: string;
  disabled?: boolean;
  tone?: ToolbarActionTone;
  payload?: JsonObject;
};

export type ToolbarGroupDescriptor = {
  id: string;
  title?: string;
  description?: string;
  actions: ToolbarActionDescriptor[];
};

export type ToolbarEditorModel = {
  title?: string;
  description?: string;
  statusText?: string;
  groups: ToolbarGroupDescriptor[];
};

export type TreeNodeDescriptor = {
  id: string;
  label: string;
  description?: string;
  icon?: IconToken;
  badge?: string;
  expanded?: boolean;
  children?: TreeNodeDescriptor[];
  meta?: JsonObject;
};

export type TreeSectionDescriptor = {
  id: string;
  title?: string;
  description?: string;
  nodes: TreeNodeDescriptor[];
};

export type TreeEditorModel = {
  title?: string;
  description?: string;
  emptyState?: string;
  sections: TreeSectionDescriptor[];
};