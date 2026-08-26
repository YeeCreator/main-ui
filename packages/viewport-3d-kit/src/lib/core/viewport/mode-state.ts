/**
 * 视口工作模式。
 */
export type ViewportWorkMode = 'runtime' | 'edit';

/**
 * 视口显示模式（参考 Blender 4.x 常用术语）。
 */
export type ViewportDisplayMode = 'wireframe' | 'solid' | 'rendered';

/**
 * 轨道交互预设。
 */
export type ViewportControlPreset = 'default' | 'modifier-middle';

/**
 * 视口行为配置。
 */
export interface ViewportInteractionOptions {
  /** 是否启用 Unreal 风格运行视角。 */
  unrealRuntimeNavigation: boolean;
  /** 交互预设。 */
  controlPreset: ViewportControlPreset;
}

/**
 * 默认运行时交互配置。
 */
export const DEFAULT_RUNTIME_INTERACTION_OPTIONS: ViewportInteractionOptions = {
  unrealRuntimeNavigation: true,
  controlPreset: 'default',
};

/**
 * 默认编辑器交互配置。
 */
export const DEFAULT_EDIT_INTERACTION_OPTIONS: ViewportInteractionOptions = {
  unrealRuntimeNavigation: false,
  controlPreset: 'modifier-middle',
};
