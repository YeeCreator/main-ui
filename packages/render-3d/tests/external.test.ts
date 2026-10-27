import { describe, expect, test, vi } from 'vitest';
import type { EntitySnapshot } from '@main-ui/core/primitives';
import {
  detectTier,
  isPureRender,
  runExternalContractSmoke,
  validateExternalRegistry,
  type ExternalEngineBridge,
  type ExternalEngineEntry,
  type PureRenderBridge,
} from '../src/external';

/**
 * N4 用例：外接两档契约。
 *
 * 三条要守住的纪律：
 * 1. 档位**按能力判定**（有 feedFrame = 纯渲染），不靠名字；
 * 2. 清单**三字段齐全**才算决策工具（缺字段 → 愿望列表）；
 * 3. 最小验证宿主必须跑通**四步生命周期**（mount → 喂 → resize → destroy）。
 */

const snapshot: EntitySnapshot = {
  bounds: { x: 0, y: 0, width: 100, height: 100 },
  batches: { a: { kind: 'a', count: 0, columns: {}, geometry: 'point' } },
};

const fakeContainer = () => ({ clientWidth: 320, clientHeight: 200 }) as unknown as HTMLElement;

/** 纯渲染档假桥：记录调用。 */
function makePureBridge(): PureRenderBridge & { calls: string[]; frames: EntitySnapshot[] } {
  const calls: string[] = [];
  const frames: EntitySnapshot[] = [];
  return {
    calls,
    frames,
    mount: () => { calls.push('mount'); },
    feedFrame: (s) => { calls.push('feedFrame'); frames.push(s); },
    onResize: (w, h) => { calls.push(`resize:${w}x${h}`); },
    destroy: () => { calls.push('destroy'); },
  };
}

/** 全引擎档假桥：无 feedFrame，只有 postMessage。 */
function makeFullBridge(): ExternalEngineBridge & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    mount: () => { calls.push('mount'); },
    onResize: () => { calls.push('resize'); },
    postMessage: (m) => { calls.push(`msg:${m.type}`); },
    destroy: () => { calls.push('destroy'); },
  };
}

describe('外接档位判据：按能力不按名字', () => {
  test('有 feedFrame → 纯渲染档', () => {
    const bridge = makePureBridge();
    expect(isPureRender(bridge)).toBe(true);
    expect(detectTier(bridge)).toBe('pure-render');
  });

  test('无 feedFrame → 全引擎档', () => {
    const bridge = makeFullBridge();
    expect(isPureRender(bridge)).toBe(false);
    expect(detectTier(bridge)).toBe('full-engine');
  });
});

describe('外接清单三字段校验', () => {
  test('三字段齐全 → 无问题', () => {
    const entries: ExternalEngineEntry[] = [
      {
        name: '示例纯渲染引擎',
        tier: 'pure-render',
        granularity: 'view-relay',
        snapshotFlow: 'full',
        cost: '约 200KB gzip，无自有 UI',
      },
    ];
    expect(validateExternalRegistry(entries)).toEqual([]);
  });

  test('缺 cost / granularity / snapshotFlow 都被点名', () => {
    const issues = validateExternalRegistry([
      {
        name: 'X',
        tier: 'pure-render',
        granularity: '' as never,
        snapshotFlow: undefined as never,
        cost: '   ',
      },
    ]);
    expect(issues.length).toBeGreaterThanOrEqual(3);
    expect(issues.join()).toContain('接入粒度');
    expect(issues.join()).toContain('快照');
    expect(issues.join()).toContain('成本');
  });

  test('纯渲染档声明快照不可流入 → 自相矛盾', () => {
    const issues = validateExternalRegistry([
      { name: 'Y', tier: 'pure-render', granularity: 'view-relay', snapshotFlow: 'none', cost: '100KB' },
    ]);
    expect(issues.join()).toContain('自相矛盾');
  });

  test('全引擎档 + 视图级转播 + 完整快照 → 要求说明由谁解释快照', () => {
    const issues = validateExternalRegistry([
      { name: 'Z', tier: 'full-engine', granularity: 'view-relay', snapshotFlow: 'full', cost: '重' },
    ]);
    expect(issues.join()).toContain('解释快照');
  });

  test('无名条目被点名', () => {
    expect(validateExternalRegistry([
      { name: '', tier: 'pure-render', granularity: 'view-relay', snapshotFlow: 'full', cost: '1KB' },
    ]).join()).toContain('无名');
  });
});

describe('最小验证宿主：四步生命周期', () => {
  test('纯渲染桥：mount → feedFrame → resize → destroy 全通', async () => {
    const bridge = makePureBridge();
    const result = await runExternalContractSmoke(bridge, { container: fakeContainer(), snapshot });

    expect(result.error).toBeNull();
    expect(result).toMatchObject({ mounted: true, fed: true, resized: true, destroyed: true });
    expect(bridge.calls).toEqual(['mount', 'feedFrame', 'resize:336x216', 'destroy']);
    expect(bridge.frames[0]).toBe(snapshot);
  });

  test('全引擎桥：mount → postMessage → resize → destroy 全通', async () => {
    const bridge = makeFullBridge();
    const result = await runExternalContractSmoke(bridge, { container: fakeContainer() });

    expect(result.error).toBeNull();
    expect(bridge.calls).toEqual(['mount', 'msg:smoke', 'resize', 'destroy']);
    expect(result.fed).toBe(true);
  });

  test('纯渲染桥缺 snapshot → 报错且不静默通过', async () => {
    const bridge = makePureBridge();
    const result = await runExternalContractSmoke(bridge, { container: fakeContainer(), snapshot: null });
    expect(result.error).toContain('必须提供 snapshot');
    expect(result.fed).toBe(false);
  });

  test('mount 抛错 → 记录错误且后续步骤不标记成功', async () => {
    const bridge: PureRenderBridge = {
      mount: () => { throw new Error('装配失败'); },
      feedFrame: vi.fn(),
      onResize: vi.fn(),
      destroy: vi.fn(),
    };
    const result = await runExternalContractSmoke(bridge, { container: fakeContainer(), snapshot });
    expect(result.error).toBe('装配失败');
    expect(result.mounted).toBe(false);
    expect(result.destroyed).toBe(false);
  });
});
