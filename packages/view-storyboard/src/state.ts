import type { StoryboardCard, StoryboardSerializeOptions } from './types';

/** 更新指定卡片注释（纯函数，可单测）：返回新数组，不改动入参。 */
export const updateCardNote = (
  cards: readonly StoryboardCard[],
  id: string,
  note: string,
): StoryboardCard[] => cards.map((card) => (card.id === id ? { ...card, note } : { ...card }));

/** 移除指定卡片（纯函数，可单测）：返回新数组，不改动入参。 */
export const removeCard = (
  cards: readonly StoryboardCard[],
  id: string,
): StoryboardCard[] => cards.filter((card) => card.id !== id);

/** 按 tick 升序排列（纯函数，可单测）：稳定排序，返回新数组。 */
export const sortCardsByTick = (cards: readonly StoryboardCard[]): StoryboardCard[] =>
  [...cards].sort((a, b) => a.tick - b.tick);

/**
 * 序列化分镜为 JSON 字符串（纯函数，可单测）。
 * 采用领域无关的封装格式（format/version/cards），宿主可据此落盘或导出。
 */
export const serializeStoryboard = (
  cards: readonly StoryboardCard[],
  options: StoryboardSerializeOptions = {},
): string =>
  JSON.stringify(
    { format: options.format ?? 'storyboard', version: options.version ?? 1, cards: [...cards] },
    null,
    2,
  );
