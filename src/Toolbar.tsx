import React from 'react';
import { getLayoutPresetStyles, type LayoutPreset } from './tokens';

export type ToolbarProps = {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  /** 工具条视觉预设。 */
  preset?: LayoutPreset;
  /** 是否使用半透明毛玻璃效果。 */
  translucent?: boolean;
};

export function Toolbar(props: ToolbarProps) {
  const { left, center, right, preset = 'default', translucent = true } = props;
  const chromeStyles = getLayoutPresetStyles(preset);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 12px',
        borderBottom: `1px solid ${chromeStyles.borderColor}`,
        background: chromeStyles.toolbarBackground,
        backdropFilter: translucent ? 'blur(8px)' : undefined,
        position: 'relative',
        zIndex: 1,
        userSelect: 'none',
        color: preset === 'vscodium' ? '#f3f3f3' : '#111111',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>{left}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 0, flex: 1 }}>
        {center}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>{right}</div>
    </div>
  );
}
