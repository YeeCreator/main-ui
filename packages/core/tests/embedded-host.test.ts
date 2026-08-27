import { describe, expect, test, vi } from 'vitest';
import {
  checkNestingDepth,
  createEmbeddedViewHost,
  DEFAULT_MAX_NESTING_DEPTH,
  type EmbeddedViewDescriptor,
} from '../src/embedded-host';

describe('checkNestingDepth', () => {
  test('empty refs returns ok with depth 0', () => {
    const result = checkNestingDepth([], () => []);
    expect(result).toEqual({ status: 'ok', depth: 0 });
  });

  test('single level within limit', () => {
    const resolve = (refId: string): string[] => {
      if (refId === 'a') return ['b', 'c'];
      return [];
    };
    const result = checkNestingDepth(['a'], resolve);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.depth).toBe(1);
  });

  test('linear chain respects maxDepth', () => {
    // a → b → c → d → e (depth 4)
    const chain: Record<string, string[]> = {
      a: ['b'], b: ['c'], c: ['d'], d: ['e'], e: [],
    };
    const resolve = (refId: string) => chain[refId] ?? [];
    expect(checkNestingDepth(['a'], resolve, 5).status).toBe('ok');
    expect(checkNestingDepth(['a'], resolve, 4).status).toBe('exceeded');
  });

  test('default max depth is 8', () => {
    expect(DEFAULT_MAX_NESTING_DEPTH).toBe(8);
    // Build chain of depth 9
    const chain: Record<string, string[]> = {};
    for (let i = 0; i < 9; i++) {
      chain[`n${i}`] = [`n${i + 1}`];
    }
    chain['n9'] = [];
    const result = checkNestingDepth(['n0'], (refId) => chain[refId] ?? []);
    expect(result.status).toBe('exceeded');
  });

  test('cycle detection prevents infinite loop', () => {
    // a → b → a (cycle)
    const chain: Record<string, string[]> = { a: ['b'], b: ['a'] };
    const resolve = (refId: string) => chain[refId] ?? [];
    // Should not hang; depth stays within limit
    const result = checkNestingDepth(['a'], resolve, 10);
    expect(result.status).toBe('ok');
  });

  test('branching tree depth', () => {
    // a → [b, c]; b → [d, e]; d → [f]  (max depth = 3)
    const chain: Record<string, string[]> = {
      a: ['b', 'c'], b: ['d', 'e'], c: [], d: ['f'], e: [], f: [],
    };
    const resolve = (refId: string) => chain[refId] ?? [];
    const result = checkNestingDepth(['a'], resolve);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.depth).toBe(3);
  });
});

describe('createEmbeddedViewHost', () => {
  const makeDescriptor = (id: string, viewType = 'view-test'): EmbeddedViewDescriptor => ({
    id, viewType,
  });

  test('register and query children', () => {
    const host = createEmbeddedViewHost();
    host.register(makeDescriptor('a'));
    host.register(makeDescriptor('b'));
    expect(host.children).toHaveLength(2);
    expect(host.has('a')).toBe(true);
    expect(host.has('c')).toBe(false);
  });

  test('register is idempotent', () => {
    const host = createEmbeddedViewHost();
    host.register(makeDescriptor('a'));
    host.register(makeDescriptor('a'));
    expect(host.children).toHaveLength(1);
  });

  test('unregister calls onChildDestroy', () => {
    const onDestroy = vi.fn();
    const host = createEmbeddedViewHost(onDestroy);
    const desc = makeDescriptor('a');
    host.register(desc);
    host.unregister('a');
    expect(onDestroy).toHaveBeenCalledWith(desc);
    expect(host.has('a')).toBe(false);
  });

  test('unregister nonexistent is silent', () => {
    const onDestroy = vi.fn();
    const host = createEmbeddedViewHost(onDestroy);
    host.unregister('nope');
    expect(onDestroy).not.toHaveBeenCalled();
  });

  test('destroyAll cascades and is idempotent', () => {
    const onDestroy = vi.fn();
    const host = createEmbeddedViewHost(onDestroy);
    host.register(makeDescriptor('a'));
    host.register(makeDescriptor('b'));
    host.register(makeDescriptor('c'));
    host.destroyAll();
    expect(onDestroy).toHaveBeenCalledTimes(3);
    expect(host.children).toHaveLength(0);
    // Second call is no-op
    host.destroyAll();
    expect(onDestroy).toHaveBeenCalledTimes(3);
  });

  test('register after destroyAll is ignored', () => {
    const host = createEmbeddedViewHost();
    host.destroyAll();
    host.register(makeDescriptor('a'));
    expect(host.children).toHaveLength(0);
  });
});
