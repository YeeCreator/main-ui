/**
 * 尺寸令牌集合。
 */
export type SpaceTokens = {
  /** 极小间距。 */
  xxs: number;
  /** 很小间距。 */
  xs: number;
  /** 小间距。 */
  sm: number;
  /** 中间距。 */
  md: number;
  /** 大间距。 */
  lg: number;
  /** 超大间距。 */
  xl: number;
};

/**
 * 圆角令牌集合。
 */
export type RadiusTokens = {
  /** 小圆角。 */
  sm: number;
  /** 中圆角。 */
  md: number;
  /** 大圆角。 */
  lg: number;
  /** 胶囊圆角。 */
  pill: number;
};

/**
 * 阴影令牌集合。
 */
export type ShadowTokens = {
  /** 轻量阴影。 */
  sm: string;
  /** 常规阴影。 */
  md: string;
  /** 强阴影。 */
  lg: string;
};

/**
 * 层级令牌集合。
 */
export type ZIndexTokens = {
  /** 基础层。 */
  base: number;
  /** 浮层。 */
  floating: number;
  /** 弹层。 */
  overlay: number;
  /** 模态层。 */
  modal: number;
};

/**
 * 颜色令牌集合。
 */
export type ColorTokens = {
  /** 页面背景色。 */
  bgCanvas: string;
  /** 面板背景色。 */
  bgPanel: string;
  /** 细分隔线颜色。 */
  borderSubtle: string;
  /** 常规文本色。 */
  textPrimary: string;
  /** 次要文本色。 */
  textSecondary: string;
  /** 危险态文本色。 */
  textDanger: string;
};

/**
 * 主界面布局风格预设。
 */
export type LayoutPreset = 'default' | 'vscodium' | 'konva';

/**
 * 实际生效主题类型。
 */
export type ResolvedTheme = 'light' | 'dark';

/**
 * 主界面壳层视觉样式集合。
 */
export type LayoutPresetStyles = {
  /** 应用外层背景色。 */
  appBackground: string;
  /** Activity Rail 背景色。 */
  activityRailBackground: string;
  /** Activity Rail 图标文本色。 */
  activityRailText: string;
  /** 工具条背景色。 */
  toolbarBackground: string;
  /** 侧栏背景色。 */
  sidebarBackground: string;
  /** 视口宿主背景色。 */
  viewportBackground: string;
  /** 状态栏背景色。 */
  statusbarBackground: string;
  /** 状态栏文本色。 */
  statusbarText: string;
  /** 主分隔线颜色。 */
  borderColor: string;
  /** 面板块背景色。 */
  panelBackground: string;
  /** 分组块背景色。 */
  sectionBackground: string;
  /** 主要文本色。 */
  textPrimary: string;
  /** 次要文本色。 */
  textSecondary: string;
  /** 控件背景色。 */
  controlBackground: string;
  /** 控件边框色。 */
  controlBorder: string;
  /** 控件文本色。 */
  controlText: string;
  /** 控件选中背景色。 */
  controlSelectedBackground: string;
  /** 控件选中边框色。 */
  controlSelectedBorder: string;
  /** 焦点高亮色。 */
  accentColor: string;
};

/**
 * 设计令牌总集合。
 */
export type DesignTokens = {
  /** 间距令牌。 */
  space: SpaceTokens;
  /** 圆角令牌。 */
  radius: RadiusTokens;
  /** 阴影令牌。 */
  shadow: ShadowTokens;
  /** 层级令牌。 */
  zIndex: ZIndexTokens;
  /** 颜色令牌。 */
  color: ColorTokens;
};

/**
 * 默认设计令牌。
 *
 * 该对象保持与当前内联样式数值基本一致，确保迁移阶段视觉稳定。
 */
