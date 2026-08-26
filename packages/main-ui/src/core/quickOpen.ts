import type { CommandDescriptor } from './command/types';
import type { EditorDescriptor } from './editor/types';
import type { WorkspaceDescriptor } from './workspace/types';

export type QuickOpenItem = {
  id: string;
  label: string;
  description?: string;
  kind: 'editor' | 'workspace' | 'command' | 'recent';
  commandId?: string;
  editorKind?: string;
  workspaceId?: string;
  score: number;
};

const score = (query: string, value: string): number => {
  const needle = query.trim().toLowerCase();
  if (!needle) return 1;
  const haystack = value.toLowerCase();
  if (haystack === needle) return 100;
  if (haystack.startsWith(needle)) return 80;
  if (haystack.includes(needle)) return 60;
  let index = 0;
  for (const char of needle) {
    index = haystack.indexOf(char, index);
    if (index < 0) return 0;
    index += 1;
  }
  return 20;
};

export const searchQuickOpen = (query: string, sources: {
  editors?: EditorDescriptor[];
  workspaces?: WorkspaceDescriptor[];
  commands?: CommandDescriptor[];
  recent?: QuickOpenItem[];
}): QuickOpenItem[] => {
  const items: QuickOpenItem[] = [
    ...(sources.editors ?? []).map((editor) => ({ id: `editor:${editor.kind}`, label: editor.title, description: editor.description, kind: 'editor' as const, editorKind: editor.kind, score: score(query, `${editor.title} ${editor.kind}`) })),
    ...(sources.workspaces ?? []).map((workspace) => ({ id: `workspace:${workspace.id}`, label: workspace.title, description: workspace.description, kind: 'workspace' as const, workspaceId: workspace.id, score: score(query, `${workspace.title} ${workspace.id}`) })),
    ...(sources.commands ?? []).map((command) => ({ id: `command:${command.id}`, label: command.title, description: command.category, kind: 'command' as const, commandId: command.id, score: score(query, `${command.title} ${command.id}`) })),
    ...(sources.recent ?? []).map((item) => ({ ...item, kind: 'recent' as const, score: Math.max(item.score, score(query, item.label)) })),
  ];
  return items.filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
};
