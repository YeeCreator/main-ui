import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import { computeTableRowWindow, nextSort, resolveRowId, sortRows } from './table';
import { DEFAULT_TABLE_ROW_HEIGHT, type TableCellEditIntent, type TableColumn, type TableRow, type TableSort, type TableViewState } from './types';

type EditingCell = { rowId: string; columnKey: string; value: string };

/**
 * TableView —— 自研虚拟滚动表格模板。
 * 数据经 Props 注入（含 loading / error 三态），操作经 Emits 抛出；颜色一律消费 --mui-* 变量。
 */
export const TableView = defineComponent({
  name: 'TableView',
  props: {
    columns: { type: Array as PropType<TableColumn[]>, required: true },
    rows: { type: Array as PropType<TableRow[]>, required: true },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    /** 行标识字段名 */
    rowKey: { type: String, default: 'id' },
    selectedRowId: { type: String as PropType<string | null>, default: null },
    sort: { type: Object as PropType<TableSort>, default: null },
    /** 双击单元格进入行内编辑（提交以意图形式抛出） */
    editable: { type: Boolean, default: true },
    rowHeight: { type: Number, default: DEFAULT_TABLE_ROW_HEIGHT },
    editorInstanceId: { type: String, default: null },
  },
  emits: ['row-select', 'cell-edit-intent', 'sort-change'],
  setup(props, { emit }) {
    // ---------- 内部状态（受控 Props 变化时同步） ----------
    const internalSelected = ref<string | null>(props.selectedRowId);
    const internalSort = ref<TableSort>(props.sort);
    watch(() => props.selectedRowId, (value) => { internalSelected.value = value ?? null; });
    watch(() => props.sort, (value) => { internalSort.value = value ?? null; });

    // ---------- 虚拟滚动 ----------
    const viewportEl = ref<HTMLElement | null>(null);
    const scrollTop = ref(0);
    const viewportHeight = ref(0);
    const editingCell = ref<EditingCell | null>(null);
    let resizeObserver: ResizeObserver | null = null;
    let destroyed = false;

    const sortedRows = computed(() => sortRows(props.rows, internalSort.value));
    const virtual = computed(() => computeTableRowWindow(scrollTop.value, viewportHeight.value, props.rowHeight, sortedRows.value.length));
    const gridTemplate = computed(() => props.columns.map((column) => (typeof column.width === 'number' ? `${column.width}px` : 'minmax(0, 1fr)')).join(' '));

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
    const selectRow = (rowId: string) => {
      internalSelected.value = rowId;
      emit('row-select', rowId);
    };

    const toggleSort = (column: TableColumn) => {
      if (!column.sortable) return;
      internalSort.value = nextSort(internalSort.value, column.key);
      emit('sort-change', internalSort.value);
    };

    const startEditing = (rowId: string, column: TableColumn, row: TableRow) => {
      if (!props.editable) return;
      editingCell.value = { rowId, columnKey: column.key, value: String(row[column.key] ?? '') };
    };

    const commitEditing = () => {
      const editing = editingCell.value;
      editingCell.value = null;
      if (!editing) return;
      const intent: TableCellEditIntent = { rowId: editing.rowId, columnKey: editing.columnKey, value: editing.value };
      emit('cell-edit-intent', intent);
    };

    const cancelEditing = () => {
      editingCell.value = null;
    };

    // ---------- 视图生命周期契约（四成员，onDestroy 幂等） ----------
    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-table',
      getViewState: (): TableViewState => ({
        scrollTop: viewportEl.value?.scrollTop ?? scrollTop.value,
        selectedRowId: internalSelected.value,
        sort: internalSort.value,
      }),
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<TableViewState>;
        if ('selectedRowId' in snapshot) internalSelected.value = snapshot.selectedRowId ?? null;
        if ('sort' in snapshot) internalSort.value = snapshot.sort ?? null;
        if (typeof snapshot.scrollTop === 'number') restoreScroll(snapshot.scrollTop);
      },
      onDestroy: () => {
        destroyed = true;
        editingCell.value = null;
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

    const cellStyle = (column: TableColumn) => ({
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      padding: '0 8px', textAlign: column.align ?? 'left',
    }) as const;

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-table', style: { ...rootStyle, placeItems: 'center', display: 'grid' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-table', style: { ...rootStyle, placeItems: 'center', display: 'grid', color: 'var(--mui-color-danger)' } }, props.error);
      }

      const headerCells = props.columns.map((column) => {
        const active = internalSort.value?.key === column.key;
        const indicator = active ? (internalSort.value?.direction === 'asc' ? ' ▲' : ' ▼') : '';
        return h('div', {
          key: column.key,
          class: ['main-ui-view-table__header-cell', column.sortable ? 'is-sortable' : ''],
          style: {
            ...cellStyle(column), display: 'flex', alignItems: 'center',
            fontWeight: 600, fontSize: '12px', color: 'var(--mui-color-text-muted)',
            cursor: column.sortable ? 'pointer' : 'default',
          },
          onClick: () => toggleSort(column),
        }, `${column.title}${indicator}`);
      });

      const visibleRows = sortedRows.value.slice(virtual.value.start, virtual.value.end);
      const bodyRows = visibleRows.map((row, index) => {
        const rowIndex = virtual.value.start + index;
        const rowId = resolveRowId(row, rowIndex, props.rowKey);
        const selected = internalSelected.value === rowId;
        const cells = props.columns.map((column) => {
          const isEditing = editingCell.value?.rowId === rowId && editingCell.value.columnKey === column.key;
          if (isEditing && editingCell.value) {
            return h('input', {
              key: column.key,
              class: 'main-ui-view-table__cell-input',
              style: {
                width: '100%', border: '1px solid var(--mui-color-accent)', borderRadius: 'var(--mui-radius)',
                background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
                font: 'inherit', padding: '0 4px', outline: 'none', boxSizing: 'border-box',
              },
              value: editingCell.value.value,
              onInput: (event: Event) => {
                if (editingCell.value) editingCell.value = { ...editingCell.value, value: (event.target as HTMLInputElement).value };
              },
              onKeydown: (event: KeyboardEvent) => {
                if (event.key === 'Enter') commitEditing();
                if (event.key === 'Escape') cancelEditing();
              },
              onBlur: () => commitEditing(),
            });
          }
          return h('div', {
            key: column.key,
            class: 'main-ui-view-table__cell',
            style: { ...cellStyle(column), display: 'flex', alignItems: 'center' },
            onDblclick: () => startEditing(rowId, column, row),
          }, String(row[column.key] ?? ''));
        });
        return h('div', {
          key: rowId,
          class: ['main-ui-view-table__row', selected ? 'is-selected' : ''],
          style: {
            position: 'absolute', top: `${rowIndex * props.rowHeight}px`, left: 0, right: 0,
            height: `${props.rowHeight}px`, display: 'grid', gridTemplateColumns: gridTemplate.value,
            cursor: 'pointer',
            background: selected ? 'color-mix(in srgb, var(--mui-color-accent) 14%, transparent)' : 'transparent',
          },
          onClick: () => selectRow(rowId),
        }, cells);
      });

      return h('div', { class: 'main-ui-view-table', style: rootStyle }, [
        h('div', {
          class: 'main-ui-view-table__header',
          style: {
            display: 'grid', gridTemplateColumns: gridTemplate.value, flexShrink: 0,
            height: `${props.rowHeight}px`,
            borderBottom: '1px solid var(--mui-color-border)',
            background: 'color-mix(in srgb, var(--mui-color-text) 4%, transparent)',
          },
        }, headerCells),
        h('div', {
          class: 'main-ui-view-table__viewport',
          ref: viewportEl,
          style: { flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' },
          onScroll: (event: Event) => { scrollTop.value = (event.target as HTMLElement).scrollTop; },
        }, sortedRows.value.length === 0
          ? h('div', { style: { padding: '16px', color: 'var(--mui-color-text-muted)', textAlign: 'center' } }, 'No rows')
          : h('div', { style: { height: `${virtual.value.totalHeight}px`, position: 'relative' } }, bodyRows)),
      ]);
    };
  },
});
