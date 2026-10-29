/**
 * settings/appearance —— 内置「外观」区块的**可见性判定**（纯函数，可单测）。
 *
 * 设置页有两层内容：**外观**（MUI 内置，主题模式）与**业务设置**（宿主经
 * schema 注册）。外观区块要参与同一个搜索框与分类筛选，否则「搜『主题』
 * 什么都搜不到」会被当成 bug。
 *
 * 判定抽成纯函数而非写在渲染闭包里，理由与本库其它判定一致：
 * 渲染层不可单测（本包测试是纯 node 环境），判定必须可机械验证。
 */

/** 外观区块在分类下拉中的名称（与业务分类并列展示）。 */
export const APPEARANCE_CATEGORY = '外观';

/**
 * 外观区块的**检索关键词**。
 *
 * 含中英文两套：宿主用户可能用任一语言搜索。匹配方式为**子串包含**
 * （见 {@link matchAppearance}），因此无需逐词精确命中。
 */
export const APPEARANCE_KEYWORDS: readonly string[] = [
  '外观',
  '主题',
  '主题模式',
  '浅色',
  '深色',
  '跟随系统',
  'appearance',
  'theme',
  'dark',
  'light',
  'system',
];

/**
 * 外观区块的可见性判定。
 *
 * 三条约束按顺序短路：
 *
 * 1. 若宿主关闭了外观区块（`enabled === false`）→ 不可见；
 * 2. 若选择了分类且该分类不是 {@link APPEARANCE_CATEGORY} → 不可见；
 * 3. 若有搜索词，必须命中 {@link APPEARANCE_KEYWORDS} 中任一项的子串 → 才可见。
 *
 * @param options 判定输入。
 * @returns 是否展示外观区块。
 * @example
 * matchAppearance({ enabled: true, query: '' })                        // true
 * matchAppearance({ enabled: true, query: '主题' })                     // true
 * matchAppearance({ enabled: true, query: '字号' })                     // false
 * matchAppearance({ enabled: true, category: '编辑器' })                // false
 * matchAppearance({ enabled: true, category: '外观' })                  // true
 * matchAppearance({ enabled: false, query: '' })                       // false
 */
export function matchAppearance(options: {
  /** 宿主是否启用内置外观区块。 */
  enabled: boolean;
  /** 搜索框当前内容（已去首尾空白前的原值即可）。 */
  query?: string;
  /** 分类下拉当前选中项。 */
  category?: string;
}): boolean {
  if (!options.enabled) return false;

  const category = options.category?.trim();
  if (category && category !== APPEARANCE_CATEGORY) return false;

  const needle = options.query?.trim().toLowerCase() ?? '';
  if (!needle) return true;

  return APPEARANCE_KEYWORDS.some((keyword) => keyword.toLowerCase().includes(needle));
}
