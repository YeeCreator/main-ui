import React from 'react';

export type PanelProps = {
  /** 面板标题 */
  title?: string;
  /** 右上角区域（例如按钮） */
  actions?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

/**
 * 通用面板容器。
 *
 * 设计目标：
 * - 让“侧栏里的分组块”在不同宿主项目中保持一致的外观与间距；
 * - 宿主只负责提供内容与交互，不再自己实现 .panel/.panel h3 等样式。
 */
export function Panel(props: PanelProps) {
  const { title, actions, children, style } = props;

  return (
    <section
      style={{
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 10,
        padding: 12,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {title ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>{title}</div>
          {actions ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div> : null}
        </div>
      ) : null}

      <div style={{ minWidth: 0 }}>{children}</div>
    </section>
  );
}
