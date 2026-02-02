import React from 'react';

export type ToolbarProps = {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
};

export function Toolbar(props: ToolbarProps) {
  const { left, center, right } = props;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 12px',
        borderBottom: '1px solid rgba(127,127,127,0.25)',
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(8px)',
        position: 'relative',
        zIndex: 1,
        userSelect: 'none',
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
