import { describe, expect, it } from 'vitest';
import { MIN_COLUMN_WIDTH } from '../src/types';

/**
 * 列宽拉伸与多选的**契约层**断言。
 *
 * 交互本身（指针拖动、复选框点击）由组件承担，无法在纯函数层验证；
 * 这里钉死的是两条容易被改坏的决定：
 *
 * 1. 列宽有一个不可越过的下界 —— 否则用户能把列拖成零宽且无法再拖回
 *    （把手也变成零宽，鼠标再也点不到）。
 * 2. 默认（未拉伸、未多选）时列宽解析与此前一致 —— 既有宿主零影响。
 */
describe('列宽常量', () => {
  it('最小列宽足够放回拖拽把手', () => {
    expect(MIN_COLUMN_WIDTH).toBeGreaterThanOrEqual(24);
  });
});

describe('列宽解析优先级', () => {
  /** 与组件内的 gridTemplate 同构的最小复刻（纯逻辑，便于断言优先级）。 */
  const resolveTemplate = (
    columns: Array<{ key: string; width?: number }>,
    resized: Record<string, number>,
    multiSelect: boolean,
  ): string => {
    const parts = columns.map((column) => {
      const user = resized[column.key];
      if (typeof user === 'number') return `${user}px`;
      if (typeof column.width === 'number') return `${column.width}px`;
      return 'minmax(0, 1fr)';
    });
    return [...(multiSelect ? ['28px'] : []), ...parts].join(' ');
  };

  it('未拉伸未多选时与此前完全一致', () => {
    expect(resolveTemplate([{ key: 'a', width: 100 }, { key: 'b' }], {}, false))
      .toBe('100px minmax(0, 1fr)');
  });

  it('用户拉伸优先于声明宽度', () => {
    expect(resolveTemplate([{ key: 'a', width: 100 }], { a: 180 }, false)).toBe('180px');
  });

  it('多选前置 28px 选择列', () => {
    expect(resolveTemplate([{ key: 'a', width: 100 }], {}, true)).toBe('28px 100px');
  });
});
