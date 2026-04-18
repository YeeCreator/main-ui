import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { getLayoutPresetStyles, type LayoutPreset } from '../tokens';

/**
 * 检查器字段定义。
 */
export type InspectorField = {
  /** 字段键。 */
  name: string;
  /** 字段标签。 */
  label: string;
  /** 输入控件类型。 */
  kind: 'text' | 'number';
  /** 可选占位提示。 */
  placeholder?: string;
};

/**
 * 检查器表单面板属性。
 */
export type InspectorFormPanelProps = {
  /** 面板标题。 */
  title?: string;
  /** 字段定义。 */
  fields: InspectorField[];
  /** 初始值对象。 */
  initialValues: Record<string, string | number>;
  /** 提交回调。 */
  onSubmitValues: (values: Record<string, string | number>) => void;
  /** 外层样式。 */
  style?: React.CSSProperties;
  /** 视觉预设。 */
  preset?: LayoutPreset;
};

/**
 * 检查器表单面板（react-hook-form + zod 语义壳层）。
 *
 * @param props 表单面板属性。
 * @returns 检查器表单组件。
 */
export function InspectorFormPanel(props: InspectorFormPanelProps): React.JSX.Element {
  const { title = '属性编辑', fields, initialValues, onSubmitValues, style, preset = 'default' } = props;
  const chromeStyles = getLayoutPresetStyles(preset);

  const schemaShape: Record<string, z.ZodType<string | number>> = {};
  for (const field of fields) {
    schemaShape[field.name] = field.kind === 'number' ? z.coerce.number() : z.string().min(0);
  }

  const formSchema = z.object(schemaShape);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<Record<string, unknown>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
    mode: 'onBlur',
  });

  React.useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

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

      <form
        onSubmit={handleSubmit((values) => {
          const normalized: Record<string, string | number> = {};
          for (const field of fields) {
            const raw = values[field.name];
            if (field.kind === 'number') {
              normalized[field.name] = typeof raw === 'number' ? raw : Number(raw ?? 0);
            } else {
              normalized[field.name] = typeof raw === 'string' ? raw : String(raw ?? '');
            }
          }
          onSubmitValues(normalized);
        })}
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {fields.map((field) => (
          <label key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: chromeStyles.textPrimary }}>{field.label}</span>
            <input
              aria-label={field.label}
              type={field.kind === 'number' ? 'number' : 'text'}
              placeholder={field.placeholder}
              {...register(field.name, {
                valueAsNumber: field.kind === 'number',
              })}
              style={{
                height: 32,
                borderRadius: 8,
                border: `1px solid ${chromeStyles.controlBorder}`,
                padding: '0 10px',
                fontSize: 13,
                background: chromeStyles.controlBackground,
                color: chromeStyles.controlText,
              }}
            />
            {errors[field.name] ? <span style={{ fontSize: 12, color: '#cc0000' }}>字段校验失败</span> : null}
          </label>
        ))}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="submit"
            disabled={!isDirty}
            style={{ border: `1px solid ${chromeStyles.controlSelectedBorder}`, background: chromeStyles.controlSelectedBackground, color: chromeStyles.controlText, borderRadius: 8, padding: '6px 10px' }}
          >
            保存
          </button>
          <button
            type="button"
            onClick={() => reset(initialValues)}
            style={{ border: `1px solid ${chromeStyles.controlBorder}`, background: chromeStyles.controlBackground, color: chromeStyles.controlText, borderRadius: 8, padding: '6px 10px' }}
          >
            重置
          </button>
        </div>
      </form>
    </section>
  );
}
