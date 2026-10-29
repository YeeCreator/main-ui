/**
 * SettingsEditor —— 官方设置页（schema 驱动 + 内置外观区块）。
 *
 * 两层内容：
 *
 * 1. **外观**（内置）：主题模式「浅色 / 深色 / 跟随系统」。主题是每个宿主都有的
 *    MUI 核心状态（`document.theme`），不属于业务设置，因此不交给宿主各画一遍。
 *    此前该区块由多个宿主各自复制（同一份 101 行组件在 5 个仓里 md5 完全一致）。
 * 2. **业务设置**（schema 驱动）：宿主经 `settings.registerSchema` 注册的项。
 *
 * 两层都受搜索框与分类筛选控制（外观区块的分类固定为「外观」）。
 */
import { computed, defineComponent, h, ref } from 'vue';
import type { JsonValue, SettingScope } from '../../core';
import { APPEARANCE_CATEGORY, matchAppearance, THEME_MODES, type SettingSchema, type ThemeMode } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';
import { useThemeMode } from '../composables/useThemeMode';

/** 主题模式的显示文案。 */
const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
};

/** 读取系统是否偏好深色（非浏览器环境按浅色处理）。 */
const systemPrefersDark = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export const SettingsEditor = defineComponent({
  name: 'SettingsEditor',
  props: {
    scope: { type: String as () => SettingScope, default: 'user' },
    workspaceId: String,
    profileId: String,
    /**
     * 是否展示内置的「外观（主题模式）」区块。默认 `true`。
     *
     * 宿主自建主题 UI 时置 `false`，但**不建议** —— 主题切换必须经
     * `theme/setMode` 才能与布局快照保持同步。
     */
    showAppearance: { type: Boolean, default: true },
  },
  setup(props) {
    const { runtime } = useWorkbench();
    // 主题读写走 composable：它已处理 resolvedMode（漏传会让 system 不跟随系统）。
    const { themeMode, setThemeMode } = useThemeMode();
    const query = ref('');
    const category = ref<string>();
    const errors = ref<Record<string, string>>({});

    const schemas = computed(() => runtime.core.settings.search(query.value, category.value));
    const categories = computed(() => [
      ...new Set(runtime.core.settings.listSchemas().map((schema) => schema.category).filter(Boolean) as string[]),
    ]);

    /** 外观区块是否应显示（判定逻辑在 core 内，可单测）。 */
    const showAppearance = computed(() => matchAppearance({
      enabled: props.showAppearance,
      query: query.value,
      category: category.value,
    }));

    /** 分类下拉的选项：外观（若启用）与业务分类合并去重。 */
    const allCategories = computed(() => {
      const list = props.showAppearance ? [APPEARANCE_CATEGORY, ...categories.value] : [...categories.value];
      return [...new Set(list)];
    });

    const value = (schema: SettingSchema) =>
      runtime.core.settings.get(schema.id, { workspaceId: props.workspaceId, profileId: props.profileId });

    const update = async (schema: SettingSchema, raw: JsonValue) => {
      const result = runtime.core.settings.set({
        id: schema.id,
        value: raw,
        scope: props.scope,
        workspaceId: props.workspaceId,
        profileId: props.profileId,
      });
      if (!result.ok) {
        errors.value[schema.id] = result.error.message;
      } else {
        delete errors.value[schema.id];
        await runtime.core.settings.save();
      }
    };

    const control = (schema: SettingSchema) => {
      const current = value(schema);
      if (schema.type === 'boolean') {
        return h('input', {
          type: 'checkbox',
          checked: current === true,
          onChange: (e: Event) => void update(schema, (e.target as HTMLInputElement).checked),
        });
      }
      if (schema.type === 'enum') {
        return h('select', {
          value: String(current),
          onChange: (e: Event) => void update(schema, (e.target as HTMLSelectElement).value),
        }, schema.enumValues?.map((option) => h('option', { value: option.value }, option.label)));
      }
      return h('input', {
        type: schema.type === 'number' ? 'number' : schema.type === 'color' ? 'color' : 'text',
        value: String(current ?? ''),
        min: schema.min,
        max: schema.max,
        step: schema.step,
        onChange: (e: Event) => {
          const input = e.target as HTMLInputElement;
          void update(schema, schema.type === 'number' ? Number(input.value) : input.value);
        },
      });
    };

    /** 内置外观区块：主题模式下拉。 */
    const appearanceSection = () => h('label', { class: 'main-ui-setting-row' }, [
      h('span', [
        h('strong', '主题模式'),
        h('small', '浅色 / 深色 / 跟随系统'),
      ]),
      h('select', {
        value: themeMode.value,
        onChange: (e: Event) => setThemeMode((e.target as HTMLSelectElement).value as ThemeMode),
      }, THEME_MODES.map((mode) => h('option', { value: mode }, THEME_MODE_LABELS[mode]))),
    ]);

    const schemaRow = (schema: SettingSchema) => h('label', { class: 'main-ui-setting-row', key: schema.id }, [
      h('span', [
        h('strong', schema.title),
        schema.description ? h('small', schema.description) : null,
        errors.value[schema.id] ? h('em', errors.value[schema.id]) : null,
      ]),
      control(schema),
      h('button', {
        type: 'button',
        onClick: () => {
          void runtime.core.settings.reset(schema.id, {
            scope: props.scope,
            workspaceId: props.workspaceId,
            profileId: props.profileId,
          });
        },
      }, 'Reset'),
    ]);

    return () => h('section', { class: 'main-ui-settings-editor' }, [
      h('header', { class: 'main-ui-settings-editor__toolbar' }, [
        h('input', {
          value: query.value,
          placeholder: 'Search settings',
          onInput: (e: Event) => { query.value = (e.target as HTMLInputElement).value; },
        }),
        allCategories.value.length
          ? h('select', {
            value: category.value,
            onChange: (e: Event) => { category.value = (e.target as HTMLSelectElement).value || undefined; },
          }, [
            h('option', { value: '' }, 'All categories'),
            ...allCategories.value.map((item) => h('option', { value: item }, item)),
          ])
          : null,
      ]),
      h('div', { class: 'main-ui-settings-editor__list' }, [
        ...(showAppearance.value ? [appearanceSection()] : []),
        ...schemas.value.map(schemaRow),
      ]),
    ]);
  },
});
