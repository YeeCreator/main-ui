import React from 'react';
import { getLayoutPresetStyles, type LayoutPreset } from './tokens';

/**
 * 底部 Panel 标签项。
 */
export type BottomPanelTab = {
  /** 唯一标识。 */
  id: string;
  /** 标题。 */
  label: string;
  /** 是否激活。 */
  active?: boolean;
  /** 点击回调。 */
  onClick?: () => void;
};

/**
 * 底部 Panel 属性。
 */
export type BottomPanelProps = {
  /** Panel 标签。 */
  tabs: BottomPanelTab[];
  /** 内容区域。 */
  children?: React.ReactNode;
  /** 右侧操作区。 */
  actions?: React.ReactNode;
  /** 高度。 */
  height?: number;
  /** 视觉预设。 */
  preset?: LayoutPreset;
  /** 自定义样式。 */
  style?: React.CSSProperties;
};

/**
 * 编辑器底部 Panel。
 *
 * @param props 底部 Panel 属性。
 * @returns 底部 Panel 视图。
 */
export function BottomPanel(props: BottomPanelProps) {
  const { tabs, children, actions, height = 180, preset = 'default', style } = props;
  const chromeStyles = getLayoutPresetStyles(preset);

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height,
        borderTop: `1px solid ${chromeStyles.borderColor}`,
        background: chromeStyles.panelBackground,
        color: chromeStyles.textPrimary,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 34,
          borderBottom: `1px solid ${chromeStyles.borderColor}`,
          background: chromeStyles.sectionBackground,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'stretch', overflowX: 'auto' }}>
          {tabs.map((tab) => {
            const active = Boolean(tab.active);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={tab.onClick}
                style={{
                  border: 'none',
                  borderTop: active ? `2px solid ${chromeStyles.accentColor}` : '2px solid transparent',
                  borderRight: `1px solid ${chromeStyles.borderColor}`,
                  background: active ? chromeStyles.panelBackground : 'transparent',
                  color: active ? chromeStyles.textPrimary : chromeStyles.textSecondary,
                  padding: '0 12px',
                  cursor: tab.onClick ? 'pointer' : 'default',
                  fontSize: 12,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {actions ? <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px' }}>{actions}</div> : null}
      </div>

      <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', padding: 12 }}>{children}</div>
    </section>
  );
}