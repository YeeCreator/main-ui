import React, { useMemo, useState } from 'react';
import * as RadioGroup from '@radix-ui/react-radio-group';
import * as Select from '@radix-ui/react-select';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import type { CopyField, ScreenAction, SidebarControl, SidebarModel } from './types';

/**
 * 写入剪贴板。
 *
 * @param text 需要复制的文本。
 */
async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

/**
 * 侧栏控件渲染器。
 *
 * @param props 控件渲染参数。
 * @returns 控件视图。
 */
function ControlView({ control }: { control: SidebarControl }) {
  if (control.kind === 'select') {
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{control.label}</div>
        <Select.Root value={control.value} onValueChange={control.onChange} disabled={control.disabled}>
          <Select.Trigger
            aria-label={control.label}
            style={{
              height: 30,
              border: '1px solid rgba(0,0,0,0.2)',
              borderRadius: 8,
              padding: '0 10px',
              background: '#fff',
              fontSize: 13,
              textAlign: 'left',
            }}
          >
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Content
              position="popper"
              sideOffset={6}
              style={{
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 8,
                background: '#fff',
                padding: 4,
                boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                zIndex: 100,
              }}
            >
              <Select.Viewport>
                {control.options.map((o) => (
                  <Select.Item
                    key={o.value}
                    value={o.value}
                    style={{
                      fontSize: 13,
                      lineHeight: 1,
                      borderRadius: 6,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <Select.ItemText>{o.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </label>
    );
  }

  if (control.kind === 'radio') {
    const groupName = `radio:${control.id ?? control.label}`;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{control.label}</div>
        <RadioGroup.Root
          name={groupName}
          value={control.value}
          onValueChange={control.onChange}
          disabled={control.disabled}
          style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
        >
          {control.options.map((o) => {
            const checked = o.value === control.value;
            return (
              <label key={o.value} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                <RadioGroup.Item
                  value={o.value}
                  aria-label={o.label}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    border: '1px solid rgba(0,0,0,0.4)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
                <span style={{ fontWeight: checked ? 700 : 500 }}>{o.label}</span>
              </label>
            );
          })}
        </RadioGroup.Root>
      </div>
    );
  }

  // segmented
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{control.label}</div>
      <ToggleGroup.Root
        type="single"
        value={control.value}
        onValueChange={(value) => {
          if (value) {
            control.onChange(value);
          }
        }}
        disabled={control.disabled}
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
      >
        {control.options.map((o) => {
          const selected = o.value === control.value;
          return (
            <ToggleGroup.Item
              key={`${control.id ?? control.label}:${o.value}`}
              value={o.value}
              aria-label={o.label}
              style={{
                border: selected ? '2px solid rgba(0,0,0,0.6)' : '1px solid rgba(0,0,0,0.3)',
                padding: '4px 8px',
                background: selected ? 'rgba(0,0,0,0.05)' : 'transparent',
                borderRadius: 8,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {o.label}
            </ToggleGroup.Item>
          );
        })}
      </ToggleGroup.Root>
    </div>
  );
}

/**
 * 操作按钮区。
 *
 * @param props 操作区参数。
 * @returns 操作按钮视图。
 */
function ActionsView({ actions }: { actions: ScreenAction[] }) {
  return actions.length ? (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {actions.map((a, i) => (
        <button key={a.id ?? `${a.label}-${i}`} type="button" onClick={a.onClick} disabled={a.disabled}>
          {a.label}
        </button>
      ))}
    </div>
  ) : null;
}

/**
 * 可复制字段区。
 *
 * @param props 复制字段参数。
 * @returns 复制字段视图。
 */
function CopyFieldsView({ copyFields }: { copyFields: CopyField[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {copyFields.map((f) => {
        const displayLines = f.value.split('\n');
        const canCopy = f.value.trim().length > 0;
        const valueFontFamily = f.monospace
          ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
          : undefined;

        return (
          <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{f.label}</div>

            {f.multiline ? (
              <textarea
                readOnly
                value={f.value}
                style={{
                  width: '100%',
                  height: 220,
                  fontFamily: valueFontFamily,
                  fontSize: 12,
                }}
              />
            ) : (
              <div style={{ fontFamily: valueFontFamily, fontSize: 12 }}>
                {displayLines.map((x, idx) => (
                  <div key={idx}>{x}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                disabled={!canCopy}
                onClick={async () => {
                  await copy(f.value);
                  setCopied(f.label);
                  window.setTimeout(() => setCopied(null), 900);
                }}
              >
                复制 {f.label}
              </button>
              {copied === f.label ? <span style={{ fontSize: 12 }}>已复制</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type SidebarProps = {
  /** 侧栏视图模型。 */
  model: SidebarModel;
  /** 侧栏宽度。 */
  width?: number;
};

/**
 * 通用侧栏语义壳层。
 *
 * @param props 侧栏属性。
 * @returns 侧栏组件。
 */
export function Sidebar(props: SidebarProps) {
  const { model, width = 300 } = props;

  const sections = useMemo(() => model.sections ?? [], [model.sections]);

  return (
    <div
      style={{
        width,
        padding: 12,
        borderLeft: '1px solid rgba(0,0,0,0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontWeight: 700 }}>{model.title ?? '对局信息'}</div>

      {sections.map((sec) => (
        <div
          key={sec.id}
          style={{
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 8,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 13 }}>{sec.title}</div>

          {sec.statusText ? <div style={{ fontSize: 13, lineHeight: 1.4 }}>{sec.statusText}</div> : null}

          {sec.controls?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sec.controls.map((c) => (
                <ControlView key={c.id ?? `${c.kind}:${c.label}`} control={c} />
              ))}
            </div>
          ) : null}

          {sec.actions ? <ActionsView actions={sec.actions} /> : null}
          {sec.copyFields ? <CopyFieldsView copyFields={sec.copyFields} /> : null}
          {sec.footerHint ? <div style={{ marginTop: 2, fontSize: 12, opacity: 0.75 }}>{sec.footerHint}</div> : null}
        </div>
      ))}
    </div>
  );
}
