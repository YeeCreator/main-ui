import React from 'react';

export type MatchFrameProps = {
  toolbar?: React.ReactNode;
  leftSidebar?: React.ReactNode;
  rightSidebar?: React.ReactNode;
  center: React.ReactNode;
  style?: React.CSSProperties;
};

export function MatchFrame(props: MatchFrameProps) {
  const { toolbar, leftSidebar, rightSidebar, center, style } = props;

  const scrollPaneStyle: React.CSSProperties = {
    flex: '0 0 auto',
    height: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
    overscrollBehavior: 'contain',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 0,
        height: '100vh',
        overflow: 'hidden',
        ...style,
      }}
    >
      {toolbar ? <div style={{ flex: '0 0 auto' }}>{toolbar}</div> : null}

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, flex: '1 1 auto', minHeight: 0 }}>
        {leftSidebar ? <div style={scrollPaneStyle}>{leftSidebar}</div> : null}
        <div style={{ flex: '0 0 auto' }}>{center}</div>
        {rightSidebar ? <div style={scrollPaneStyle}>{rightSidebar}</div> : null}
      </div>
    </div>
  );
}
