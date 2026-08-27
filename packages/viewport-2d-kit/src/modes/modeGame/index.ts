import type { ViewportModeKind } from '../contracts';

/**
 * game 模式元信息。
 */
export const MODE_GAME_KIND: ViewportModeKind = 'game';

/**
 * game 模式引擎名。
 */
export const MODE_GAME_ENGINE = 'pixi-viewport' as const;

/**
 * game 模式说明。
 */
export const MODE_GAME_SUMMARY = 'game 场景使用 pixi-viewport。';
