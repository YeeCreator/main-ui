import { computed, defineComponent, h, ref, watch, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import { coerceFieldValue, resolveFieldValue } from './inspector';
import type { InspectorChangePayload, InspectorField, InspectorSchema, InspectorValues, InspectorViewState } from './types';

/**
 * InspectorView —— schema 驱动的属性检查器模板。
 * 数据经 Props 注入（含 loading / error 三态），变更意图经 Emits 抛出；颜色一律消费 --mui-* 变量。
 */
export const InspectorView = defineComponent({
  name: 'InspectorView',
  props: {
    schema: { type: Array as PropType<InspectorSchema>, required: true },
    values: { type: Object as PropType<InspectorValues | null>, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    editorInstanceId: { type: String, default: null },
  },
  emits: ['change'],
  setup(props, { emit }) {
    // ---------- 内部值表（受控 Props 变化时同步） ----------
    const internalValues = ref<InspectorValues>(props.values ? { ...props.values } : {});
    watch(() => props.values, (value) => {
      if (value) internalValues.value = { ...value };
    }, { deep: true });

    const scrollEl = ref<HTMLElement | null>(null);
    const scrollTop = ref(0);
    let destroyed = false;

    const resolve = (field: InspectorField): unknown => resolveFieldValue(field, internalValues.value);

    // ---------- 变更意图（一律经 Emits 抛出，携带旧值） ----------
    const commit = (field: InspectorField, raw: unknown) => {
      if (field.disabled) return;
      const previous = resolve(field);
      if (field.kind === 'number' && raw === '') return; // 空输入保留原值
      const value = coerceFieldValue(field, raw, previous);
      if (Object.is(value, previous)) return;
      internalValues.value = { ...internalValues.value, [field.key]: value };
      const payload: InspectorChangePayload = { key: field.key, value, previous };
      emit('change', payload);
    };

    // ---------- 视图生命周期契约（四成员，onDestroy 幂等） ----------
    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-inspector',
      getViewState: (): InspectorViewState => ({
        values: { ...internalValues.value },
        scrollTop: scrollEl.value?.scrollTop ?? scrollTop.value,
      }),
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<InspectorViewState>;
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

    const renderControl = (field: InspectorField) => {
      const value = resolve(field);
      const disabled = Boolean(field.disabled);
      switch (field.kind) {
        case 'string':
          return h('input', {
            type: 'text', style: controlBaseStyle, disabled,
            placeholder: field.placeholder ?? '', value: String(value ?? ''),
            onInput: (event: Event) => commit(field, (event.target as HTMLInputElement).value),
          });
        case 'number':
          return h('input', {
            type: 'number', style: controlBaseStyle, disabled,
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
            style: controlBaseStyle, disabled, value: String(value ?? ''),
            onChange: (event: Event) => commit(field, (event.target as HTMLSelectElement).value),
          }, field.options.map((option) => h('option', { key: option.value, value: option.value }, option.label)));
      }
    };

    const fields = computed(() => props.schema);

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-inspector', style: { ...rootStyle, placeItems: 'center', display: 'grid' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-inspector', style: { ...rootStyle, placeItems: 'center', display: 'grid', color: 'var(--mui-color-danger)' } }, props.error);
      }

      return h('div', { class: 'main-ui-view-inspector', style: rootStyle }, [
        h('div', {
          class: 'main-ui-view-inspector__body',
          ref: scrollEl,
          style: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px' },
          onScroll: (event: Event) => { scrollTop.value = (event.target as HTMLElement).scrollTop; },
        }, fields.value.length === 0
          ? h('div', { style: { padding: '16px', color: 'var(--mui-color-text-muted)', textAlign: 'center' } }, 'Nothing selected')
          : fields.value.map((field) => h('div', {
            key: field.key,
            class: 'main-ui-view-inspector__row',
            style: { display: 'grid', gridTemplateColumns: '40% 1fr', alignItems: 'center', gap: '8px', marginBottom: '6px' },
          }, [
            h('div', { style: labelStyle, title: field.description ?? field.label }, field.label),
            renderControl(field),
          ]))),
      ]);
    };
  },
});
