import { computed, defineComponent, h, ref } from 'vue';
import type { JsonValue, SettingSchema, SettingScope } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';

export const SettingsEditor = defineComponent({
  name: 'SettingsEditor',
  props: { scope: { type: String as () => SettingScope, default: 'user' }, workspaceId: String, profileId: String },
  setup(props) {
    const { runtime } = useWorkbench(); const query = ref(''); const category = ref<string>(); const errors = ref<Record<string, string>>({});
    const schemas = computed(() => runtime.core.settings.search(query.value, category.value));
    const categories = computed(() => [...new Set(runtime.core.settings.listSchemas().map((schema) => schema.category).filter(Boolean) as string[])]);
    const value = (schema: SettingSchema) => runtime.core.settings.get(schema.id, { workspaceId: props.workspaceId, profileId: props.profileId });
    const update = async (schema: SettingSchema, raw: JsonValue) => { const result = runtime.core.settings.set({ id: schema.id, value: raw, scope: props.scope, workspaceId: props.workspaceId, profileId: props.profileId }); if (!result.ok) errors.value[schema.id] = result.error.message; else { delete errors.value[schema.id]; await runtime.core.settings.save(); } };
    const control = (schema: SettingSchema) => { const current = value(schema); if (schema.type === 'boolean') return h('input', { type: 'checkbox', checked: current === true, onChange: (e: Event) => void update(schema, (e.target as HTMLInputElement).checked) }); if (schema.type === 'enum') return h('select', { value: String(current), onChange: (e: Event) => void update(schema, (e.target as HTMLSelectElement).value) }, schema.enumValues?.map((option) => h('option', { value: option.value }, option.label))); return h('input', { type: schema.type === 'number' ? 'number' : schema.type === 'color' ? 'color' : 'text', value: String(current ?? ''), min: schema.min, max: schema.max, step: schema.step, onChange: (e: Event) => { const input = e.target as HTMLInputElement; void update(schema, schema.type === 'number' ? Number(input.value) : input.value); } }); };
    return () => h('section', { class: 'main-ui-settings-editor' }, [h('header', { class: 'main-ui-settings-editor__toolbar' }, [h('input', { value: query.value, placeholder: 'Search settings', onInput: (e: Event) => { query.value = (e.target as HTMLInputElement).value; } }), categories.value.length ? h('select', { value: category.value, onChange: (e: Event) => { category.value = (e.target as HTMLSelectElement).value || undefined; } }, [h('option', { value: '' }, 'All categories'), ...categories.value.map((item) => h('option', { value: item }, item))]) : null]), h('div', { class: 'main-ui-settings-editor__list' }, schemas.value.map((schema) => h('label', { class: 'main-ui-setting-row', key: schema.id }, [h('span', [h('strong', schema.title), schema.description ? h('small', schema.description) : null, errors.value[schema.id] ? h('em', errors.value[schema.id]) : null]), control(schema), h('button', { type: 'button', onClick: () => { void runtime.core.settings.reset(schema.id, { scope: props.scope, workspaceId: props.workspaceId, profileId: props.profileId }); } }, 'Reset')])))]);
  },
});
