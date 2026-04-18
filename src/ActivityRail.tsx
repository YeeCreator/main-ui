import React from 'react';
import { getLayoutPresetStyles, type LayoutPreset } from './tokens';

/**
 * Activity Rail 项。
 */
export type ActivityRailItem = {
  /** 唯一标识。 */
  id: string;
  /** 显示标签。 */
  label: string;
  /** 图标内容。 */
  icon?: React.ReactNode;
  /** 是否激活。 */
  active?: boolean;
  /** 是否禁用。 */
  disabled?: boolean;
  /** 点击回调。 */
  onClick?: () => void;
};

/**
 * Activity Rail 属性。
 */
export type ActivityRailProps = {
  /** 顶部项目。 */
  items: ActivityRailItem[];
  /** 底部项目。 */
  bottomItems?: ActivityRailItem[];
  /** 视觉预设。 */
  preset?: LayoutPreset;
  /** 轨道宽度。 */
  width?: number;
  /** 自定义样式。 */
  style?: React.CSSProperties;
};

/**
 * 左侧 Activity Rail。
 *
 * @param props Activity Rail 属性。
 * @returns Activity Rail 视图。
 */
export function ActivityRail(props: ActivityRailProps) {
  const { items, bottomItems = [], preset = 'default', width = 52, style } = props;
  const chromeStyles = getLayoutPresetStyles(preset);

  const renderItem = (item: ActivityRailItem) => {
    const active = Boolean(item.active);

    return (
      <button
        key={item.id}
        type="button"
        title={item.label}
        disabled={item.disabled}
        onClick={item.onClick}
        style={{
          width: 36,
          height: 36,
          border: active ? `1px solid ${chromeStyles.controlSelectedBorder}` : `1px solid transparent`,
          background: active ? chromeStyles.controlSelectedBackground : 'transparent',
          color: chromeStyles.activityRailText,
          borderRadius: 10,
          cursor: item.disabled ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {item.icon ?? item.label.slice(0, 2).toUpperCase()}
      </button>
    );
  };

  return (
    <aside
      style={{
        flex: '0 0 auto',
        width,
        height: '100%',
        padding: 8,
        boxSizing: 'border-box',
        background: chromeStyles.activityRailBackground,
        borderRight: `1px solid ${chromeStyles.borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        ...style,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>{items.map(renderItem)}</div>
      {bottomItems.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>{bottomItems.map(renderItem)}</div>
      ) : null}
    </aside>
  );
}