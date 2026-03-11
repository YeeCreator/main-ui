import React from 'react';
import { getLayoutPresetStyles, type LayoutPreset } from './tokens';

/**
 * 状态栏项。
 */
export type StatusBarItem = {
  /** 稳定唯一标识。 */
  id?: string;
  /** 展示内容。 */
  content: React.ReactNode;
};

/**
 * 状态栏属性。
 */
export type StatusBarProps = {
  /** 左侧状态项。 */
  left?: StatusBarItem[];
  /** 右侧状态项。 */
  right?: StatusBarItem[];
  /** 自定义左侧内容。 */
  leftContent?: React.ReactNode;
  /** 自定义右侧内容。 */
  rightContent?: React.ReactNode;
  /** 视觉预设。 */
  preset?: LayoutPreset;
  /** 自定义样式。 */
  style?: React.CSSProperties;
};

/**
 * 主界面底部状态栏。
 *
 * @param props 状态栏属性。
 * @returns 状态栏视图。
 */
export function StatusBar(props: StatusBarProps) {
  const { left = [], right = [], leftContent, rightContent, preset = 'default', style } = props;
  const chromeStyles = getLayoutPresetStyles(preset);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minHeight: 24,
        padding: '4px 8px',
        borderTop: `1px solid ${chromeStyles.borderColor}`,
        background: chromeStyles.statusbarBackground,
        color: chromeStyles.statusbarText,
        fontSize: 12,
        userSelect: 'none',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {leftContent}
        {left.map((item, index) => (
          <span key={item.id ?? `left-${index}`} style={{ whiteSpace: 'nowrap' }}>
            {item.content}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {right.map((item, index) => (
          <span key={item.id ?? `right-${index}`} style={{ whiteSpace: 'nowrap' }}>
            {item.content}
          </span>
        ))}
        {rightContent}
      </div>
    </div>
  );
}