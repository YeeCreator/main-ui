import React from 'react';

/**
 * 视口状态栏属性。
 */
export type ViewportStatusProps = {
  /** 当前缩放值（例如 1.2）。 */
  scale: number;
  /** 相机平移 X（屏幕像素）。 */
  panX: number;
  /** 相机平移 Y（屏幕像素）。 */
  panY: number;
  /** 外层 className。 */
  className?: string;
  /** 外层样式。 */
  style?: React.CSSProperties;
};

/**
 * `ViewportStatus`：展示当前缩放与平移信息的轻量状态栏。
 *
 * @param props 组件属性。
 * @returns 状态栏 React 节点。
 * @example
 * ```tsx
 * <ViewportStatus scale={camera.scale} panX={camera.pan.x} panY={camera.pan.y} />
 * ```
 */
export function ViewportStatus(props: ViewportStatusProps) {
  const { scale, panX, panY, className, style } = props;

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '4px 8px',
        borderRadius: 8,
        border: '1px solid #d4d4d8',
        background: 'rgba(255,255,255,0.9)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12,
        ...style,
      }}
    >
      <span>缩放: {(scale * 100).toFixed(1)}%</span>
      <span>平移X: {panX.toFixed(1)}</span>
      <span>平移Y: {panY.toFixed(1)}</span>
    </div>
  );
}
