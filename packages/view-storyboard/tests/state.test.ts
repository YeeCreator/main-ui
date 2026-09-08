import { describe, expect, it } from 'vitest';
import { removeCard, serializeStoryboard, sortCardsByTick, updateCardNote } from '../src/state';
import type { StoryboardCard } from '../src/types';

const card = (id: string, tick: number, note: string, image?: string): StoryboardCard => ({ id, tick, note, image });
const cards = [card('a', 5, 'five'), card('b', 1, 'one'), card('c', 3, 'three')];

describe('view-storyboard 纯函数', () => {
  it('updateCardNote 只改目标卡片注释，返回新数组', () => {
    const next = updateCardNote(cards, 'b', 'ONE');
    expect(next.find((item) => item.id === 'b')?.note).toBe('ONE');
    expect(next.find((item) => item.id === 'a')?.note).toBe('five');
    expect(next).not.toBe(cards);
    // 入参不被改动
    expect(cards.find((item) => item.id === 'b')?.note).toBe('one');
  });

  it('removeCard 移除目标卡片', () => {
    const next = removeCard(cards, 'a');
    expect(next.map((item) => item.id)).toEqual(['b', 'c']);
    expect(removeCard(cards, 'zzz')).toHaveLength(3);
  });

  it('sortCardsByTick 按 tick 升序，返回新数组', () => {
    expect(sortCardsByTick(cards).map((item) => item.id)).toEqual(['b', 'c', 'a']);
    expect(cards.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('serializeStoryboard 领域无关封装（format/version/cards）', () => {
    const json = serializeStoryboard([card('a', 1, 'one')]);
    const parsed = JSON.parse(json) as { format: string; version: number; cards: StoryboardCard[] };
    expect(parsed.format).toBe('storyboard');
    expect(parsed.version).toBe(1);
    expect(parsed.cards).toEqual([card('a', 1, 'one')]);
    const custom = JSON.parse(serializeStoryboard([], { format: 'x', version: 9 })) as { format: string; version: number };
    expect(custom.format).toBe('x');
    expect(custom.version).toBe(9);
  });
});
