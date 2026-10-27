import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import {
  computeAssetRowWindow,
  filterAssets,
  nextSelection,
  normalizeLayout,
  pruneSelection,
  resolveGridColumns,
} from './asset';
import {
  DEFAULT_ASSET_CARD_HEIGHT,
  type AssetItem,
  type AssetLayout,
  type AssetSelectPayload,
  type AssetViewState,
} from './types';

/**
 * AssetView —— 资产网格 / 列表模板（缩略图由宿主注入，视图零网络）。
 *
 * 设计取舍：
 * - **定高卡片**：虚拟滚动与网格对齐都要求可预测尺寸；自适应高度会让滚动退化为
 *   「先测量再定位」，代价是每次滚动全量重排。缩略图用 `object-fit: cover` 适配。
 * - **列数由断点表决定**（`resolveGridColumns`），不用 CSS auto-fill：虚拟滚动必须
 *   知道「第 N 项在第几行」，而 CSS 自动填充的结果 JS 拿不到。
 * - **缩略图三态由宿主声明**（`thumbnailState`），视图不重试、不探测。
 */
export const AssetView = defineComponent({
  name: 'AssetView',
  props: {
    items: { type: Array as PropType<AssetItem[]>, required: true },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    /** 受控布局模式 */
    layout: { type: String as PropType<AssetLayout>, default: 'grid' },
    /** 受控选中集 */
    selectedIds: { type: Array as PropType<string[]>, default: null },
    /** 多选开关（缺省 false = 单选，选中集始终只有一个） */
    multiSelect: { type: Boolean, default: false },
    /** 是否显示搜索框 */
    filterable: { type: Boolean, default: true },
    /** 是否允许切换布局 */
    layoutSwitchable: { type: Boolean, default: true },
    /** 卡片高度（px） */
    cardHeight: { type: Number, default: DEFAULT_ASSET_CARD_HEIGHT },
    editorInstanceId: { type: String, default: null },
  },
  emits: ['select', 'selection-change', 'open', 'layout-change'],
  setup(props, { emit }) {
    // ---------- 内部状态（受控 Props 变化时同步） ----------
    const query = ref('');
    const internalLayout = ref<AssetLayout>(normalizeLayout(props.layout));
    const internalSelectedIds = ref<string[]>(props.selectedIds ? [...props.selectedIds] : []);
    const previewId = ref<string | null>(null);
    watch(() => props.layout, (value) => { internalLayout.value = normalizeLayout(value); });
    watch(() => props.selectedIds, (value) => {
      if (value) internalSelectedIds.value = [...value];
    });
    // 数据源变化时裁剪失效选中项（宿主换项目 / 换筛选都会走到这里）
    watch(() => props.items, () => {
      const pruned = pruneSelection(internalSelectedIds.value, props.items ?? []);
      if (pruned.length !== internalSelectedIds.value.length) {
        internalSelectedIds.value = pruned;
        emit('selection-change', [...pruned]);
      }
      if (previewId.value && !(props.items ?? []).some((item) => item.id === previewId.value)) {
        previewId.value = null;
      }
    });

    // ---------- 虚拟滚动 ----------
    const viewportEl = ref<HTMLElement | null>(null);
    const scrollTop = ref(0);
    const viewportHeight = ref(0);
    const viewportWidth = ref(0);
    let resizeObserver: ResizeObserver | null = null;
    let destroyed = false;

    const filtered = computed(() => filterAssets(props.items ?? [], query.value));
    const columns = computed(() => (internalLayout.value === 'list' ? 1 : resolveGridColumns(viewportWidth.value)));
    const rowCount = computed(() => Math.ceil(filtered.value.length / columns.value));
    const rowHeight = computed(() => props.cardHeight);
    const virtual = computed(() =>
      computeAssetRowWindow(scrollTop.value, viewportHeight.value, rowHeight.value, rowCount.value));

    const measure = (): void => {
      if (!viewportEl.value) return;
      viewportHeight.value = viewportEl.value.clientHeight;
      viewportWidth.value = viewportEl.value.clientWidth;
    };

    onMounted(() => {
      measure();
      if (typeof ResizeObserver !== 'undefined' && viewportEl.value) {
        resizeObserver = new ResizeObserver(() => measure());
        resizeObserver.observe(viewportEl.value);
      }
    });
    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      resizeObserver = null;
    });

    /**
     * 视图尺寸变化。
     *
     * 这里不重复挂观察器 —— 尺寸由 main-ui 的统一包装件经 `onResize` 下发，
     * 本视图只是消费它。`ResizeObserver` 仍保留一份是为了「独立嵌入使用」
     * （不经 editor surface 挂载时没有下发者）。
     */
    const applySize = (width: number, height: number): void => {
      viewportHeight.value = height;
      viewportWidth.value = width;
    };

    // ---------- 交互意图（一律经 Emits 抛出） ----------
    const selectItem = (item: AssetItem, event?: MouseEvent) => {
      const additive = props.multiSelect && Boolean(event && (event.metaKey || event.ctrlKey));
      const next = nextSelection(internalSelectedIds.value, item.id, additive);
      internalSelectedIds.value = next;
      const payload: AssetSelectPayload = { id: item.id, additive, payload: item.payload };
      emit('select', payload);
      emit('selection-change', [...next]);
    };

    const openItem = (item: AssetItem) => {
      previewId.value = item.id;
      emit('open', item.id);
    };

    const switchLayout = () => {
      internalLayout.value = internalLayout.value === 'grid' ? 'list' : 'grid';
      emit('layout-change', internalLayout.value);
    };

    // ---------- 视图生命周期契约（四成员，onDestroy 幂等） ----------
    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-asset',
      getViewState: (): AssetViewState => ({
        layout: internalLayout.value,
        selectedIds: [...internalSelectedIds.value],
        scrollTop: viewportEl.value?.scrollTop ?? scrollTop.value,
        previewId: previewId.value,
      }),
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<AssetViewState>;
        if (snapshot.layout) internalLayout.value = normalizeLayout(snapshot.layout);
        if (Array.isArray(snapshot.selectedIds)) internalSelectedIds.value = [...snapshot.selectedIds];
        if (snapshot.previewId !== undefined) previewId.value = snapshot.previewId ?? null;
        if (typeof snapshot.scrollTop === 'number') {
          const target = snapshot.scrollTop;
          void nextTick(() => {
            if (viewportEl.value) viewportEl.value.scrollTop = target;
          });
        }
      },
      onResize: (width, height) => applySize(width, height),
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
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 8px', borderBottom: '1px solid var(--mui-color-border)',
    } as const;

    const buttonStyle = {
      padding: '2px 10px', fontSize: '11px', cursor: 'pointer',
      border: '1px solid var(--mui-color-border)', borderRadius: 'var(--mui-radius)',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
    } as const;

    const renderThumbnail = (item: AssetItem) => {
      const state = item.thumbnailState ?? 'ready';
      const baseStyle = {
        width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block',
        borderRadius: 'var(--mui-radius) var(--mui-radius) 0 0',
      };
      if (state === 'loading') {
        return h('div', {
          style: {
            ...baseStyle, background: 'color-mix(in srgb, var(--mui-color-text) 8%, transparent)',
          },
        });
      }
      if (state === 'error') {
        return h('div', {
          style: {
            ...baseStyle, display: 'grid', placeItems: 'center', fontSize: '11px',
            color: 'var(--mui-color-danger)',
            background: 'color-mix(in srgb, var(--mui-color-danger) 10%, transparent)',
          },
          title: 'Thumbnail unavailable (host reported error; view does not retry)',
        }, '!');
      }
      if (!item.thumbnailUrl) {
        // 无缩略图不是错误态：用标题首字做占位，视觉上仍是一张卡片
        return h('div', {
          style: {
            ...baseStyle, display: 'grid', placeItems: 'center', fontSize: '18px',
            color: 'var(--mui-color-text-muted)',
            background: 'color-mix(in srgb, var(--mui-color-text) 6%, transparent)',
          },
        }, item.title.slice(0, 1).toUpperCase());
      }
      return h('img', { src: item.thumbnailUrl, alt: item.title, style: baseStyle, loading: 'lazy' });
    };

    const renderCard = (item: AssetItem, index: number) => {
      const selected = internalSelectedIds.value.includes(item.id);
      return h('div', {
        key: item.id,
        class: ['main-ui-view-asset__card', selected ? 'is-selected' : ''],
        style: {
          position: 'absolute',
          top: `${Math.floor(index / columns.value) * rowHeight.value}px`,
          left: `${(index % columns.value) * (100 / columns.value)}%`,
          width: `${100 / columns.value}%`,
          height: `${rowHeight.value}px`,
          padding: '4px', boxSizing: 'border-box',
        },
      }, [
        h('div', {
          class: 'main-ui-view-asset__tile',
          style: {
            width: '100%', height: '100%', overflow: 'hidden', cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            border: `1px solid ${selected ? 'var(--mui-color-accent)' : 'var(--mui-color-border)'}`,
            borderRadius: 'var(--mui-radius)',
            background: selected
              ? 'color-mix(in srgb, var(--mui-color-accent) 12%, transparent)'
              : 'var(--mui-color-panel)',
          },
          onClick: (event: MouseEvent) => selectItem(item, event),
          onDblclick: () => openItem(item),
        }, [
          internalLayout.value === 'grid'
            ? h('div', { style: { flex: 1, minHeight: 0 } }, [renderThumbnail(item)])
            : null,
          h('div', {
            style: {
              flexShrink: 0, padding: '2px 6px', fontSize: '11px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: selected ? 'var(--mui-color-accent-strong)' : 'inherit',
            },
            title: item.description ?? item.title,
          }, item.title),
          (item.badges && item.badges.length > 0) ? h('div', {
            style: { flexShrink: 0, display: 'flex', gap: '3px', padding: '0 6px 3px', overflow: 'hidden' },
          }, item.badges.slice(0, 3).map((badge) => h('span', {
            key: badge,
            style: {
              fontSize: '9px', padding: '0 4px', borderRadius: 'var(--mui-radius)',
              color: 'var(--mui-color-text-muted)',
              background: 'color-mix(in srgb, var(--mui-color-text) 8%, transparent)',
            },
          }, badge))) : null,
        ]),
      ]);
    };

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-asset', style: { ...rootStyle, placeItems: 'center', display: 'grid' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-asset', style: { ...rootStyle, placeItems: 'center', display: 'grid', color: 'var(--mui-color-danger)' } }, props.error);
      }

      const startIndex = virtual.value.start * columns.value;
      const endIndex = Math.min(filtered.value.length, virtual.value.end * columns.value);
      const visibleItems = filtered.value.slice(startIndex, endIndex);

      return h('div', { class: 'main-ui-view-asset', style: rootStyle }, [
        h('div', { class: 'main-ui-view-asset__toolbar', style: toolbarStyle }, [
          props.filterable ? h('input', {
            class: 'main-ui-view-asset__filter',
            type: 'text', placeholder: 'Filter…',
            style: {
              flex: 1, minWidth: '60px', padding: '2px 6px', fontSize: '11px', outline: 'none',
              border: '1px solid var(--mui-color-border)', borderRadius: 'var(--mui-radius)',
              background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
            },
            value: query.value,
            onInput: (event: Event) => { query.value = (event.target as HTMLInputElement).value; },
          }) : null,
          h('span', { style: { fontSize: '10px', color: 'var(--mui-color-text-muted)' } },
            `${filtered.value.length} / ${props.items.length}`),
          internalSelectedIds.value.length > 0
            ? h('span', { style: { fontSize: '10px', color: 'var(--mui-color-accent)' } },
              `${internalSelectedIds.value.length} selected`)
            : null,
          props.layoutSwitchable ? h('button', {
            class: 'main-ui-view-asset__layout',
            type: 'button', style: buttonStyle,
            title: 'Toggle grid / list layout',
            onClick: switchLayout,
          }, internalLayout.value === 'grid' ? 'List' : 'Grid') : null,
        ]),
        h('div', {
          class: 'main-ui-view-asset__viewport',
          ref: viewportEl,
          style: { flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' },
          onScroll: (event: Event) => { scrollTop.value = (event.target as HTMLElement).scrollTop; },
        }, filtered.value.length === 0
          ? h('div', { style: { padding: '16px', color: 'var(--mui-color-text-muted)', textAlign: 'center' } }, 'No assets')
          : h('div', {
            style: {
              height: `${virtual.value.totalHeight}px`, position: 'relative',
              // 列表模式缩窄内容宽度，避免单个卡片撑满整屏导致「一行一项但极宽」
              width: internalLayout.value === 'list' ? '100%' : undefined,
            },
          }, visibleItems.map((item, offset) => renderCard(item, startIndex + offset)))),
      ]);
    };
  },
});
