import React from 'react';
import { ViewportLite } from 'viewport-2d-kit';

/**
 * 轻量模式最小示例。
 */
export function LiteBasicExample() {
  return (
    <div style={{ width: '100%', height: 560 }}>
      <ViewportLite
        viewBox={{ x: 0, y: 0, width: 2000, height: 1200 }}
        minScale={0.25}
        maxScale={8}
        overlay={({ camera, fitToCenter }) => (
          <div style={{ position: 'absolute', top: 12, left: 12, pointerEvents: 'auto' }}>
            <button type="button" onClick={fitToCenter}>
              居中
            </button>
            <span style={{ marginLeft: 8 }}>scale: {camera.scale.toFixed(2)}</span>
          </div>
        )}
      >
        <div style={{ width: 1800, height: 900, background: '#f6f6f6', border: '1px solid #ddd' }}>
          lite basic content
        </div>
      </ViewportLite>
    </div>
  );
}
