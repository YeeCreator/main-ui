import { computed, defineComponent, h, ref, watch, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import {
  evaluateVisibility,
  validateFormValues,
  type FormApplyPresetIntentPayload,
  type FormArrayField,
  type FormChangePayload,
  type FormField,
  type FormGroup,
  type FormSavePresetIntentPayload,
  type FormSchema,
  type FormSubmitPayload,
  type FormValidationResult,
  type FormValues,
} from '@main-ui/core';
import { applyArrayIntent, coerceFieldValue, resolveFieldValue, type ArrayIntent } from './form';
import type { FormViewState } from './types';

/**
 * FormView —— schema 驱动分组表单模板（配置面板 / 动态表单）。
 * 数据经 Props 注入（含 loading / error 三态），操作意图一律经 Emits 抛出；
 * 校验仅呈现（字段级错误提示），是否阻断由宿主裁决；颜色一律消费 --mui-* 变量。
 */
export const FormView = defineComponent({
  name: 'FormView',
  props: {
    schema: { type: Object as PropType<FormSchema>, required: true },
    values: { type: Object as PropType<FormValues | null>, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    /** 预设模板名称列表（由宿主注入；视图不接触存储） */
    presets: { type: Array as PropType<string[]>, default: () => [] },
    /** 预设模板条（选择/应用/保存）开关 */
    presetsEnabled: { type: Boolean, default: true },
    submitLabel: { type: String, default: 'Submit' },
    editorInstanceId: { type: String, default: null },
  },
  emits: ['change', 'submit', 'save-preset-intent', 'apply-preset-intent'],
  setup(props, { emit }) {
    // ---------- 内部值表（受控 Props 变化时同步） ----------
    const internalValues = ref<FormValues>(props.values ? { ...props.values } : {});
    watch(() => props.values, (value) => {
      if (value) internalValues.value = { ...value };
    }, { deep: true });

    const scrollEl = ref<HTMLElement | null>(null);
    const scrollTop = ref(0);
    let destroyed = false;

    // ---------- 校验呈现：提交尝试后全量提示；此前仅提示已交互字段 ----------
    const submitted = ref(false);
    const touched = ref<Record<string, boolean>>({});
    const validation = computed<FormValidationResult>(() => validateFormValues(props.schema, internalValues.value));
    const visibleError = (key: string): string | null => {
      if (!submitted.value && !touched.value[key]) return null;
      return validation.value.errors[key]?.message ?? null;
    };

    const presetName = ref('');
    const selectedPreset = ref('');

    const resolve = (field: FormField): unknown => resolveFieldValue(field, internalValues.value);

    /** 字段是否可见（消费 core 纯函数，宿主用 visibleWhen 声明条件显隐）。 */
    const isVisible = (field: FormField): boolean => evaluateVisibility(field, internalValues.value);

    // ---------- 变更意图（一律经 Emits 抛出，携带旧值） ----------
    const commit = (field: FormField, raw: unknown) => {
      if (field.disabled) return;
      touched.value = { ...touched.value, [field.key]: true };
      const previous = resolve(field);
      if (field.kind === 'number' && raw === '') return; // 空输入保留原值
      const value = coerceFieldValue(field, raw, previous);
      if (Object.is(value, previous)) return;
      internalValues.value = { ...internalValues.value, [field.key]: value };
      const payload: FormChangePayload = { key: field.key, value, previous };
      emit('change', payload);
    };

    // ---------- 提交 / 预设意图 ----------
    const submit = () => {
      submitted.value = true;
      const result: FormSubmitPayload = { values: { ...internalValues.value }, valid: validation.value.valid };
      emit('submit', result);
    };

    const applyPreset = () => {
      if (!selectedPreset.value) return;
      const payload: FormApplyPresetIntentPayload = { name: selectedPreset.value };
      emit('apply-preset-intent', payload);
    };

    const savePreset = () => {
      const name = presetName.value.trim();
      if (!name) return;
      const payload: FormSavePresetIntentPayload = { name, values: { ...internalValues.value } };
      emit('save-preset-intent', payload);
      presetName.value = '';
    };

    // ---------- 视图生命周期契约（四成员，onDestroy 幂等） ----------
    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-form',
      getViewState: (): FormViewState => ({
        values: { ...internalValues.value },
        scrollTop: scrollEl.value?.scrollTop ?? scrollTop.value,
      }),
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<FormViewState>;
        if (snapshot.values && typeof snapshot.values === 'object') {
          internalValues.value = { ...snapshot.values };
        }
        if (typeof snapshot.scrollTop === 'number' && scrollEl.value) {
          scrollEl.value.scrollTop = snapshot.scrollTop;
        }
      },
      onDestroy: () => {
        destroyed = true;
      },
    };
    if (props.editorInstanceId) {
      useViewLifecycle(props.editorInstanceId, () => lifecycle);
    }

    // ---------- 样式（颜色全部消费 --mui-* 变量） ----------
    const rootStyle = {
      width: '100%', height: '100%', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
    } as const;

    const labelStyle = {
      fontSize: '12px', color: 'var(--mui-color-text-muted)',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    } as const;

    const controlBaseStyle = {
      width: '100%', padding: '3px 6px', fontSize: '12px', outline: 'none',
      border: '1px solid var(--mui-color-border)', borderRadius: 'var(--mui-radius)',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
    } as const;

    const buttonStyle = {
      padding: '4px 12px', fontSize: '12px', cursor: 'pointer',
      border: '1px solid var(--mui-color-border)', borderRadius: 'var(--mui-radius)',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
    } as const;

    const renderControl = (field: FormField) => {
      const value = resolve(field);
      const disabled = Boolean(field.disabled);
      const invalid = Boolean(visibleError(field.key));
      const border = invalid ? '1px solid var(--mui-color-danger)' : controlBaseStyle.border;
      switch (field.kind) {
        case 'string':
          return h('input', {
            type: 'text', style: { ...controlBaseStyle, border }, disabled,
            placeholder: field.placeholder ?? '', value: String(value ?? ''),
            onInput: (event: Event) => commit(field, (event.target as HTMLInputElement).value),
          });
        case 'textarea':
          return h('textarea', {
            style: { ...controlBaseStyle, border, resize: 'vertical', minHeight: '48px' }, disabled,
            rows: field.rows ?? 3, placeholder: field.placeholder ?? '', value: String(value ?? ''),
            onInput: (event: Event) => commit(field, (event.target as HTMLTextAreaElement).value),
          });
        case 'number':
          return h('input', {
            type: 'number', style: { ...controlBaseStyle, border }, disabled,
            min: field.min, max: field.max, step: field.step, value: String(value ?? ''),
            onInput: (event: Event) => commit(field, (event.target as HTMLInputElement).value),
          });
        case 'boolean':
          return h('input', {
            type: 'checkbox', style: { accentColor: 'var(--mui-color-accent)' }, disabled,
            checked: Boolean(value),
            onChange: (event: Event) => commit(field, (event.target as HTMLInputElement).checked),
          });
        case 'select':
          return h('select', {
            style: { ...controlBaseStyle, border }, disabled, value: String(value ?? ''),
            onChange: (event: Event) => commit(field, (event.target as HTMLSelectElement).value),
          }, field.options.map((option) => h('option', { key: option.value, value: option.value }, option.label)));
        case 'array':
          return renderArrayControl(field);
      }
    };

    /**
     * 数组字段控件：动态增删行，每行内嵌 `itemFields` 定义的子控件。
     *
     * 子控件变更一律折叠为单个 `change` 意图（key 为数组字段 key，value 为整表新数组），
     * 保持与其它字段一致的意图形状 —— 宿主无需为数组字段写第二套消费逻辑。
     */
    const renderArrayControl = (field: FormArrayField) => {
      const raw = resolve(field);
      const items = Array.isArray(raw) ? (raw as FormValues[]) : [];
      const disabled = Boolean(field.disabled);
      const canRemove = !disabled && (field.minItems === undefined || items.length > field.minItems);
      const canAppend = !disabled && (field.maxItems === undefined || items.length < field.maxItems);

      // 数组意图统一在此提交：形状与普通字段一致（key + 新值 + 旧值）
      const commitArray = (intent: ArrayIntent) => {
        if (disabled) return;
        const next = applyArrayIntent(field, items, intent);
        if (next === items) return; // 越界：不产生意图
        touched.value = { ...touched.value, [field.key]: true };
        const previous = resolve(field);
        internalValues.value = { ...internalValues.value, [field.key]: next };
        const payload: FormChangePayload = { key: field.key, value: next, previous };
        emit('change', payload);
      };

      const renderItemField = (sub: FormField, index: number) => {
        if (!evaluateVisibility(sub, items[index] ?? {})) return null;
        const itemValue = items[index]?.[sub.key];
        const onInput = (rawInput: unknown) => {
          const coerced = coerceFieldValue(sub, rawInput, itemValue);
          commitArray({ type: 'patch', index, item: { ...items[index], [sub.key]: coerced } });
        };
        const subStyle = { ...controlBaseStyle, border: controlBaseStyle.border };
        let control: unknown;
        switch (sub.kind) {
          case 'string':
            control = h('input', {
              type: 'text', style: subStyle, disabled,
              placeholder: sub.placeholder ?? '', value: String(itemValue ?? ''),
              onInput: (event: Event) => onInput((event.target as HTMLInputElement).value),
            });
            break;
          case 'textarea':
            control = h('textarea', {
              style: { ...subStyle, resize: 'vertical', minHeight: '40px' }, disabled,
              rows: sub.rows ?? 2, placeholder: sub.placeholder ?? '', value: String(itemValue ?? ''),
              onInput: (event: Event) => onInput((event.target as HTMLTextAreaElement).value),
            });
            break;
          case 'number':
            control = h('input', {
              type: 'number', style: subStyle, disabled,
              min: sub.min, max: sub.max, step: sub.step, value: String(itemValue ?? ''),
              onInput: (event: Event) => onInput((event.target as HTMLInputElement).value),
            });
            break;
          case 'boolean':
            control = h('input', {
              type: 'checkbox', style: { accentColor: 'var(--mui-color-accent)' }, disabled,
              checked: Boolean(itemValue),
              onChange: (event: Event) => onInput((event.target as HTMLInputElement).checked),
            });
            break;
          case 'select':
            control = h('select', {
              style: subStyle, disabled, value: String(itemValue ?? ''),
              onChange: (event: Event) => onInput((event.target as HTMLSelectElement).value),
            }, sub.options.map((option) => h('option', { key: option.value, value: option.value }, option.label)));
            break;
          default:
            // 嵌套数组不支持：schema 嵌套由宿主拆成独立字段，避免无限递归
            control = h('div', { style: { ...labelStyle, paddingTop: '4px' } }, '（嵌套数组不支持）');
        }
        return h('div', {
          key: `${sub.key}-${index}`,
          style: { display: 'grid', gridTemplateColumns: '32% 1fr', gap: '6px', alignItems: 'start' },
        }, [
          h('div', { style: { ...labelStyle, paddingTop: '4px' }, title: sub.description ?? sub.label }, sub.label),
          control as never,
        ]);
      };

      return h('div', {
        class: 'main-ui-view-form__array',
        style: { display: 'flex', flexDirection: 'column', gap: '6px' },
      }, [
        ...items.map((_item, index) => h('div', {
          key: `row-${index}`,
          class: 'main-ui-view-form__array-row',
          style: {
            border: '1px solid var(--mui-color-border)', borderRadius: 'var(--mui-radius)',
            padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px',
            background: 'var(--mui-color-panel)',
          },
        }, [
          h('div', {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
          }, [
            h('span', { style: { ...labelStyle, fontSize: '11px' } }, `#${index + 1}`),
            h('button', {
              type: 'button',
              class: 'main-ui-view-form__array-remove',
              style: { ...buttonStyle, padding: '1px 8px', fontSize: '11px' },
              disabled: !canRemove,
              onClick: () => commitArray({ type: 'remove', index }),
            }, '删除'),
          ]),
          ...field.itemFields.map((sub) => renderItemField(sub, index)),
        ])),
        h('button', {
          type: 'button',
          class: 'main-ui-view-form__array-append',
          style: { ...buttonStyle, alignSelf: 'flex-start', padding: '2px 10px', fontSize: '11px' },
          disabled: !canAppend,
          onClick: () => commitArray({ type: 'append' }),
        }, '＋ 添加一项'),
      ]);
    };

    const renderFieldRow = (field: FormField) => {
      if (!isVisible(field)) return null;
      const message = visibleError(field.key);
      return h('div', {
        key: field.key,
        class: 'main-ui-view-form__row',
        style: { display: 'grid', gridTemplateColumns: '32% 1fr', alignItems: 'start', gap: '8px', marginBottom: '8px' },
      }, [
        h('div', { style: { ...labelStyle, paddingTop: '5px' }, title: field.description ?? field.label }, field.label),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } }, [
          renderControl(field),
          message ? h('div', {
            class: 'main-ui-view-form__error',
            style: { fontSize: '11px', color: 'var(--mui-color-danger)' },
          }, message) : null,
        ]),
      ]);
    };

    const renderGroup = (group: FormGroup) => h('fieldset', {
      key: group.id,
      class: 'main-ui-view-form__group',
      style: {
        border: '1px solid var(--mui-color-border)', borderRadius: 'var(--mui-radius)',
        padding: '8px 10px', marginBottom: '10px',
      },
    }, [
      h('legend', { style: { fontSize: '12px', fontWeight: 600, padding: '0 4px' } }, group.title),
      group.description ? h('div', { style: { ...labelStyle, marginBottom: '6px' } }, group.description) : null,
      ...group.fields.map(renderFieldRow),
    ]);

    const groups = computed<FormGroup[]>(() => {
      if (props.schema.groups && props.schema.groups.length > 0) return props.schema.groups;
      const fields = props.schema.fields ?? [];
      return fields.length > 0 ? [{ id: 'default', title: '', fields }] : [];
    });

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-form', style: { ...rootStyle, placeItems: 'center', display: 'grid' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-form', style: { ...rootStyle, placeItems: 'center', display: 'grid', color: 'var(--mui-color-danger)' } }, props.error);
      }

      return h('div', { class: 'main-ui-view-form', style: rootStyle }, [
        h('div', {
          class: 'main-ui-view-form__body',
          ref: scrollEl,
          style: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px' },
          onScroll: (event: Event) => { scrollTop.value = (event.target as HTMLElement).scrollTop; },
        }, groups.value.length === 0
          ? h('div', { style: { padding: '16px', color: 'var(--mui-color-text-muted)', textAlign: 'center' } }, 'No fields')
          : groups.value.map((group) => (group.title ? renderGroup(group) : h('div', { key: group.id }, group.fields.map(renderFieldRow))))),
        h('div', {
          class: 'main-ui-view-form__footer',
          style: {
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 10px', borderTop: '1px solid var(--mui-color-border)',
          },
        }, [
          props.presetsEnabled ? h('select', {
            class: 'main-ui-view-form__preset-select',
            style: { ...controlBaseStyle, width: 'auto', flex: 1 },
            title: 'Apply preset', value: selectedPreset.value,
            onChange: (event: Event) => { selectedPreset.value = (event.target as HTMLSelectElement).value; },
          }, [
            h('option', { value: '' }, 'Presets…'),
            ...props.presets.map((name) => h('option', { key: name, value: name }, name)),
          ]) : null,
          props.presetsEnabled ? h('button', {
            class: 'main-ui-view-form__preset-apply',
            type: 'button', style: buttonStyle, title: 'Apply selected preset',
            disabled: !selectedPreset.value, onClick: applyPreset,
          }, 'Apply') : null,
          props.presetsEnabled ? h('input', {
            class: 'main-ui-view-form__preset-name',
            type: 'text', style: { ...controlBaseStyle, width: 'auto', flex: 1 },
            placeholder: 'New preset name', value: presetName.value,
            onInput: (event: Event) => { presetName.value = (event.target as HTMLInputElement).value; },
            onKeydown: (event: KeyboardEvent) => { if (event.key === 'Enter') savePreset(); },
          }) : null,
          props.presetsEnabled ? h('button', {
            class: 'main-ui-view-form__preset-save',
            type: 'button', style: buttonStyle, title: 'Save current values as preset',
            disabled: !presetName.value.trim(), onClick: savePreset,
          }, 'Save') : null,
          h('button', {
            class: 'main-ui-view-form__submit',
            type: 'button',
            style: { ...buttonStyle, borderColor: 'var(--mui-color-accent)', color: 'var(--mui-color-accent)', marginLeft: 'auto' },
            onClick: submit,
          }, props.submitLabel),
        ]),
      ]);
    };
  },
});
