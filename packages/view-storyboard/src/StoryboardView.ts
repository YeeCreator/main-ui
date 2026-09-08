import { computed, defineComponent, h, ref, watch, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import type { StoryboardCard, StoryboardViewState } from './types';

/**
 * StoryboardView —— 通用分镜/截图/注释视图模板。
 *
 * 卡片经 Props 注入，增删改以意图经 Emits 抛出（add-card / remove-card / update-note / update-draft / export）；
 * 截图（image）由宿主在 add-card 回调中生成回填，视图不自行截图，也不假设宿主领域。
 * 颜色一律消费 --mui-* 变量。
 */
export const StoryboardView = defineComponent({
  name: 'StoryboardView',
  props: {
    /** 分镜卡片列表。 */
    cards: { type: Array as PropType<StoryboardCard[]>, default: () => [] },
    /** 新增卡片注释草稿（宿主可受控注入）。 */
    draftNote: { type: String, default: '' },
    /** 是否呈现「添加分镜」按钮。 */
    addEnabled: { type: Boolean, default: true },
    /** 是否呈现「导出」按钮。 */
    exportEnabled: { type: Boolean, default: true },
    /** 按钮文本本地化。 */
    addLabel: { type: String, default: '添加分镜' },
    exportLabel: { type: String, default: '导出 JSON' },
    draftPlaceholder: { type: String, default: '当前帧注释' },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    editorInstanceId: { type: String, default: null },
  },
  emits: ['add-card', 'remove-card', 'update-note', 'update-draft', 'export'],
  setup(props, { emit }) {
    const cards = computed(() => props.cards ?? []);

    // ---------- 本地呈现状态（进视图状态契约） ----------
    const draftNote = ref(props.draftNote);
    watch(() => props.draftNote, (next) => { draftNote.value = next; });

    let destroyed = false;

    const onDraftInput = (event: Event) => {
      draftNote.value = (event.target as HTMLTextAreaElement).value;
      emit('update-draft', draftNote.value);
    };
    const addCard = () => {
      emit('add-card', { note: draftNote.value.trim() });
      draftNote.value = '';
      emit('update-draft', '');
    };
    const onNoteChange = (id: string, event: Event) => {
      emit('update-note', id, (event.target as HTMLInputElement).value);
    };

    // ---------- 视图生命周期契约（四成员，onDestroy 幂等） ----------
    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-storyboard',
      getViewState: (): StoryboardViewState => ({ draftNote: draftNote.value }),
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<StoryboardViewState>;
        if (typeof snapshot.draftNote === 'string') draftNote.value = snapshot.draftNote;
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
      width: '100%', height: '100%', boxSizing: 'border-box', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', gap: 'var(--mui-density-gap-compact, 6px)',
      padding: 'var(--mui-density-gap, 8px)',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
    } as const;
    const buttonStyle = (enabled: boolean) => ({
      padding: '2px 10px', fontSize: '11px',
      cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? '1' : '0.5',
      border: '1px solid var(--mui-color-border)', borderRadius: 'var(--mui-radius)',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
    });
    const metaStyle = { fontSize: '11px', color: 'var(--mui-color-text-muted)' } as const;

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-storyboard', style: { ...rootStyle, display: 'grid', placeItems: 'center' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-storyboard', style: { ...rootStyle, display: 'grid', placeItems: 'center', color: 'var(--mui-color-danger)' } }, props.error);
      }

      const canAdd = props.addEnabled;
      const canExport = props.exportEnabled && cards.value.length > 0;

      const cardItems = cards.value.map((card) =>
        h('li', {
          key: card.id,
          class: 'main-ui-view-storyboard__card',
          style: {
            display: 'flex', gap: '8px', alignItems: 'flex-start',
            padding: '6px', border: '1px solid var(--mui-color-border)',
            borderRadius: 'var(--mui-radius)', background: 'var(--mui-color-panel)',
          },
        }, [
          card.image
            ? h('img', { src: card.image, alt: `storyboard ${card.tick}`, style: { width: '72px', height: 'auto', flexShrink: 0, borderRadius: 'var(--mui-radius)' } })
            : null,
          h('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' } }, [
            h('span', { style: metaStyle }, `tick ${card.tick}`),
            h('input', {
              class: 'main-ui-view-storyboard__note',
              type: 'text',
              value: card.note,
              placeholder: '注释',
              style: {
                width: '100%', padding: '2px 6px', fontSize: '12px',
                border: '1px solid var(--mui-color-border)', borderRadius: 'var(--mui-radius)',
                background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
              },
              onChange: (event: Event) => onNoteChange(card.id, event),
            }),
          ]),
          h('button', {
            class: 'main-ui-view-storyboard__remove',
            type: 'button', style: buttonStyle(true), title: '移除分镜',
            onClick: () => emit('remove-card', card.id),
          }, '×'),
        ]),
      );

      return h('div', { class: 'main-ui-view-storyboard', style: rootStyle }, [
        h('textarea', {
          class: 'main-ui-view-storyboard__draft',
          placeholder: props.draftPlaceholder,
          value: draftNote.value,
          style: {
            flexShrink: 0, width: '100%', minHeight: '48px', resize: 'vertical',
            padding: '4px 6px', fontSize: '12px', fontFamily: 'inherit',
            border: '1px solid var(--mui-color-border)', borderRadius: 'var(--mui-radius)',
            background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
          },
          onInput: onDraftInput,
        }),
        h('div', { class: 'main-ui-view-storyboard__actions', style: { display: 'flex', gap: '8px', flexShrink: 0 } }, [
          h('button', {
            class: 'main-ui-view-storyboard__add',
            type: 'button', disabled: !canAdd, style: buttonStyle(canAdd),
            onClick: () => { if (canAdd) addCard(); },
          }, props.addLabel),
          h('button', {
            class: 'main-ui-view-storyboard__export',
            type: 'button', disabled: !canExport, style: buttonStyle(canExport),
            onClick: () => { if (canExport) emit('export'); },
          }, props.exportLabel),
          h('span', { style: { ...metaStyle, marginLeft: 'auto', alignSelf: 'center' } }, `${cards.value.length} 张`),
        ]),
        h('ol', {
          class: 'main-ui-view-storyboard__list',
          style: { flex: 1, minHeight: 0, overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' },
        }, cards.value.length === 0
          ? [h('li', { key: 'empty', style: { ...metaStyle, textAlign: 'center', padding: '16px' } }, '暂无分镜')]
          : cardItems),
      ]);
    };
  },
});
