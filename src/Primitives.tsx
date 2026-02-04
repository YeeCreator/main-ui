import React from 'react';

type CommonProps = {
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

export type StackProps = CommonProps & {
  gap?: number;
  align?: React.CSSProperties['alignItems'];
};

/** 通用纵向栈，用于统一侧栏/面板内的垂直排版。 */
export function Stack(props: StackProps) {
  const { children, gap = 10, align = 'stretch', style } = props;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, alignItems: align, ...style }}>{children}</div>
  );
}

export type RowProps = CommonProps & {
  gap?: number;
  align?: React.CSSProperties['alignItems'];
  justify?: React.CSSProperties['justifyContent'];
  wrap?: boolean;
};

/** 通用横向行，用于工具条/按钮组/提示行。 */
export function Row(props: RowProps) {
  const { children, gap = 8, align = 'center', justify = 'flex-start', wrap = false, style } = props;
  return (
    <div
      style={{
        display: 'flex',
        gap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'ghost';
  size?: 'sm' | 'md';
};

/** 通用按钮样式（避免宿主项目重复定义按钮外观）。 */
export function Button(props: ButtonProps) {
  const { variant = 'solid', size = 'md', style, ...rest } = props;
  const padding = size === 'sm' ? '4px 8px' : '6px 10px';
  const borderColor = variant === 'ghost' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.15)';
  const background = variant === 'ghost' ? 'transparent' : 'rgba(255,255,255,0.95)';

  return (
    <button
      type="button"
      {...rest}
      style={{
        border: `1px solid ${borderColor}`,
        background,
        color: '#111',
        borderRadius: 8,
        padding,
        cursor: 'pointer',
        ...style,
      }}
    />
  );
}

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: number;
};

/** 图标按钮（用于设置齿轮等）。 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(props, ref) {
  const { size = 36, style, ...rest } = props;
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        border: '1px solid rgba(0, 0, 0, 0.12)',
        background: 'rgba(255, 255, 255, 0.92)',
        color: '#111',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    />
  );
});

export type ToolbarTitleProps = CommonProps;

/** 工具条标题样式。 */
export function ToolbarTitle(props: ToolbarTitleProps) {
  const { children, style } = props;
  return <strong style={{ fontSize: 14, fontWeight: 700, ...style }}>{children}</strong>;
}

/** 工具条分隔线。 */
export function ToolbarSeparator() {
  return <span style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.12)', margin: '0 2px' }} />;
}

export type ToolbarLabelProps = {
  label: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

/** 工具条字段标签（例如颜色选择器）。 */
export function ToolbarLabel(props: ToolbarLabelProps) {
  const { label, children, style } = props;
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#333', ...style }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export type MutedTextProps = CommonProps & {
  size?: number;
};

/** 弱提示文本。 */
export function MutedText(props: MutedTextProps) {
  const { children, size = 12, style } = props;
  return (
    <span style={{ fontSize: size, color: '#666', ...style }}>{children}</span>
  );
}

export type ListProps = CommonProps;

/** 通用列表容器。 */
export function List(props: ListProps) {
  const { children, style } = props;
  return <ul style={{ listStyle: 'none', padding: 0, margin: 0, ...style }}>{children}</ul>;
}

export type ListItemProps = CommonProps & {
  onClick?: () => void;
  selected?: boolean;
};

/** 通用列表项（支持选中态与点击）。 */
export function ListItem(props: ListItemProps) {
  const { children, onClick, selected = false, style } = props;
  const clickable = Boolean(onClick);

  return (
    <li
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      style={{
        padding: '8px 10px',
        borderRadius: 8,
        cursor: clickable ? 'pointer' : 'default',
        background: selected ? 'rgba(0,0,0,0.05)' : 'transparent',
        border: '1px solid rgba(0,0,0,0.06)',
        ...style,
      }}
    >
      {children}
    </li>
  );
}

export type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  monospace?: boolean;
};

/** 统一的文本域样式（可选等宽字体）。 */
export function TextArea(props: TextAreaProps) {
  const { monospace = false, style, ...rest } = props;
  return (
    <textarea
      {...rest}
      style={{
        width: '100%',
        minHeight: 120,
        boxSizing: 'border-box',
        border: '1px solid #ccc',
        borderRadius: 6,
        padding: 8,
        fontFamily: monospace
          ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
          : undefined,
        fontSize: 12,
        lineHeight: 1.4,
        background: '#fff',
        color: '#222',
        resize: 'none',
        ...style,
      }}
    />
  );
}

export type FieldLabelProps = {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

/** 表单标签与控件组合。 */
export function FieldLabel(props: FieldLabelProps) {
  const { label, children, style } = props;
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, ...style }}>
      <span style={{ color: '#333', fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

export type InfoRowProps = {
  label: string;
  value: React.ReactNode;
  style?: React.CSSProperties;
};

/** 只读信息行（键/值）。 */
export function InfoRow(props: InfoRowProps) {
  const { label, value, style } = props;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12, ...style }}>
      <div style={{ minWidth: 72, color: '#666' }}>{label}</div>
      <div style={{ color: '#111' }}>{value}</div>
    </div>
  );
}

export type ContentShellProps = CommonProps;

/** 主内容区容器（中心区域）。 */
export function ContentShell(props: ContentShellProps) {
  const { children, style } = props;
  return (
    <div
      style={{
        flex: 1,
        background: '#fff',
        padding: 20,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export type ErrorTextProps = CommonProps;

/** 错误提示文本。 */
export function ErrorText(props: ErrorTextProps) {
  const { children, style } = props;
  return <div style={{ color: '#c00', fontSize: 12, ...style }}>{children}</div>;
}
