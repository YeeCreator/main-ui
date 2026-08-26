import React from 'react';
import { Viewport2D, type Viewport2DController } from 'viewport-2d-kit/core';
import { ViewportToolbar } from 'viewport-2d-kit/ui';

/**
 * 折线点位。
 */
type StrokePoint = {
  /** 点位 X。 */
  x: number;
  /** 点位 Y。 */
  y: number;
};

/**
 * 绘图工具示例组件。
 *
 * @returns 绘图工具视口示例。
 * @example
 * ```tsx
 * <DrawingToolExample />
 * ```
 */
export function DrawingToolExample(): React.JSX.Element {
  const controllerRef = React.useRef<Viewport2DController | null>(null);
  const [scale, setScale] = React.useState(1);

  const stroke: StrokePoint[] = [
    { x: 80, y: 120 },
    { x: 180, y: 220 },
    { x: 260, y: 180 },
    { x: 360, y: 280 },
    { x: 460, y: 240 },
  ];

  const pathData = stroke.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <div style={{ width: '100%', height: 560, position: 'relative' }}>
      <Viewport2D
        viewBox={{ x: 0, y: 0, width: 900, height: 560 }}
        background="#ecfeff"
        controllerRef={controllerRef}
        onCamera={(camera) => setScale(camera.scale)}
      >
        <svg width={900} height={560}>
          <rect x={0} y={0} width={900} height={560} fill="#cffafe" />
          <path d={pathData} fill="none" stroke="#0f766e" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Viewport2D>

      <div style={{ position: 'absolute', top: 12, left: 12 }}>
        <ViewportToolbar
          zoomText={`${(scale * 100).toFixed(0)}%`}
          onZoomIn={() => {
            const controller = controllerRef.current;
            if (!controller) return;
            const camera = controller.getCamera();
            controller.setCamera({ ...camera, scale: camera.scale * 1.2 });
          }}
          onZoomOut={() => {
            const controller = controllerRef.current;
            if (!controller) return;
            const camera = controller.getCamera();
            controller.setCamera({ ...camera, scale: camera.scale / 1.2 });
          }}
          onFitToCenter={() => controllerRef.current?.fitToCenter()}
        />
      </div>
    </div>
  );
}
