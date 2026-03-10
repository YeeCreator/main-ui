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
