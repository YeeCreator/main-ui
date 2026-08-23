import type { EditorRenderContext } from '../core/editor/types';

export type EditorMountAdapter = {
  mount: (container: HTMLElement, context: EditorRenderContext) => void | (() => void);
  update?: (container: HTMLElement, context: EditorRenderContext) => void;
  unmount?: (container: HTMLElement) => void;
  timeoutMs?: number;
};

export type ContributionProvider<TContext = unknown> = {
  mount: (container: HTMLElement, context: TContext) => void | (() => void);
  update?: (container: HTMLElement, context: TContext) => void;
  unmount?: (container: HTMLElement) => void;
  timeoutMs?: number;
};

export type IconResolver = (icon: string | undefined) => string | undefined;

export type KeyboardShortcutAdapter = {
  bind: (commandId: string, shortcut: string) => void;
  unbind: (commandId: string) => void;
};