export const defaultTokens: DesignTokens = {
  space: {
    xxs: 4,
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 10,
    pill: 999,
  },
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.08)',
    md: '0 3px 10px rgba(0,0,0,0.10)',
    lg: '0 8px 20px rgba(0,0,0,0.14)',
  },
  zIndex: {
    base: 0,
    floating: 10,
    overlay: 100,
    modal: 1000,
  },
  color: {
    bgCanvas: '#ffffff',
    bgPanel: 'rgba(255,255,255,0.92)',
    borderSubtle: 'rgba(0,0,0,0.12)',
    textPrimary: '#111111',
    textSecondary: '#666666',
    textDanger: '#cc0000',
  },
};

/**
 * 基于默认令牌与局部覆写生成完整令牌。
 *
 * Args:
 *   overrides: 可选的局部令牌覆写。
 *
 * Returns:
 *   返回结构完整的设计令牌对象。
 */
export function createTokens(overrides?: Partial<DesignTokens>): DesignTokens {
  if (!overrides) {
    return defaultTokens;
  }

  return {
    space: { ...defaultTokens.space, ...overrides.space },
    radius: { ...defaultTokens.radius, ...overrides.radius },
    shadow: { ...defaultTokens.shadow, ...overrides.shadow },
    zIndex: { ...defaultTokens.zIndex, ...overrides.zIndex },
    color: { ...defaultTokens.color, ...overrides.color },
  };
}

/**
 * 预设布局视觉映射表。
 */
const layoutPresetStylesMap: Record<LayoutPreset, Record<ResolvedTheme, LayoutPresetStyles>> = {
  default: {
    light: {
    appBackground: '#f6f7f9',
    activityRailBackground: '#eef1f4',
    activityRailText: '#1f2328',
    toolbarBackground: 'rgba(255,255,255,0.85)',
    sidebarBackground: 'rgba(255,255,255,0.92)',
    viewportBackground: '#ffffff',
    statusbarBackground: '#eef1f4',
    statusbarText: '#1f2328',
    borderColor: 'rgba(0,0,0,0.10)',
    panelBackground: '#ffffff',
    sectionBackground: '#ffffff',
    textPrimary: '#111111',
    textSecondary: '#666666',
    controlBackground: '#ffffff',
    controlBorder: 'rgba(0,0,0,0.20)',
    controlText: '#111111',
    controlSelectedBackground: 'rgba(0,0,0,0.05)',
    controlSelectedBorder: 'rgba(0,0,0,0.60)',
    accentColor: '#0f6cbd',
    },
    dark: {
      appBackground: '#1f232a',
      activityRailBackground: '#181b20',
      activityRailText: '#d6dbe1',
      toolbarBackground: '#242932',
      sidebarBackground: '#20252d',
      viewportBackground: '#0f1318',
      statusbarBackground: '#283142',
      statusbarText: '#f3f6fa',
      borderColor: '#343b45',
      panelBackground: '#242932',
      sectionBackground: '#20252d',
      textPrimary: '#e6ebf0',
      textSecondary: '#a7b0bb',
      controlBackground: '#2c323c',
      controlBorder: '#414956',
      controlText: '#f6f8fa',
      controlSelectedBackground: 'rgba(56, 139, 253, 0.22)',
      controlSelectedBorder: '#388bfd',
      accentColor: '#58a6ff',
    },
  },
  vscodium: {
    light: {
      appBackground: '#f3f3f3',
      activityRailBackground: '#2c2c2c',
      activityRailText: '#f3f3f3',
      toolbarBackground: '#f3f3f3',
      sidebarBackground: '#f3f3f3',
      viewportBackground: '#ffffff',
      statusbarBackground: '#005fb8',
      statusbarText: '#ffffff',
      borderColor: '#d4d4d4',
      panelBackground: '#ffffff',
      sectionBackground: '#f7f7f7',
      textPrimary: '#1f1f1f',
      textSecondary: '#5a5a5a',
      controlBackground: '#ffffff',
      controlBorder: '#c8c8c8',
      controlText: '#1f1f1f',
      controlSelectedBackground: 'rgba(0, 95, 184, 0.12)',
      controlSelectedBorder: '#005fb8',
      accentColor: '#005fb8',
    },
    dark: {
    appBackground: '#1e1e1e',
    activityRailBackground: '#181818',
    activityRailText: '#cccccc',
    toolbarBackground: '#181818',
    sidebarBackground: '#252526',
    viewportBackground: '#1e1e1e',
    statusbarBackground: '#007acc',
    statusbarText: '#ffffff',
    borderColor: '#313131',
    panelBackground: '#2a2d2e',
    sectionBackground: '#252526',
    textPrimary: '#cccccc',
    textSecondary: '#9da2a6',
    controlBackground: '#313131',
    controlBorder: '#3c3c3c',
    controlText: '#f3f3f3',
    controlSelectedBackground: 'rgba(14,99,156,0.30)',
    controlSelectedBorder: '#0e639c',
    accentColor: '#3794ff',
    },
  },
  konva: {
    light: {
    appBackground: '#f3efe6',
    activityRailBackground: '#ece2cf',
    activityRailText: '#352a1d',
    toolbarBackground: 'linear-gradient(180deg, #fbf6ea 0%, #efe4cf 100%)',
    sidebarBackground: '#f7f1e2',
    viewportBackground: '#fffdf8',
    statusbarBackground: '#3a2f23',
    statusbarText: '#f8eddc',
    borderColor: 'rgba(91,72,47,0.22)',
    panelBackground: '#fffaf0',
    sectionBackground: '#fff7e7',
    textPrimary: '#352a1d',
    textSecondary: '#6b5c4b',
    controlBackground: '#fffaf0',
    controlBorder: 'rgba(91,72,47,0.24)',
    controlText: '#352a1d',
    controlSelectedBackground: 'rgba(191,126,54,0.16)',
    controlSelectedBorder: '#bf7e36',
    accentColor: '#bf7e36',
    },
    dark: {
      appBackground: '#201812',
      activityRailBackground: '#19120d',
      activityRailText: '#ead8bb',
      toolbarBackground: 'linear-gradient(180deg, #302117 0%, #20160f 100%)',
      sidebarBackground: '#241a13',
      viewportBackground: '#18110d',
      statusbarBackground: '#8f5a20',
      statusbarText: '#fff7eb',
      borderColor: 'rgba(234,216,187,0.16)',
      panelBackground: '#2a1f17',
      sectionBackground: '#241a13',
      textPrimary: '#f2e4cc',
      textSecondary: '#c8b28f',
      controlBackground: '#34271e',
      controlBorder: 'rgba(234,216,187,0.20)',
      controlText: '#fff1dc',
      controlSelectedBackground: 'rgba(191,126,54,0.24)',
      controlSelectedBorder: '#d7974d',
      accentColor: '#d7974d',
    },
  },
};

