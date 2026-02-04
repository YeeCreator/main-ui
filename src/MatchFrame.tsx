import React from 'react';

export type MatchFrameSidebarOptions = {
  /** 侧栏宽度（px）。不传时使用默认值。 */
  width?: number;
  /** 侧栏是否独立滚动。默认 true。 */
  scroll?: boolean;
  /** 侧栏内边距（px）。不传时使用默认值。 */
  padding?: number;
  /** 背景色（CSS color）。不传时使用默认值。 */
  background?: string;
  /** 是否显示分隔线（边框）。默认 true。 */
  bordered?: boolean;
};

export type MatchFrameLayoutOptions = {
  /** 外层高度策略。默认 'viewport'，表示 100vh；如宿主已控制高度，可传 'parent' 使用 100%。 */
  heightMode?: 'viewport' | 'parent';
  /** 左侧栏选项 */
  leftSidebar?: MatchFrameSidebarOptions;
  /** 右侧栏选项 */
  rightSidebar?: MatchFrameSidebarOptions;
};

export type MatchFrameProps = {
  toolbar?: React.ReactNode;
  leftSidebar?: React.ReactNode;
  rightSidebar?: React.ReactNode;
  center: React.ReactNode;
  style?: React.CSSProperties;
  /** 布局参数：用于宿主按需定制主界面壳，而不修改内部实现 */
  layout?: MatchFrameLayoutOptions;
};

export function MatchFrame(props: MatchFrameProps) {
  const { toolbar, leftSidebar, rightSidebar, center, style, layout } = props;

  const heightMode = layout?.heightMode ?? 'viewport';

  const leftWidth = layout?.leftSidebar?.width;
  const rightWidth = layout?.rightSidebar?.width;

  const leftScroll = layout?.leftSidebar?.scroll ?? true;
  const rightScroll = layout?.rightSidebar?.scroll ?? true;

  const leftPadding = layout?.leftSidebar?.padding ?? 12;
  const rightPadding = layout?.rightSidebar?.padding ?? 12;

  const leftBg = layout?.leftSidebar?.background ?? 'rgba(255,255,255,0.92)';
  const rightBg = layout?.rightSidebar?.background ?? 'rgba(255,255,255,0.92)';

  const leftBordered = layout?.leftSidebar?.bordered ?? true;
  const rightBordered = layout?.rightSidebar?.bordered ?? true;

  const mkSidebarStyle = (
    width: number | undefined,
    scroll: boolean,
    padding: number,
    background: string,
    bordered: boolean,
    side: 'left' | 'right'
  ): React.CSSProperties => ({
    flex: '0 0 auto',
    width,
    height: '100%',
    overflowY: scroll ? 'auto' : 'hidden',
    overflowX: 'hidden',
    overscrollBehavior: 'contain',
    padding,
    boxSizing: 'border-box',
    background,
    borderRight: side === 'left' && bordered ? '1px solid rgba(0,0,0,0.10)' : undefined,
    borderLeft: side === 'right' && bordered ? '1px solid rgba(0,0,0,0.10)' : undefined,
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 0,
        height: heightMode === 'viewport' ? '100vh' : '100%',
        overflow: 'hidden',
        ...style,
      }}
    >
      {toolbar ? <div style={{ flex: '0 0 auto' }}>{toolbar}</div> : null}

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, flex: '1 1 auto', minHeight: 0, minWidth: 0 }}>
        {leftSidebar ? (
          <div style={mkSidebarStyle(leftWidth, leftScroll, leftPadding, leftBg, leftBordered, 'left')}>{leftSidebar}</div>
        ) : null}

        {/*
          关键修复：center 必须可以伸缩（flex:1），否则当中心内容比较宽时会把右侧栏挤出视口。
          同时需要 minWidth:0 才能允许内容正常收缩并触发内部 overflow。
        */}
        <div style={{ flex: '1 1 auto', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>{center}</div>

        {rightSidebar ? (
          <div style={mkSidebarStyle(rightWidth, rightScroll, rightPadding, rightBg, rightBordered, 'right')}>
            {rightSidebar}
          </div>
        ) : null}
      </div>
    </div>
  );
}
