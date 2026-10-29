/**
 * settings/appearance —— 内置「外观」区块的可见性判定。
 *
 * 守护目标：外观区块必须参与同一套搜索与分类筛选。
 * 若不做，用户搜「主题」会什么都搜不到 —— 那会被当成搜索坏了。
 */
import { describe, expect, test } from 'vitest';
import { APPEARANCE_CATEGORY, APPEARANCE_KEYWORDS, matchAppearance } from '../../src/core/settings/appearance';

describe('matchAppearance · 开关', () => {
  test('宿主关闭时一律不可见（即使搜索命中）', () => {
    expect(matchAppearance({ enabled: false })).toBe(false);
    expect(matchAppearance({ enabled: false, query: '主题' })).toBe(false);
    expect(matchAppearance({ enabled: false, category: APPEARANCE_CATEGORY })).toBe(false);
  });

  test('启用且无搜索无分类 → 可见', () => {
    expect(matchAppearance({ enabled: true })).toBe(true);
    expect(matchAppearance({ enabled: true, query: '', category: undefined })).toBe(true);
  });
});

describe('matchAppearance · 分类筛选', () => {
  test('选中外观分类 → 可见', () => {
    expect(matchAppearance({ enabled: true, category: APPEARANCE_CATEGORY })).toBe(true);
  });

  test('选中其它分类 → 不可见', () => {
    expect(matchAppearance({ enabled: true, category: '编辑器' })).toBe(false);
  });

  test('空白分类视为未筛选', () => {
    expect(matchAppearance({ enabled: true, category: '   ' })).toBe(true);
  });
});

describe('matchAppearance · 搜索', () => {
  test('命中中文关键词（子串方向：关键词包含输入）', () => {
    expect(matchAppearance({ enabled: true, query: '主题' })).toBe(true);
    expect(matchAppearance({ enabled: true, query: '主' })).toBe(true);
    expect(matchAppearance({ enabled: true, query: '深色' })).toBe(true);
    expect(matchAppearance({ enabled: true, query: '跟随系统' })).toBe(true);
  });

  test('命中英文关键词，大小写不敏感', () => {
    expect(matchAppearance({ enabled: true, query: 'theme' })).toBe(true);
    expect(matchAppearance({ enabled: true, query: 'THEME' })).toBe(true);
    expect(matchAppearance({ enabled: true, query: 'Appearance' })).toBe(true);
  });

  test('未命中 → 不可见', () => {
    expect(matchAppearance({ enabled: true, query: '字号' })).toBe(false);
    expect(matchAppearance({ enabled: true, query: '快捷键' })).toBe(false);
    expect(matchAppearance({ enabled: true, query: 'zzz' })).toBe(false);
  });

  test('首尾空白被忽略', () => {
    expect(matchAppearance({ enabled: true, query: '  主题  ' })).toBe(true);
    expect(matchAppearance({ enabled: true, query: '   ' })).toBe(true);
  });
});

describe('APPEARANCE_KEYWORDS', () => {
  test('中英文两套都有（不同语言用户都要能搜到）', () => {
    expect(APPEARANCE_KEYWORDS).toContain('外观');
    expect(APPEARANCE_KEYWORDS).toContain('appearance');
  });

  test('每个关键词自身都能命中（防止加入无法被搜到的死词）', () => {
    for (const keyword of APPEARANCE_KEYWORDS) {
      expect(matchAppearance({ enabled: true, query: keyword })).toBe(true);
    }
  });
});
