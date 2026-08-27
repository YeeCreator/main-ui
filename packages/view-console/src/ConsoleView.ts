import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import { computeConsoleRowWindow, filterEntries, formatTimestamp, isAtBottom, normalizeLevel } from './console';
import { CONSOLE_LEVELS, DEFAULT_CONSOLE_ROW_HEIGHT, type ConsoleEntry, type ConsoleLevel, type ConsoleViewState } from './types';

/**
 * ConsoleView —— 自研虚拟滚动控制台/日志追加列表模板。
 * 条目经 Props 注入（含 loading / error 三态），清空以意图经 Emits 抛出；
 * 等级过滤与文本过滤为视图本地呈现行为；颜色一律消费 --mui-* 变量。
 */

/** 等级 → 主题语义色（无对应语义的等级回退正文色）。 */
const LEVEL_COLOR: Record<ConsoleLevel, string> = {
  debug: 'var(--mui-color-text-muted)',
  info: 'var(--mui-color-text)',
  warn: 'var(--mui-color-warning)',
  error: 'var(--mui-color-danger)',
  success: 'var(--mui-color-success)',
};

export const ConsoleView = defineComponent({
  name: 'ConsoleView',
  props: {
    /** 日志条目（追加式；宿主侧维护上限与取数） */
    entries: { type: Array as PropType<ConsoleEntry[]>, default: () => [] },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    /** 是否呈现清空按钮（清空行为本身永远以意图抛出） */
    clearEnabled: { type: Boolean, default: true },
    rowHeight: { type: Number, default: DEFAULT_CONSOLE_ROW_HEIGHT },
    editorInstanceId: { type: String, default: null },
  },
  emits: ['clear-intent'],
  setup(props, { emit }) {
    // ---------- 本地呈现状态（进视图状态契约） ----------
    const autoScroll = ref(true);
    const levels = ref<ConsoleLevel[]>([]);
    const query = ref('');

    // ---------- 虚拟滚动 ----------
    const viewportEl = ref<HTMLElement | null>(null);
    const scrollTop = ref(0);
    const viewportHeight = ref(0);
    let resizeObserver: ResizeObserver | null = null;
    let destroyed = false;
    // 程序化滚动标记：避免自身触发的 scroll 事件回写 autoScroll（追加流下会与跟随互踩）
    let programmaticScroll = false;

    const filteredEntries = computed(() => filterEntries(props.entries ?? [], levels.value, query.value));
    const virtual = computed(() => computeConsoleRowWindow(scrollTop.value, viewportHeight.value, props.rowHeight, filteredEntries.value.length));

    onMounted(() => {
      if (viewportEl.value) {
        viewportHeight.value = viewportEl.value.clientHeight;
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            if (viewportEl.value) viewportHeight.value = viewportEl.value.clientHeight;
          });
          resizeObserver.observe(viewportEl.value);
        }
      }
    });
    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      resizeObserver = null;
    });

    // 双帧等待：第一帧让新增行进入布局，第二帧读取最终 scrollHeight 再贴底
    const scrollToBottom = () => {
      if (!viewportEl.value) return;
      const el = viewportEl.value;
      programmaticScroll = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          programmaticScroll = false;
          el.scrollTop = el.scrollHeight;
        });
      });
    };

    // 初始载入即跟随到底（若此时已有条目）
    onMounted(() => {
      if (autoScroll.value && filteredEntries.value.length > 0) scrollToBottom();
    });

    // ---------- 自动跟随 / 锁滚 ----------
    // 直接监视源数据长度（而非过滤派生值）：追加新条目时，若处于自动跟随则滚动到底部。
    // 过滤条件变化只影响呈现，不应强制拉回底部，故过滤后长度不进依赖。
    watch(() => props.entries.length, () => {
      if (autoScroll.value) scrollToBottom();
    });

    const onScroll = (event: Event) => {
      if (programmaticScroll) return;
      const el = event.target as HTMLElement;
      scrollTop.value = el.scrollTop;
      // 用户手动滚动：贴底恢复跟随，上滑即锁滚
      autoScroll.value = isAtBottom(el.scrollTop, el.scrollHeight, el.clientHeight);
    };

    const toggleAutoScroll = () => {
      autoScroll.value = !autoScroll.value;
      if (autoScroll.value) scrollToBottom();
    };

    // ---------- 过滤交互（视图本地） ----------
    const toggleLevel = (level: ConsoleLevel) => {
      const active = levels.value.includes(level);
      levels.value = active ? levels.value.filter((item) => item !== level) : [...levels.value, level];
    };

    // ---------- 清空意图（由宿主裁决是否真的清空数据源） ----------
    const clear = () => emit('clear-intent');

    // ---------- 视图生命周期契约（四成员，onDestroy 幂等） ----------
    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-console',
      getViewState: (): ConsoleViewState => ({
        scrollTop: viewportEl.value?.scrollTop ?? scrollTop.value,
        autoScroll: autoScroll.value,
        levels: [...levels.value],
        query: query.value,
      }),
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<ConsoleViewState>;
        if (typeof snapshot.autoScroll === 'boolean') autoScroll.value = snapshot.autoScroll;
        if (Array.isArray(snapshot.levels)) levels.value = snapshot.levels.filter((item): item is ConsoleLevel => (CONSOLE_LEVELS as readonly string[]).includes(item));
        if (typeof snapshot.query === 'string') query.value = snapshot.query;
        if (typeof snapshot.scrollTop === 'number') {
          const target = snapshot.scrollTop;
          void nextTick(() => {
            if (viewportEl.value) viewportEl.value.scrollTop = target;
          });
        }
      },
      onDestroy: () => {
        destroyed = true;
        resizeObserver?.disconnect();
        resizeObserver = null;
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

    const toolbarStyle = {
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'var(--mui-density-gap-compact, 4px)',
      padding: 'calc(var(--mui-density-gap, 8px) / 2) var(--mui-density-gap, 8px)',
      borderBottom: '1px solid var(--mui-color-border)',
    } as const;

    const chipStyle = (active: boolean) => ({
      padding: '1px 8px', fontSize: '11px', cursor: 'pointer', userSelect: 'none',
      border: `1px solid ${active ? 'var(--mui-color-accent)' : 'var(--mui-color-border)'}`,
      borderRadius: 'var(--mui-radius)',
      background: active ? 'color-mix(in srgb, var(--mui-color-accent) 14%, transparent)' : 'transparent',
      color: active ? 'var(--mui-color-accent)' : 'var(--mui-color-text-muted)',
    });

    const buttonStyle = {
      padding: '2px 10px', fontSize: '11px', cursor: 'pointer',
      border: '1px solid var(--mui-color-border)', borderRadius: 'var(--mui-radius)',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
    } as const;

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-console', style: { ...rootStyle, placeItems: 'center', display: 'grid' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-console', style: { ...rootStyle, placeItems: 'center', display: 'grid', color: 'var(--mui-color-danger)' } }, props.error);
      }

      const visibleRows = filteredEntries.value.slice(virtual.value.start, virtual.value.end);
      const rows = visibleRows.map((entry, index) => {
        const rowIndex = virtual.value.start + index;
        const level = normalizeLevel(entry.level);
        const time = formatTimestamp(entry.timestamp);
        return h('div', {
          key: entry.id,
          class: ['main-ui-view-console__row', `is-${level}`],
          style: {
            position: 'absolute', top: `${rowIndex * props.rowHeight}px`, left: 0, right: 0,
            height: `${props.rowHeight}px`, display: 'flex', alignItems: 'center', gap: '8px',
            padding: '0 8px', fontFamily: 'var(--mui-font-mono)', fontSize: '12px',
            whiteSpace: 'nowrap', overflow: 'hidden',
          },
        }, [
          time ? h('span', { style: { color: 'var(--mui-color-text-muted)', flexShrink: 0 } }, time) : null,
          h('span', { style: { width: '52px', flexShrink: 0, color: LEVEL_COLOR[level], textTransform: 'uppercase', fontSize: '10px' } }, level),
          h('span', { style: { color: LEVEL_COLOR[level], overflow: 'hidden', textOverflow: 'ellipsis' } }, entry.message),
        ]);
      });

      return h('div', { class: 'main-ui-view-console', style: rootStyle }, [
        h('div', { class: 'main-ui-view-console__toolbar', style: toolbarStyle }, [
          ...CONSOLE_LEVELS.map((level) => h('span', {
            key: level,
            class: ['main-ui-view-console__level-chip', levels.value.includes(level) ? 'is-active' : ''],
            style: chipStyle(levels.value.includes(level)),
            title: `Filter: ${level}`,
            onClick: () => toggleLevel(level),
          }, level)),
          h('input', {
            class: 'main-ui-view-console__filter',
            type: 'text', placeholder: 'Filter…',
            style: {
              flex: 1, minWidth: '60px', padding: '2px 6px', fontSize: '11px', outline: 'none',
              border: '1px solid var(--mui-color-border)', borderRadius: 'var(--mui-radius)',
              background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
            },
            value: query.value,
            onInput: (event: Event) => { query.value = (event.target as HTMLInputElement).value; },
          }),
          h('button', {
            class: ['main-ui-view-console__autoscroll', autoScroll.value ? 'is-active' : ''],
            type: 'button',
            style: { ...buttonStyle, color: autoScroll.value ? 'var(--mui-color-accent)' : buttonStyle.color },
            title: autoScroll.value ? 'Auto-scroll on (follow tail)' : 'Auto-scroll off (scroll locked)',
            onClick: toggleAutoScroll,
          }, autoScroll.value ? 'Follow' : 'Locked'),
          props.clearEnabled ? h('button', {
            class: 'main-ui-view-console__clear',
            type: 'button', style: buttonStyle, title: 'Request host to clear entries',
            onClick: clear,
          }, 'Clear') : null,
        ]),
        h('div', {
          class: 'main-ui-view-console__viewport',
          ref: viewportEl,
          style: { flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' },
          onScroll,
        }, filteredEntries.value.length === 0
          ? h('div', { style: { padding: '16px', color: 'var(--mui-color-text-muted)', textAlign: 'center' } }, 'No entries')
          : h('div', { style: { height: `${virtual.value.totalHeight}px`, position: 'relative' } }, rows)),
      ]);
    };
  },
});
