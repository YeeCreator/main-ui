import { computed, defineComponent, h, ref, watch, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import { computeRunControlAvailability, normalizeRunControlStatus, parseRate } from './state';
import {
  DEFAULT_RUN_CONTROL_RATE_BOUNDS,
  type RunControlAvailability,
  type RunControlViewState,
} from './types';

/**
 * RunControlView —— 通用运行控制视图模板（运行/暂停/单步/重置/速率）。
 *
 * 运行态经 Props 注入，操作以意图经 Emits 抛出（play / pause / step / reset / rate-change）；
 * 视图不发起任何请求，也不假设宿主领域。颜色一律消费 --mui-* 变量。
 */

const STATUS_COLOR: Record<string, string> = {
  idle: 'var(--mui-color-text-muted)',
  running: 'var(--mui-color-success)',
  paused: 'var(--mui-color-warning)',
};

export const RunControlView = defineComponent({
  name: 'RunControlView',
  props: {
    /** 运行状态（未知值归一到 idle 呈现）。 */
    status: { type: String as PropType<string>, default: 'idle' },
    /** 速率数值（tick/s）。 */
    rate: { type: Number, default: 1 },
    /** 当前帧/步计数。 */
    tick: { type: Number, default: 0 },
    /** 后端连接态：false 时全部操作禁用。 */
    connected: { type: Boolean, default: true },
    /** 宿主是否支持重置（能力位）。 */
    canReset: { type: Boolean, default: true },
    /** 速率是否可编辑。 */
    rateEditable: { type: Boolean, default: true },
    /** 速率边界。 */
    rateBounds: { type: Object as PropType<Partial<typeof DEFAULT_RUN_CONTROL_RATE_BOUNDS>>, default: () => ({}) },
    /** 显式覆盖可用性（缺省则据 connected/canReset/rateEditable 计算）。 */
    availability: { type: Object as PropType<RunControlAvailability | null>, default: null },
    /** 状态标签本地化文本（可选）。 */
    statusLabel: { type: String as PropType<string | null>, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    editorInstanceId: { type: String, default: null },
  },
  emits: ['play', 'pause', 'step', 'reset', 'rate-change'],
  setup(props, { emit }) {
    const bounds = computed(() => ({ ...DEFAULT_RUN_CONTROL_RATE_BOUNDS, ...props.rateBounds }));
    const status = computed(() => normalizeRunControlStatus(props.status));
    const availability = computed<RunControlAvailability>(
      () =>
        props.availability ??
        computeRunControlAvailability({
          connected: props.connected,
          canReset: props.canReset,
          rateEditable: props.rateEditable,
        }),
    );

    // ---------- 本地呈现状态（进视图状态契约） ----------
    const rateDraft = ref(String(props.rate));
    // 宿主速率变化时同步草稿（避免用户输入被外部覆盖：仅在非编辑聚焦时回写）
    watch(
      () => props.rate,
      (next) => {
        rateDraft.value = String(next);
      },
    );

    let destroyed = false;

    const commitRate = () => {
      const next = parseRate(rateDraft.value, props.rate, bounds.value.min, bounds.value.max);
      rateDraft.value = String(next);
      if (next !== props.rate) emit('rate-change', next);
    };

    // ---------- 视图生命周期契约（四成员，onDestroy 幂等） ----------
    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-run-control',
      getViewState: (): RunControlViewState => ({ rateDraft: rateDraft.value }),
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<RunControlViewState>;
        if (typeof snapshot.rateDraft === 'string') rateDraft.value = snapshot.rateDraft;
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
      display: 'flex', flexWrap: 'wrap', alignItems: 'center',
      gap: 'var(--mui-density-gap-compact, 6px)',
      padding: 'var(--mui-density-gap, 8px)',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
    } as const;

    const buttonStyle = (enabled: boolean) => ({
      padding: '3px 12px', fontSize: '12px',
      cursor: enabled ? 'pointer' : 'not-allowed',
      opacity: enabled ? '1' : '0.5',
      border: '1px solid var(--mui-color-border)', borderRadius: 'var(--mui-radius)',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
    });

    const metaStyle = { fontSize: '11px', color: 'var(--mui-color-text-muted)' } as const;

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-run-control', style: { ...rootStyle, display: 'grid', placeItems: 'center' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-run-control', style: { ...rootStyle, display: 'grid', placeItems: 'center', color: 'var(--mui-color-danger)' } }, props.error);
      }

      const av = availability.value;
      const controlButton = (label: string, enabled: boolean, event: 'play' | 'pause' | 'step' | 'reset') =>
        h('button', {
          class: ['main-ui-view-run-control__btn', `is-${event}`],
          type: 'button',
          disabled: !enabled,
          style: buttonStyle(enabled),
          onClick: () => { if (enabled) emit(event); },
        }, label);

      return h('div', { class: 'main-ui-view-run-control', style: rootStyle }, [
        controlButton('运行', av.play, 'play'),
        controlButton('暂停', av.pause, 'pause'),
        controlButton('单步', av.step, 'step'),
        controlButton('重置', av.reset, 'reset'),
        h('label', { class: 'main-ui-view-run-control__rate', style: { display: 'flex', alignItems: 'center', gap: '4px', ...metaStyle } }, [
          h('span', {}, '速率'),
          h('input', {
            type: 'number',
            min: bounds.value.min,
            max: bounds.value.max,
            step: bounds.value.step,
            disabled: !av.rateEditable,
            style: {
              width: '72px', padding: '2px 6px', fontSize: '12px',
              border: '1px solid var(--mui-color-border)', borderRadius: 'var(--mui-radius)',
              background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
              opacity: av.rateEditable ? '1' : '0.5',
            },
            value: rateDraft.value,
            onInput: (event: Event) => { rateDraft.value = (event.target as HTMLInputElement).value; },
            onChange: commitRate,
          }),
        ]),
        h('span', {
          class: 'main-ui-view-run-control__status',
          style: { ...metaStyle, color: STATUS_COLOR[status.value] ?? metaStyle.color },
          'data-status': status.value,
        }, props.statusLabel ?? status.value),
        h('span', { class: 'main-ui-view-run-control__tick', style: metaStyle }, `tick ${props.tick}`),
      ]);
    };
  },
});
