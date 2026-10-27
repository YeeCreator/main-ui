import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import { computeTableRowWindow, nextSort, resolveRowId, sortRows } from './table';
import { DEFAULT_TABLE_ROW_HEIGHT, MIN_COLUMN_WIDTH, type TableCellEditIntent, type TableColumn, type TableColumnResizeIntent, type TableRow, type TableSort, type TableViewState } from './types';

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
    /** 多选开关（opt-in；缺省单选） */
    multiSelect: { type: Boolean, default: false },
    /** 受控多选集（仅 multiSelect 为真时生效） */
    selectedRowIds: { type: Array as PropType<string[]>, default: null },
    sort: { type: Object as PropType<TableSort>, default: null },
    /** 双击单元格进入行内编辑（提交以意图形式抛出） */
    editable: { type: Boolean, default: true },
    /** 是否允许拖动表头右边沿调整列宽 */
    resizableColumns: { type: Boolean, default: false },
    rowHeight: { type: Number, default: DEFAULT_TABLE_ROW_HEIGHT },
    editorInstanceId: { type: String, default: null },
  },
  emits: ['row-select', 'selection-change', 'cell-edit-intent', 'sort-change', 'column-resize-intent'],
  setup(props, { emit }) {
    // ---------- 内部状态（受控 Props 变化时同步） ----------
    const internalSelected = ref<string | null>(props.selectedRowId);
    const internalSelectedIds = ref<Set<string>>(new Set(props.selectedRowIds ?? []));
    const internalSort = ref<TableSort>(props.sort);
    /** 用户拉伸过的列宽（key → px）；未拉伸的列仍走声明宽度或 flex */
    const columnWidths = ref<Record<string, number>>({});
    watch(() => props.selectedRowId, (value) => { internalSelected.value = value ?? null; });
    watch(() => props.selectedRowIds, (value) => { if (value) internalSelectedIds.value = new Set(value); });
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
    /**
     * 列宽解析：优先级「用户拉伸 > 声明宽度 > flex 均分」。
     *
     * 多选开启时前置一个 28px 的选择列，否则复选框会挤掉首个数据列。
     */
    const gridTemplate = computed(() => {
      const columns = props.columns.map((column) => {
        const resized = columnWidths.value[column.key];
        if (typeof resized === 'number') return `${resized}px`;
        if (typeof column.width === 'number') return `${column.width}px`;
        return 'minmax(0, 1fr)';
      });
      return [...(props.multiSelect ? ['28px'] : []), ...columns].join(' ');
    });

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
     * 行选中。多选模式下同时抛 `selection-change`：
     * `row-select` 供属性面板绑定「主选中」，`selection-change` 供批量操作。
     * 两条并存而不互斥，与 view-tree 同一口径。
     */
    const selectRow = (rowId: string, event?: MouseEvent) => {
      internalSelected.value = rowId;
      emit('row-select', rowId);
      if (!props.multiSelect) return;
      const additive = Boolean(event && (event.metaKey || event.ctrlKey));
      const next = additive ? new Set(internalSelectedIds.value) : new Set<string>();
      if (additive && next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      internalSelectedIds.value = next;
      emit('selection-change', [...next]);
    };

    /**
     * 列宽拖拽。
     *
     * 用 pointer 事件而非 mousemove：指针捕获由浏览器保证，即使光标移出表头
     * 也能继续收到事件——不用自己监听 document 再解绑（那是最容易漏解绑的地方）。
     */
    const startResize = (column: TableColumn, event: PointerEvent) => {
      if (!props.resizableColumns) return;
      event.preventDefault();
      event.stopPropagation();
      const header = (event.currentTarget as HTMLElement).parentElement;
      const startX = event.clientX;
      const startWidth = header?.getBoundingClientRect().width
        ? columnWidths.value[column.key] ?? column.width ?? 120
        : columnWidths.value[column.key] ?? column.width ?? 120;
      const min = column.minWidth ?? MIN_COLUMN_WIDTH;
      const target = event.currentTarget as HTMLElement;
      target.setPointerCapture?.(event.pointerId);

      const onMove = (moveEvent: PointerEvent) => {
        const width = Math.max(min, Math.round(startWidth + (moveEvent.clientX - startX)));
        columnWidths.value = { ...columnWidths.value, [column.key]: width };
      };
      const onUp = () => {
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', onUp);
        target.removeEventListener('pointercancel', onUp);
        const width = columnWidths.value[column.key];
        if (typeof width === 'number') {
          const intent: TableColumnResizeIntent = { columnKey: column.key, width };
          emit('column-resize-intent', intent);
        }
      };
      target.addEventListener('pointermove', onMove);
      target.addEventListener('pointerup', onUp);
      target.addEventListener('pointercancel', onUp);
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
      getViewState: (): TableViewState => {
        // F-4 fix：internalSort.value 是 Vue 响应式 Proxy（非 null 时），structuredClone 会抛
        // DataCloneError；用 {...} 展开为普通对象，规避内核 captureViewStates → cloneDocument 崩溃。
        const sort = internalSort.value;
        return {
          scrollTop: viewportEl.value?.scrollTop ?? scrollTop.value,
          selectedRowId: internalSelected.value,
          selectedRowIds: [...internalSelectedIds.value],
          sort: sort ? { key: sort.key, direction: sort.direction } : null,
          columnWidths: { ...columnWidths.value },
        };
      },
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<TableViewState>;
        if ('selectedRowId' in snapshot) internalSelected.value = snapshot.selectedRowId ?? null;
        if (Array.isArray(snapshot.selectedRowIds)) internalSelectedIds.value = new Set(snapshot.selectedRowIds);
        if ('sort' in snapshot) internalSort.value = snapshot.sort ?? null;
        if (snapshot.columnWidths && typeof snapshot.columnWidths === 'object') columnWidths.value = { ...snapshot.columnWidths };
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
            ...cellStyle(column), display: 'flex', alignItems: 'center', position: 'relative',
            fontWeight: 600, fontSize: '12px', color: 'var(--mui-color-text-muted)',
            cursor: column.sortable ? 'pointer' : 'default',
          },
          onClick: () => toggleSort(column),
        }, [
          `${column.title}${indicator}`,
          props.resizableColumns ? h('span', {
            class: 'main-ui-view-table__resize-handle',
            style: {
              position: 'absolute', top: 0, right: '-2px', width: '5px', height: '100%',
              cursor: 'col-resize', userSelect: 'none',
            },
            onPointerdown: (event: PointerEvent) => startResize(column, event),
            onClick: (event: MouseEvent) => event.stopPropagation(),
          }) : null,
        ]);
      });

      // 多选开启时表头前置全选复选框（作用于当前可见行）
      const visibleRowIds = sortedRows.value.map((row, index) => resolveRowId(row, index, props.rowKey));
      const allSelected = visibleRowIds.length > 0 && visibleRowIds.every((id) => internalSelectedIds.value.has(id));
      const headerSelectCell = props.multiSelect ? h('div', {
        key: '__select__',
        class: 'main-ui-view-table__header-select',
        style: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      }, [
        h('input', {
          type: 'checkbox',
          style: { accentColor: 'var(--mui-color-accent)' },
          checked: allSelected,
          onChange: () => {
            const next = allSelected ? new Set<string>() : new Set(visibleRowIds);
            internalSelectedIds.value = next;
            emit('selection-change', [...next]);
          },
        }),
      ]) : null;

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
          class: ['main-ui-view-table__row', (props.multiSelect ? internalSelectedIds.value.has(rowId) : selected) ? 'is-selected' : ''],
          style: {
            position: 'absolute', top: `${rowIndex * props.rowHeight}px`, left: 0, right: 0,
            height: `${props.rowHeight}px`, display: 'grid', gridTemplateColumns: gridTemplate.value,
            cursor: 'pointer',
            background: (props.multiSelect ? internalSelectedIds.value.has(rowId) : selected)
              ? 'color-mix(in srgb, var(--mui-color-accent) 14%, transparent)' : 'transparent',
          },
          onClick: (event: MouseEvent) => selectRow(rowId, event),
        }, [
          props.multiSelect ? h('div', {
            key: '__select__',
            class: 'main-ui-view-table__row-select',
            style: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
            onClick: (event: MouseEvent) => event.stopPropagation(),
          }, [
            h('input', {
              type: 'checkbox',
              style: { accentColor: 'var(--mui-color-accent)' },
              checked: internalSelectedIds.value.has(rowId),
              onChange: () => {
                const next = new Set(internalSelectedIds.value);
                if (next.has(rowId)) next.delete(rowId);
                else next.add(rowId);
                internalSelectedIds.value = next;
                emit('selection-change', [...next]);
              },
            }),
          ]) : null,
          ...cells,
        ]);
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
        }, [headerSelectCell, ...headerCells].filter(Boolean) as never),
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
