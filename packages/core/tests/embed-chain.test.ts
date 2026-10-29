/**
 * core/embedded-host —— 引用三种语义与内联链路校验。
 *
 * 守护目标：**存储是图（允许成环），展开是树（必须限深 + 检环）**。
 * 双链天然成环（A 引 B、B 引 A），若展开层不检测就会死循环。
 */
import { describe, expect, test } from 'vitest';
import {
  DEFAULT_MAX_EMBED_DEPTH,
  checkEmbedChain,
  refExpandsInline,
} from '../src/embedded-host';

describe('refExpandsInline · 三种语义', () => {
  test('只有 embed 内联展开', () => {
    expect(refExpandsInline('embed')).toBe(true);
    expect(refExpandsInline('link')).toBe(false);
    expect(refExpandsInline('drill')).toBe(false);
  });
});

describe('checkEmbedChain · 深度', () => {
  test('空链为 ok 且深度 0', () => {
    expect(checkEmbedChain([], () => [])).toEqual({ status: 'ok', depth: 0 });
  });

  test('链长在上限内为 ok', () => {
    const resolve = (id: string) => (id === 'a' ? ['b'] : id === 'b' ? ['c'] : []);
    const result = checkEmbedChain(['a'], resolve);
    expect(result.status).toBe('ok');
  });

  test('超过默认深度（3）判 exceeded', () => {
    // a→b→c→d→e 共 5 层
    const chain: Record<string, string[]> = { a: ['b'], b: ['c'], c: ['d'], d: ['e'], e: [] };
    const result = checkEmbedChain(['a'], (id) => chain[id] ?? []);
    expect(result.status).toBe('exceeded');
    if (result.status === 'exceeded') {
      expect(result.maxDepth).toBe(DEFAULT_MAX_EMBED_DEPTH);
    }
  });

  test('可显式放宽上限', () => {
    const chain: Record<string, string[]> = { a: ['b'], b: ['c'], c: ['d'], d: [] };
    expect(checkEmbedChain(['a'], (id) => chain[id] ?? [], 10).status).toBe('ok');
  });
});

describe('checkEmbedChain · 成环', () => {
  test('自引用判成环', () => {
    expect(checkEmbedChain(['a'], (id) => (id === 'a' ? ['a'] : [])).status).toBe('cycle');
  });

  test('互引（A↔B）判成环', () => {
    const resolve = (id: string) => (id === 'a' ? ['b'] : id === 'b' ? ['a'] : []);
    expect(checkEmbedChain(['a'], resolve).status).toBe('cycle');
  });

  test('成环不因深度上限而漏报（环的判定优先于深度）', () => {
    const resolve = (id: string) => (id === 'a' ? ['b'] : id === 'b' ? ['a'] : []);
    const result = checkEmbedChain(['a'], resolve, 100);
    expect(result.status).toBe('cycle');
  });

  test('菱形引用不算环（同层重复合法）', () => {
    // a → b, a → c, b → d, c → d：d 被两条路径到达，但不是环
    const resolve = (id: string) => {
      if (id === 'a') return ['b', 'c'];
      if (id === 'b') return ['d'];
      if (id === 'c') return ['d'];
      return [];
    };
    expect(checkEmbedChain(['a'], resolve, 10).status).toBe('ok');
  });
});
