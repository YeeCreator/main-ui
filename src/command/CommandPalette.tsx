import React from 'react';
import { Command } from 'cmdk';
import { getLayoutPresetStyles, type LayoutPreset } from '../tokens';

/**
 * 命令项定义。
 */
export type CommandPaletteItem = {
  /** 命令唯一标识。 */
  id: string;
  /** 命令展示标题。 */
  label: string;
  /** 命令匹配关键字。 */
  keywords?: string[];
  /** 是否禁用命令。 */
  disabled?: boolean;
  /** 命令触发回调。 */
  onSelect?: (item: CommandPaletteItem) => void;
};

/**
 * 命令面板属性。
 */
export type CommandPaletteProps = {
  /** 面板标题。 */
  title?: string;
  /** 输入框占位文本。 */
  placeholder?: string;
  /** 空数据文案。 */
  emptyText?: string;
  /** 命令项集合。 */
  items: CommandPaletteItem[];
  /** 默认选中命令 ID。 */
  defaultSelectedId?: string;
  /** 选中命令变更回调。 */
  onSelectedIdChange?: (id: string) => void;
  /** 外层样式。 */
  style?: React.CSSProperties;
  /** 视觉预设。 */
  preset?: LayoutPreset;
};

/**
 * 命令面板（cmdk 语义壳层）。
 *
 * @param props 命令面板属性。
 * @returns 命令面板组件。
 *
 * @example
 * ```tsx
 * <CommandPalette
 *   title="命令"
 *   items={[
 *     { id: 'save', label: '保存文件', onSelect: () => console.log('保存') },
 *     { id: 'open', label: '打开资源' },
 *   ]}
 * />
 * ```
 */
export function CommandPalette(props: CommandPaletteProps): React.JSX.Element {
  const {
    title = '命令面板',
    placeholder = '输入命令...',
    emptyText = '没有匹配命令',
    items,
    defaultSelectedId,
    onSelectedIdChange,
    style,
    preset = 'default',
  } = props;
  const chromeStyles = getLayoutPresetStyles(preset);

  const [selectedId, setSelectedId] = React.useState<string | undefined>(defaultSelectedId);

  return (
    <section
      style={{
        border: `1px solid ${chromeStyles.borderColor}`,
        borderRadius: 10,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: chromeStyles.panelBackground,
        color: chromeStyles.textPrimary,
        ...style,
      }}
    >
      <strong style={{ fontSize: 14, color: chromeStyles.textPrimary }}>{title}</strong>

      <Command
        loop
        style={{
          border: `1px solid ${chromeStyles.borderColor}`,
          borderRadius: 8,
          overflow: 'hidden',
          background: chromeStyles.sectionBackground,
        }}
      >
        <Command.Input
          placeholder={placeholder}
          style={{
            width: '100%',
            border: 'none',
            borderBottom: `1px solid ${chromeStyles.borderColor}`,
            height: 34,
            padding: '0 10px',
            fontSize: 13,
            outline: 'none',
            background: chromeStyles.controlBackground,
            color: chromeStyles.controlText,
          }}
        />
        <Command.List style={{ maxHeight: 240, overflow: 'auto', padding: 6 }}>
          <Command.Empty style={{ fontSize: 12, color: chromeStyles.textSecondary, padding: '8px 6px' }}>{emptyText}</Command.Empty>
          {items.map((item) => (
            <Command.Item
              key={item.id}
              value={`${item.id} ${item.label}`}
              keywords={item.keywords}
              disabled={item.disabled}
              onSelect={() => {
                setSelectedId(item.id);
                onSelectedIdChange?.(item.id);
                item.onSelect?.(item);
              }}
              style={{
                borderRadius: 6,
                padding: '7px 8px',
                fontSize: 13,
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                background: selectedId === item.id ? chromeStyles.controlSelectedBackground : 'transparent',
                color: item.disabled ? chromeStyles.textSecondary : chromeStyles.textPrimary,
              }}
            >
              {item.label}
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </section>
  );
}
