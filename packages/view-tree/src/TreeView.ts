import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import { computeVirtualWindow, flattenTree } from './tree';
import { DEFAULT_TREE_ITEM_HEIGHT, type TreeViewState, type ViewTreeNode } from './types';

/**
 * TreeView —— 自研虚拟滚动树模板。
 * 数据经 Props 注入（含 loading / error 三态），操作经 Emits 抛出；颜色一律消费 --mui-* 变量。
 */
export const TreeView = defineComponent({
  name: 'TreeView',
  props: {
    items: { type: Array as PropType<ViewTreeNode[]>, required: true },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    selectedId: { type: String as PropType<string | null>, default: null },
    /** 多选开关（opt-in；缺省单选，行为与此前完全一致） */
    multiSelect: { type: Boolean, default: false },
    /** 受控多选集（仅 multiSelect 为真时生效） */
    selectedIds: { type: Array as PropType<string[]>, default: null },
    expandedIds: { type: Array as PropType<string[]>, default: null },
    filterable: { type: Boolean, default: true },
    itemHeight: { type: Number, default: DEFAULT_TREE_ITEM_HEIGHT },
    editorInstanceId: { type: String, default: null },
  },
  emits: ['select', 'toggle', 'filter-change', 'selection-change'],
  setup(props, { emit }) {
    // ---------- 内部状态（受控 Props 变化时同步） ----------
    const filter = ref('');
    const internalSelected = ref<string | null>(props.selectedId);
    const internalSelectedIds = ref<Set<string>>(new Set(props.selectedIds ?? []));
    const internalExpanded = ref<Set<string>>(new Set(props.expandedIds ?? []));
    watch(() => props.selectedId, (value) => { internalSelected.value = value ?? null; });
    watch(() => props.selectedIds, (value) => { if (value) internalSelectedIds.value = new Set(value); });
    watch(() => props.expandedIds, (value) => { if (value) internalExpanded.value = new Set(value); });

    // ---------- 虚拟滚动 ----------
    const viewportEl = ref<HTMLElement | null>(null);
    const scrollTop = ref(0);
    const viewportHeight = ref(0);
    let resizeObserver: ResizeObserver | null = null;
    let destroyed = false;

    const rows = computed(() => flattenTree(props.items, internalExpanded.value, filter.value));
    const virtual = computed(() => computeVirtualWindow(scrollTop.value, viewportHeight.value, props.itemHeight, rows.value.length));

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

    const restoreScroll = (target: number) => {
      void nextTick(() => {
        if (viewportEl.value) viewportEl.value.scrollTop = target;
      });
    };

    // ---------- 交互意图（一律经 Emits 抛出） ----------
    /**
     * 选中处理。
     *
     * 多选下的语义刻意保持最小：整条链只做「点击切换该行是否在集内」，
     * **不做 Shift 连选与 Ctrl+A**。理由是连选范围依赖“当前可见扁平列表”，
     * 而可见列表随展开态与过滤变化——把它硬编进模板会让宿主的「全选当前筛选结果」
     * 这类需求无法实现。需要连选的宿主自行基于 `selection-change` 实现。
     */
    const select = (nodeId: string, event?: MouseEvent) => {
      internalSelected.value = nodeId;
      emit('select', nodeId);
      if (!props.multiSelect) return;

      const additive = Boolean(event && (event.metaKey || event.ctrlKey));
      const next = additive ? new Set(internalSelectedIds.value) : new Set<string>();
      if (additive && next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      internalSelectedIds.value = next;
      emit('selection-change', [...next]);
    };
    const toggle = (nodeId: string) => {
      const next = new Set(internalExpanded.value);
      const expanded = !next.has(nodeId);
      if (expanded) next.add(nodeId); else next.delete(nodeId);
      internalExpanded.value = next;
      emit('toggle', nodeId, expanded);
    };
    const onFilterInput = (event: Event) => {
      const keyword = (event.target as HTMLInputElement).value;
      filter.value = keyword;
      emit('filter-change', keyword);
    };

    // ---------- 视图生命周期契约（四成员，onDestroy 幂等） ----------
    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-tree',
      getViewState: (): TreeViewState => ({
        expandedIds: [...internalExpanded.value],
        selectedId: internalSelected.value,
        selectedIds: [...internalSelectedIds.value],
        filter: filter.value,
        scrollTop: viewportEl.value?.scrollTop ?? scrollTop.value,
      }),
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<TreeViewState>;
        if (Array.isArray(snapshot.expandedIds)) internalExpanded.value = new Set(snapshot.expandedIds);
        if (Array.isArray(snapshot.selectedIds)) internalSelectedIds.value = new Set(snapshot.selectedIds);
        if ('selectedId' in snapshot) internalSelected.value = snapshot.selectedId ?? null;
        if (typeof snapshot.filter === 'string') filter.value = snapshot.filter;
        if (typeof snapshot.scrollTop === 'number') restoreScroll(snapshot.scrollTop);
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

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-tree', style: { ...rootStyle, placeItems: 'center', display: 'grid' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-tree', style: { ...rootStyle, placeItems: 'center', display: 'grid', color: 'var(--mui-color-danger)' } }, props.error);
      }

      const visibleRows = rows.value.slice(virtual.value.start, virtual.value.end);
      return h('div', { class: 'main-ui-view-tree', style: rootStyle }, [
        props.filterable ? h('input', {
          class: 'main-ui-view-tree__filter',
          style: {
            margin: '6px 8px', padding: '4px 8px', flexShrink: 0,
            border: '1px solid var(--mui-color-border)', borderRadius: 'var(--mui-radius)',
            background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)', outline: 'none',
          },
          type: 'text', placeholder: 'Filter…', value: filter.value, onInput: onFilterInput,
        }) : null,
        h('div', {
          class: 'main-ui-view-tree__viewport',
          ref: viewportEl,
          style: { flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' },
          onScroll: (event: Event) => { scrollTop.value = (event.target as HTMLElement).scrollTop; },
        }, [
          rows.value.length === 0
            ? h('div', { style: { padding: '16px', color: 'var(--mui-color-text-muted)', textAlign: 'center' } }, 'No items')
            : h('div', { style: { height: `${virtual.value.totalHeight}px`, position: 'relative' } }, visibleRows.map((row, index) => {
              const rowIndex = virtual.value.start + index;
              const selected = internalSelected.value === row.node.id;
              const checked = props.multiSelect && internalSelectedIds.value.has(row.node.id);
              return h('div', {
                key: row.node.id,
                class: ['main-ui-view-tree__row', (props.multiSelect ? checked : selected) ? 'is-selected' : ''],
                style: {
                  position: 'absolute', top: `${rowIndex * props.itemHeight}px`, left: 0, right: 0,
                  height: `${props.itemHeight}px`, display: 'flex', alignItems: 'center', gap: '4px',
                  paddingLeft: `${8 + row.depth * 14}px`, cursor: 'pointer',
                  background: (props.multiSelect ? checked : selected)
                    ? 'color-mix(in srgb, var(--mui-color-accent) 14%, transparent)' : 'transparent',
                },
                onClick: (event: MouseEvent) => select(row.node.id, event),
              }, [
                row.hasChildren ? h('button', {
                  class: 'main-ui-view-tree__caret',
                  type: 'button',
                  style: {
                    width: '16px', height: '16px', border: 0, padding: 0, flexShrink: 0,
                    background: 'transparent', color: 'var(--mui-color-text-muted)', cursor: 'pointer',
                  },
                  onClick: (event: MouseEvent) => { event.stopPropagation(); toggle(row.node.id); },
                }, row.expanded ? '▾' : '▸') : h('span', { style: { width: '16px', flexShrink: 0 } }),
                props.multiSelect ? h('span', {
                  class: 'main-ui-view-tree__check',
                  style: {
                    width: '12px', flexShrink: 0, fontSize: '10px',
                    color: checked ? 'var(--mui-color-accent)' : 'var(--mui-color-text-muted)',
                  },
                }, checked ? '✓' : '') : null,
                h('span', {
                  style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selected ? 'var(--mui-color-accent-strong)' : 'inherit' },
                }, row.node.label),
              ]);
            })),
        ]),
      ]);
    };
  },
});
