import React from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';

/**
 * 视口覆盖层上下文菜单文案。
 */
export type ViewportOverlayMenuLabels = {
  /** 放大菜单项文案。 */
  zoomIn: string;
  /** 缩小菜单项文案。 */
  zoomOut: string;
  /** 适配菜单项文案。 */
  fit: string;
};

/**
 * 视口覆盖层上下文菜单属性。
 */
export type ViewportOverlayMenuProps = {
  /** 菜单触发区域。 */
  children: React.ReactNode;
  /** 点击“放大”时触发。 */
  onZoomIn?: () => void;
  /** 点击“缩小”时触发。 */
  onZoomOut?: () => void;
  /** 点击“适配”时触发。 */
  onFitToCenter?: () => void;
  /** 自定义文案。 */
  labels?: Partial<ViewportOverlayMenuLabels>;
};

/**
 * 默认菜单文案。
 */
const DEFAULT_LABELS: ViewportOverlayMenuLabels = {
  zoomIn: '放大',
  zoomOut: '缩小',
  fit: '适配到视口',
};

/**
 * `ViewportOverlayMenu`：基于 Radix ContextMenu 的视口右键菜单。
 *
 * @param props 组件属性。
 * @returns 覆盖层菜单 React 节点。
 * @example
 * ```tsx
 * <ViewportOverlayMenu
 *   onZoomIn={() => controller.zoomIn()}
 *   onZoomOut={() => controller.zoomOut()}
 *   onFitToCenter={() => controller.fitToCenter()}
 * >
 *   <div style={{ width: '100%', height: '100%' }} />
 * </ViewportOverlayMenu>
 * ```
 */
export function ViewportOverlayMenu(props: ViewportOverlayMenuProps) {
  const { children, onZoomIn, onZoomOut, onFitToCenter, labels } = props;

  const mergedLabels: ViewportOverlayMenuLabels = {
    ...DEFAULT_LABELS,
    ...labels,
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          style={{
            minWidth: 150,
            borderRadius: 8,
            border: '1px solid #d4d4d8',
            background: '#ffffff',
            padding: 6,
            boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
          }}
        >
          <ContextMenu.Item onClick={onZoomIn} style={itemStyle}>
            {mergedLabels.zoomIn}
          </ContextMenu.Item>
          <ContextMenu.Item onClick={onZoomOut} style={itemStyle}>
            {mergedLabels.zoomOut}
          </ContextMenu.Item>
          <ContextMenu.Separator style={{ height: 1, background: '#e4e4e7', margin: '6px 0' }} />
          <ContextMenu.Item onClick={onFitToCenter} style={itemStyle}>
            {mergedLabels.fit}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

/**
 * 菜单项基础样式。
 */
const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '6px 8px',
  borderRadius: 6,
  cursor: 'pointer',
  userSelect: 'none',
};
