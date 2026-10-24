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
  terminal: '❯',
  preview: '◉',
  // 领域图标（宿主常直接用语义名，如 workspace.icon = 'math'）。
  // 缺映射时会退化成渲染原始英文串，在 rail 里读作「math / folder / chart」，
  // 与中文标题并列时非常突兀。故此处补齐常用语义名。
  math: '∑',
  folder: '▤',
  chart: '◫',
  grid: '▦',
  file: '▤',
  search: '⌕',
  home: '⌂',
  layers: '▥',
};

export const resolveIconToken = (icon: string | undefined, fallback = ''): string => {
  if (!icon) {
    return fallback;
  }
  return iconMap[icon] ?? icon;
};

export const renderIconToken = (icon: string | undefined, fallback = ''): VNode => h('span', { class: 'main-ui-token-icon' }, resolveIconToken(icon, fallback));
