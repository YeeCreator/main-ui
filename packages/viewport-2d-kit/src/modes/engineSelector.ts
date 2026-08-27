import type { ViewportEngineDescriptor, ViewportModeKind } from './contracts';

/**
 * 根据模式解析引擎信息。
 *
 * 自 pixi 内核化（方案 B）起，所有模式统一使用 `viewport-2d-kit/pixi` 的
 * `PixiViewport` 作为唯一渲染内核；`lite` 也不再需要 `react-infinite-viewer`。
 *
 * @param mode 模式名。
 * @returns 引擎描述对象。
 */
export function resolveViewportEngine(mode: ViewportModeKind): ViewportEngineDescriptor {
  return {
    mode,
    engine: 'pixi',
    summary: '统一使用 viewport-2d-kit/pixi（PixiViewport）作为渲染内核。',
  };
}

/**
 * 获取所有模式与引擎映射。
 *
 * @returns 引擎映射列表。
 */
export function listViewportEngineDescriptors(): ViewportEngineDescriptor[] {
  return [resolveViewportEngine('lite'), resolveViewportEngine('game'), resolveViewportEngine('map')];
}

/**
 * 历史兼容：列出旧第三方引擎映射（不再推荐使用）。
 *
 * @returns 旧引擎映射列表。
 */
export function listLegacyViewportEngines(): ViewportEngineDescriptor[] {
  return [
    {
      mode: 'lite',
      engine: 'react-infinite-viewer',
      legacy: true,
      summary: '历史兼容：轻量 DOM 平移/缩放，已由 pixi 内核取代。',
    },
    {
      mode: 'game',
      engine: 'pixi-viewport',
      legacy: true,
      summary: '历史兼容：第三方 pixi-viewport 插件，已由内核 PixiViewport 取代。',
    },
    {
      mode: 'map',
      engine: 'pixi-viewport',
      legacy: true,
      summary: '历史兼容：第三方 pixi-viewport 插件，已由内核 PixiViewport 取代。',
    },
  ];
}
