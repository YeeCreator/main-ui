import React from 'react';
import { getLayoutPresetStyles, type LayoutPreset } from './tokens';

/**
 * 视口宿主属性。
 */
export type ViewportHostProps = {
  /** 宿主容器的子内容。 */
  children?: React.ReactNode;
  /** 外部视口挂载引用。 */
  hostRef?: React.Ref<HTMLDivElement>;
  /** 视觉预设。 */
  preset?: LayoutPreset;
  /** 内边距。 */
  padding?: number;
  /** 是否裁剪溢出内容。 */
  clip?: boolean;
  /** 自定义样式。 */
  style?: React.CSSProperties;
};

/**
 * 视口宿主容器。
 *
 * 该组件不实现任何视口逻辑，只提供稳定的嵌入挂载位。
 *
 * @param props 视口宿主属性。
 * @returns 视口宿主视图。
 */
export function ViewportHost(props: ViewportHostProps) {
  const { children, hostRef, preset = 'default', padding = 0, clip = true, style } = props;
  const chromeStyles = getLayoutPresetStyles(preset);

  return (
    <div
      ref={hostRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        overflow: clip ? 'hidden' : 'visible',
        background: chromeStyles.viewportBackground,
        padding,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}