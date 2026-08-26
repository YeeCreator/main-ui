import type { ViewportModeKind } from '../contracts';

/**
 * map 模式元信息。
 */
export const MODE_MAP_KIND: ViewportModeKind = 'map';

/**
 * map 模式引擎名。
 */
export const MODE_MAP_ENGINE = 'pixi-viewport' as const;

/**
 * map 模式说明。
 */
export const MODE_MAP_SUMMARY = 'map 场景使用 pixi-viewport。';
