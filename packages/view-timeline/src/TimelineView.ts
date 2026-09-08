import { computed, defineComponent, h, ref, watch, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import {
  clampIndex,
  computeTimelineProgress,
  computeTimelineTotalTicks,
  formatTimelineTime,
  resolveTimelineFrame,
} from './state';
import type { TimelineFrame, TimelineViewState } from './types';

/**
 * TimelineView —— 通用时间轴/回放视图模板（帧序列 + 拖拽定位）。
 *
 * 帧数据经 Props 注入，定位以意图经 Emits 抛出（scrub 拖拽中 / seek 提交 / live 回到实时）；
 * 视图不发起任何请求，也不假设宿主领域。颜色一律消费 --mui-* 变量。
 */
export const TimelineView = defineComponent({
  name: 'TimelineView',
  props: {
    /** 帧序列（按时间递增）。 */
    frames: { type: Array as PropType<TimelineFrame[]>, default: () => [] },
    /** 当前定位帧索引；null = 实时（跟随最新帧）。 */
    currentIndex: { type: Number as PropType<number | null>, default: null },
    /** 覆盖的总 tick 数（缺省则据末帧推导）。 */
    totalTicks: { type: Number as PropType<number | null>, default: null },
    /** 「实时」指示文本（本地化）。 */
    liveLabel: { type: String, default: '实时' },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    editorInstanceId: { type: String, default: null },
  },
  emits: ['seek', 'scrub', 'live'],
  setup(props, { emit }) {
    const count = computed(() => props.frames.length);
    const totalTicks = computed(() => props.totalTicks ?? computeTimelineTotalTicks(props.frames));
    const isLive = computed(() => props.currentIndex === null);
    const sliderValue = computed(() => (props.currentIndex === null ? Math.max(0, count.value - 1) : clampIndex(props.currentIndex, count.value)));
    const currentFrame = computed(() => resolveTimelineFrame(props.frames, props.currentIndex));
    const progress = computed(() => computeTimelineProgress(props.currentIndex, count.value));

    // ---------- 本地呈现状态（进视图状态契约） ----------
    const localIndex = ref<number | null>(props.currentIndex);
    watch(() => props.currentIndex, (next) => { localIndex.value = next; });

    let destroyed = false;

    const onScrub = (event: Event) => {
      const index = clampIndex(Number((event.target as HTMLInputElement).value), count.value);
      localIndex.value = index;
      emit('scrub', index);
    };
    const onSeek = (event: Event) => {
      const index = clampIndex(Number((event.target as HTMLInputElement).value), count.value);
      localIndex.value = index;
      emit('seek', index);
    };
    const goLive = () => {
      localIndex.value = null;
      emit('live');
    };

    // ---------- 视图生命周期契约（四成员，onDestroy 幂等） ----------
    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-timeline',
      getViewState: (): TimelineViewState => ({ currentIndex: localIndex.value }),
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<TimelineViewState>;
        if (snapshot.currentIndex === null) localIndex.value = null;
        else if (typeof snapshot.currentIndex === 'number') localIndex.value = clampIndex(snapshot.currentIndex, count.value);
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
      width: '100%', height: '100%', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: 'var(--mui-density-gap-compact, 6px)',
      padding: 'var(--mui-density-gap, 8px)',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
    } as const;
    const metaStyle = { fontSize: '11px', color: 'var(--mui-color-text-muted)' } as const;
    const buttonStyle = {
      padding: '2px 10px', fontSize: '11px', cursor: 'pointer',
      border: '1px solid var(--mui-color-border)', borderRadius: 'var(--mui-radius)',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
    } as const;

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-timeline', style: { ...rootStyle, display: 'grid', placeItems: 'center' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-timeline', style: { ...rootStyle, display: 'grid', placeItems: 'center', color: 'var(--mui-color-danger)' } }, props.error);
      }
      if (count.value === 0) {
        return h('div', { class: 'main-ui-view-timeline', style: { ...rootStyle, ...metaStyle, justifyContent: 'center' } }, '暂无帧');
      }

      const frame = currentFrame.value;
      const time = frame ? formatTimelineTime(frame.time) : '';
      const label = frame?.label ?? '';

      return h('div', { class: 'main-ui-view-timeline', style: rootStyle }, [
        h('input', {
          class: 'main-ui-view-timeline__scrubber',
          type: 'range',
          min: 0,
          max: Math.max(0, count.value - 1),
          step: 1,
          value: sliderValue.value,
          style: { width: '100%', accentColor: 'var(--mui-color-accent)' },
          onInput: onScrub,
          onChange: onSeek,
        }),
        h('div', { class: 'main-ui-view-timeline__meta', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
          h('button', {
            class: ['main-ui-view-timeline__live', isLive.value ? 'is-active' : ''],
            type: 'button',
            style: { ...buttonStyle, color: isLive.value ? 'var(--mui-color-accent)' : buttonStyle.color },
            title: '回到实时（跟随最新帧）',
            onClick: goLive,
          }, props.liveLabel),
          h('span', { style: metaStyle }, `帧 ${sliderValue.value + 1} / ${count.value}`),
          frame ? h('span', { style: metaStyle }, `tick ${frame.tick}`) : null,
          time ? h('span', { style: metaStyle }, time) : null,
          label ? h('span', { style: { ...metaStyle, color: 'var(--mui-color-text)' } }, label) : null,
          h('span', { style: { ...metaStyle, marginLeft: 'auto' } }, `共 ${totalTicks.value} tick · ${Math.round(progress.value * 100)}%`),
        ]),
      ]);
    };
  },
});