/**
 * 预设字段名集合。
 */
const LAYOUT_STYLE_FIELDS: Array<keyof LayoutPresetStyles> = [
  'appBackground',
  'activityRailBackground',
  'activityRailText',
  'toolbarBackground',
  'sidebarBackground',
  'viewportBackground',
  'statusbarBackground',
  'statusbarText',
  'borderColor',
  'panelBackground',
  'sectionBackground',
  'textPrimary',
  'textSecondary',
  'controlBackground',
  'controlBorder',
  'controlText',
  'controlSelectedBackground',
  'controlSelectedBorder',
  'accentColor',
];

/**
 * 预设默认主题映射。
 */
const presetDefaultThemeMap: Record<LayoutPreset, ResolvedTheme> = {
  default: 'light',
  vscodium: 'dark',
  konva: 'light',
};

/**
 * 生成某个预设字段的 CSS 变量名。
 *
 * @param preset 预设名称。
 * @param field 字段名。
 * @returns CSS 变量名。
 */
function getPresetCssVarName(preset: LayoutPreset, field: keyof LayoutPresetStyles): string {
  return `--main-ui-react-${preset}-${field}`;
}

/**
 * 兼容旧实现：当没有 ThemeProvider 时使用预设默认主题。
 *
 * @param preset 预设名称。
 * @returns 默认主题。
 */
export function getDefaultResolvedThemeForPreset(preset: LayoutPreset = 'default'): ResolvedTheme {
  return presetDefaultThemeMap[preset];
}

