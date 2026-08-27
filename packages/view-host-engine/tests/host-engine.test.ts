import { describe, expect, test, vi } from 'vitest';
import type { ExternalEngineApi } from '../src/types';

describe('view-host-engine types', () => {
  test('ExternalEngineApi contract shape', () => {
    // Verify the contract shape (no DOM in Node test env)
    const mockEngine: ExternalEngineApi = {
      mount: vi.fn(),
      onResize: vi.fn(),
      destroy: vi.fn(),
    };
    expect(typeof mockEngine.mount).toBe('function');
    expect(typeof mockEngine.onResize).toBe('function');
    expect(typeof mockEngine.destroy).toBe('function');
  });

  test('mock engine lifecycle flow', () => {
    const events: string[] = [];
    const engine: ExternalEngineApi = {
      mount: (container: HTMLElement) => { events.push('mount'); },
      onResize: (w: number, h: number) => { events.push(`resize:${w}x${h}`); },
      destroy: () => { events.push('destroy'); },
    };

    // Simulate lifecycle
    engine.mount({} as HTMLElement);
    engine.onResize(800, 600);
    engine.destroy();

    expect(events).toEqual(['mount', 'resize:800x600', 'destroy']);
  });
});
