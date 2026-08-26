import React from 'react';
import { Viewport2D, type Viewport2DController } from 'viewport-2d-kit/core';
import { ViewportToolbar, ViewportStatus } from 'viewport-2d-kit/ui';

/**
 * 地图编辑示例点位。
 */
type MapPoint = {
  /** 点位唯一标识。 */
  id: string;
  /** 世界坐标 X。 */
  x: number;
  /** 世界坐标 Y。 */
  y: number;
};

/**
 * 地图编辑示例组件。
 *
 * @returns 地图编辑视口示例。
 * @example
 * ```tsx
 * <MapEditorExample />
 * ```
 */
export function MapEditorExample(): React.JSX.Element {
  const controllerRef = React.useRef<Viewport2DController | null>(null);
  const [scale, setScale] = React.useState(1);
  const [panX, setPanX] = React.useState(0);
  const [panY, setPanY] = React.useState(0);

  const points: MapPoint[] = [
    { id: 'a', x: 120, y: 80 },
    { id: 'b', x: 360, y: 160 },
    { id: 'c', x: 560, y: 300 },
  ];

  return (
    <div style={{ width: '100%', height: 560, position: 'relative' }}>
      <Viewport2D
        viewBox={{ x: 0, y: 0, width: 800, height: 500 }}
        background="#f8fafc"
        controllerRef={controllerRef}
        onCamera={(camera) => {
          setScale(camera.scale);
          setPanX(camera.pan.x);
          setPanY(camera.pan.y);
        }}
      >
        <svg width={800} height={500}>
          <rect x={0} y={0} width={800} height={500} fill="#e2e8f0" />
          {points.map((point) => (
            <g key={point.id}>
              <circle cx={point.x} cy={point.y} r={10} fill="#0f766e" />
              <text x={point.x + 14} y={point.y + 4} fontSize={14} fill="#0f172a">
                点位 {point.id.toUpperCase()}
              </text>
            </g>
          ))}
        </svg>
      </Viewport2D>

      <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8 }}>
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
        <ViewportStatus scale={scale} panX={panX} panY={panY} />
      </div>
    </div>
  );
}
