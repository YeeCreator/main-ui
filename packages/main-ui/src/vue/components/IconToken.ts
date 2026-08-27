import { h, type VNode } from 'vue';

const iconMap: Record<string, string> = {
  database: '▦',
  table: '▤',
  detail: '◫',
  graph: '◇',
  branch: '⑂',
  'git-branch': '⑂',
  tree: '☷',
  tex: 'TₑX',
  settings: '⚙',
  reset: '↻',
  refresh: '↺',
  close: '×',
  splitLeft: '◧',
  splitRight: '◨',
  splitUp: '▤',
  splitDown: '▥',
  maximize: '□',
  restore: '↙',
  popout: '⇱',
  dock: '⇲',
  plus: '+',
  tab: '▣',
  sun: '☼',
  moon: '☾',
  system: '◐',
  warning: '⚠',
};

export const resolveIconToken = (icon: string | undefined, fallback = ''): string => {
  if (!icon) {
    return fallback;
  }
  return iconMap[icon] ?? icon;
};

export const renderIconToken = (icon: string | undefined, fallback = ''): VNode => h('span', { class: 'main-ui-token-icon' }, resolveIconToken(icon, fallback));