/**
 * 将当前主题下各预设样式写入 CSS 变量。
 *
 * @param theme 当前实际主题。
 * @param targetStyle 目标 style 对象，默认 document.documentElement.style。
 */
export function applyLayoutPresetThemeVariables(theme: ResolvedTheme, targetStyle?: CSSStyleDeclaration): void {
  const styleObject = targetStyle ?? (typeof document !== 'undefined' ? document.documentElement.style : undefined);
  if (!styleObject) {
    return;
  }

  (['default', 'vscodium', 'konva'] as LayoutPreset[]).forEach((preset) => {
    const presetStyles = layoutPresetStylesMap[preset][theme];
    LAYOUT_STYLE_FIELDS.forEach((field) => {
      styleObject.setProperty(getPresetCssVarName(preset, field), presetStyles[field]);
    });
  });
}

/**
 * 获取主界面布局预设对应的视觉样式。
 *
 * @param preset 预设名称。
 * @returns 对应的样式令牌。
 */
export function getLayoutPresetStyles(preset: LayoutPreset = 'default', theme?: ResolvedTheme): LayoutPresetStyles {
  if (theme) {
    return layoutPresetStylesMap[preset][theme];
  }

  const fallbackTheme = getDefaultResolvedThemeForPreset(preset);
  const fallbackStyles = layoutPresetStylesMap[preset][fallbackTheme];

  return {
    appBackground: `var(${getPresetCssVarName(preset, 'appBackground')}, ${fallbackStyles.appBackground})`,
    activityRailBackground: `var(${getPresetCssVarName(preset, 'activityRailBackground')}, ${fallbackStyles.activityRailBackground})`,
    activityRailText: `var(${getPresetCssVarName(preset, 'activityRailText')}, ${fallbackStyles.activityRailText})`,
    toolbarBackground: `var(${getPresetCssVarName(preset, 'toolbarBackground')}, ${fallbackStyles.toolbarBackground})`,
    sidebarBackground: `var(${getPresetCssVarName(preset, 'sidebarBackground')}, ${fallbackStyles.sidebarBackground})`,
    viewportBackground: `var(${getPresetCssVarName(preset, 'viewportBackground')}, ${fallbackStyles.viewportBackground})`,
    statusbarBackground: `var(${getPresetCssVarName(preset, 'statusbarBackground')}, ${fallbackStyles.statusbarBackground})`,
    statusbarText: `var(${getPresetCssVarName(preset, 'statusbarText')}, ${fallbackStyles.statusbarText})`,
    borderColor: `var(${getPresetCssVarName(preset, 'borderColor')}, ${fallbackStyles.borderColor})`,
    panelBackground: `var(${getPresetCssVarName(preset, 'panelBackground')}, ${fallbackStyles.panelBackground})`,
    sectionBackground: `var(${getPresetCssVarName(preset, 'sectionBackground')}, ${fallbackStyles.sectionBackground})`,
    textPrimary: `var(${getPresetCssVarName(preset, 'textPrimary')}, ${fallbackStyles.textPrimary})`,
    textSecondary: `var(${getPresetCssVarName(preset, 'textSecondary')}, ${fallbackStyles.textSecondary})`,
    controlBackground: `var(${getPresetCssVarName(preset, 'controlBackground')}, ${fallbackStyles.controlBackground})`,
    controlBorder: `var(${getPresetCssVarName(preset, 'controlBorder')}, ${fallbackStyles.controlBorder})`,
    controlText: `var(${getPresetCssVarName(preset, 'controlText')}, ${fallbackStyles.controlText})`,
    controlSelectedBackground: `var(${getPresetCssVarName(preset, 'controlSelectedBackground')}, ${fallbackStyles.controlSelectedBackground})`,
    controlSelectedBorder: `var(${getPresetCssVarName(preset, 'controlSelectedBorder')}, ${fallbackStyles.controlSelectedBorder})`,
    accentColor: `var(${getPresetCssVarName(preset, 'accentColor')}, ${fallbackStyles.accentColor})`,
  };
}
