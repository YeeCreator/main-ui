import React from 'react';
import type { ViewportModeKind } from './contracts';
import { ViewportLite } from './modeLite';
import type { ViewportLiteProps } from './modeLite';

/**
 * 模式化视口宿主属性。
 */
export type ViewportModeHostProps = {
  /** 模式。 */
  mode: ViewportModeKind;
  /** lite 模式属性。 */
  liteProps?: ViewportLiteProps;
  /** game/map 场景渲染器。 */
  renderPixiMode?: (mode: 'game' | 'map') => React.ReactNode;
  /** 可选：未命中渲染器时的兜底内容。 */
  fallback?: React.ReactNode;
};

/**
 * 模式化视口宿主组件。
 *
 * @param props 组件属性。
 * @returns React 节点。
 */
export function ViewportModeHost(props: ViewportModeHostProps) {
  if (props.mode === 'lite') {
    if (!props.liteProps) {
      return <div>mode=lite 时必须传入 liteProps。</div>;
    }
    return <ViewportLite {...props.liteProps} />;
  }

  if (props.renderPixiMode) {
    return <>{props.renderPixiMode(props.mode)}</>;
  }

  if (props.fallback) {
    return <>{props.fallback}</>;
  }

  return (
    <div style={{ padding: 12, color: '#444', fontSize: 13 }}>
      当前模式为 <code>{props.mode}</code>，请通过 <code>renderPixiMode</code> 注入基于{' '}
      <code>viewport-2d-kit/pixi</code>（PixiViewport）的视图。
    </div>
  );
}
