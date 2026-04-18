import React from 'react';
import { getLayoutPresetStyles, type LayoutPreset } from './tokens';

/**
 * 编辑器标签项。
 */
export type EditorTabItem = {
  /** 唯一标识。 */
  id: string;
  /** 标签标题。 */
  label: string;
  /** 是否激活。 */
  active?: boolean;
  /** 是否脏状态。 */
  dirty?: boolean;
  /** 是否可关闭。 */
  closable?: boolean;
  /** 点击回调。 */
  onClick?: () => void;
  /** 关闭回调。 */
  onClose?: () => void;
};

/**
 * 编辑器标签栏属性。
 */
export type EditorTabsProps = {
  /** 标签集合。 */
  tabs: EditorTabItem[];
  /** 视觉预设。 */
  preset?: LayoutPreset;
  /** 右侧附加区。 */
  trailing?: React.ReactNode;
  /** 自定义样式。 */
  style?: React.CSSProperties;
};

/**
 * 编辑器标签栏。
 *
 * @param props 标签栏属性。
 * @returns 标签栏视图。
 */
export function EditorTabs(props: EditorTabsProps) {
  const { tabs, preset = 'default', trailing, style } = props;
  const chromeStyles = getLayoutPresetStyles(preset);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        gap: 8,
        minHeight: 36,
        background: chromeStyles.toolbarBackground,
        borderBottom: `1px solid ${chromeStyles.borderColor}`,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 0, overflowX: 'auto' }}>
        {tabs.map((tab) => {
          const active = Boolean(tab.active);

          return (
            <div
              key={tab.id}
              onClick={tab.onClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
                padding: '0 12px',
                borderRight: `1px solid ${chromeStyles.borderColor}`,
                borderTop: active ? `2px solid ${chromeStyles.accentColor}` : '2px solid transparent',
                background: active ? chromeStyles.panelBackground : chromeStyles.sectionBackground,
                color: active ? chromeStyles.textPrimary : chromeStyles.textSecondary,
                cursor: tab.onClick ? 'pointer' : 'default',
                userSelect: 'none',
                fontSize: 12,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.label}</span>
              {tab.dirty ? <span style={{ color: chromeStyles.accentColor, fontSize: 10 }}>●</span> : null}
              {tab.closable ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    tab.onClose?.();
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: 0,
                    lineHeight: 1,
                    fontSize: 12,
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {trailing ? <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px' }}>{trailing}</div> : null}
    </div>
  );
}