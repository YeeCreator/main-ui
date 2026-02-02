import React, { useMemo, useState } from 'react';
import type { CopyField, ScreenAction, SidebarControl, SidebarModel } from './types';

function copy(text: string) {
  try {
    void navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

function ControlView({ control }: { control: SidebarControl }) {
  if (control.kind === 'select') {
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{control.label}</div>
        <select
          value={control.value}
          onChange={(e) => control.onChange(e.target.value)}
          disabled={control.disabled}
          style={{ height: 28 }}
        >
          {control.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (control.kind === 'radio') {
    const groupName = `radio:${control.id ?? control.label}`;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{control.label}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {control.options.map((o) => {
            const checked = o.value === control.value;
            return (
              <label key={o.value} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input
                  type="radio"
                  name={groupName}
                  value={o.value}
                  checked={checked}
                  disabled={control.disabled}
                  onChange={() => control.onChange(o.value)}
                />
                <span>{o.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  // segmented
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{control.label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {control.options.map((o) => {
          const selected = o.value === control.value;
          return (
            <button
              key={`${control.id ?? control.label}:${o.value}`}
              onClick={() => control.onChange(o.value)}
              disabled={control.disabled}
              type="button"
              style={{
                border: selected ? '2px solid rgba(0,0,0,0.6)' : '1px solid rgba(0,0,0,0.3)',
                padding: '4px 8px',
                background: selected ? 'rgba(0,0,0,0.05)' : 'transparent',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
                onClick={() => {
                  copy(f.value);
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
  model: SidebarModel;
  width?: number;
};

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
