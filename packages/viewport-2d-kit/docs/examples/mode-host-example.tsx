import React from 'react';
import { ViewportModeHost } from 'viewport-2d-kit';

/**
 * 模式宿主示例。
 */
export function ModeHostExample() {
  return (
    <ViewportModeHost
      mode="map"
      liteProps={{ viewBox: { x: 0, y: 0, width: 1, height: 1 } }}
      renderPixiMode={(mode) => (
        <div style={{ width: '100%', height: 560, display: 'grid', placeItems: 'center', background: '#fafafa' }}>
          {mode} pixi viewport host
        </div>
      )}
    />
  );
}
