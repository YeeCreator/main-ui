import React from 'react';
import * as Toolbar from '@radix-ui/react-toolbar';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

/**
 * 工具栏文案集合。
 */
export type ViewportToolbarLabels = {
  /** 缩小按钮文案。 */
  zoomOut: string;
  /** 放大按钮文案。 */
  zoomIn: string;
  /** 视口重置按钮文案。 */
  fit: string;
  /** 更多菜单触发按钮文案。 */
  more: string;
  /** 锁定平移菜单项文案。 */
  lockPan: string;
};

/**
 * 视口工具栏属性。
 */
export type ViewportToolbarProps = {
  /** 当前缩放显示文本（例如 `125%`）。 */
  zoomText?: string;
  /** 点击缩小时触发。 */
  onZoomOut?: () => void;
  /** 点击放大时触发。 */
  onZoomIn?: () => void;
  /** 点击适配居中时触发。 */
  onFitToCenter?: () => void;
  /** 切换平移锁定时触发。 */
  onPanLockChange?: (nextLocked: boolean) => void;
  /** 是否锁定平移。 */
  panLocked?: boolean;
  /** 外层 className。 */
  className?: string;
  /** 外层样式。 */
  style?: React.CSSProperties;
  /** 自定义文案。 */
  labels?: Partial<ViewportToolbarLabels>;
};

/**
 * 默认工具栏文案。
 */
const DEFAULT_LABELS: ViewportToolbarLabels = {
  zoomOut: '缩小',
  zoomIn: '放大',
  fit: '适配',
  more: '更多',
  lockPan: '锁定平移',
};

/**
 * `ViewportToolbar`：基于 Radix Toolbar 与 DropdownMenu 的最小工具栏。
 *
 * @param props 组件属性。
 * @returns 工具栏 React 节点。
 * @example
 * ```tsx
 * <ViewportToolbar
 *   zoomText="100%"
 *   onZoomIn={() => controller.zoomIn()}
 *   onZoomOut={() => controller.zoomOut()}
 *   onFitToCenter={() => controller.fitToCenter()}
 * />
 * ```
 */
export function ViewportToolbar(props: ViewportToolbarProps) {
  const {
    zoomText,
    onZoomIn,
    onZoomOut,
    onFitToCenter,
    onPanLockChange,
    panLocked = false,
    className,
    style,
    labels,
  } = props;

  const mergedLabels: ViewportToolbarLabels = {
    ...DEFAULT_LABELS,
    ...labels,
  };

  return (
    <Toolbar.Root
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: 6,
        borderRadius: 8,
        border: '1px solid #d4d4d8',
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(6px)',
        ...style,
      }}
      aria-label="Viewport 工具栏"
    >
      <Toolbar.Button type="button" onClick={onZoomOut}>
        {mergedLabels.zoomOut}
      </Toolbar.Button>
      <Toolbar.Button type="button" onClick={onZoomIn}>
        {mergedLabels.zoomIn}
      </Toolbar.Button>
      <Toolbar.Separator style={{ width: 1, height: 16, background: '#e4e4e7' }} />
      <Toolbar.Button type="button" onClick={onFitToCenter}>
        {mergedLabels.fit}
      </Toolbar.Button>

      {zoomText ? <span style={{ minWidth: 52, textAlign: 'center' }}>{zoomText}</span> : null}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Toolbar.Button type="button">{mergedLabels.more}</Toolbar.Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={6}
            style={{
              minWidth: 140,
              borderRadius: 8,
              border: '1px solid #d4d4d8',
              background: '#ffffff',
              padding: 6,
              boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
            }}
          >
            <DropdownMenu.CheckboxItem
              checked={panLocked}
              onCheckedChange={(checked) => onPanLockChange?.(Boolean(checked))}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              {mergedLabels.lockPan}
            </DropdownMenu.CheckboxItem>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </Toolbar.Root>
  );
}
