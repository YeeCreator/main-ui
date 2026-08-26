import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import type { EditorDescriptor, GroupId, LayoutNodeId, SplitDirection, TabId } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';
import { EditorSurfaceHost } from './EditorSurfaceHost';
import { EmptyGroupLauncher } from './EmptyGroupLauncher';
import { renderIconToken } from './IconToken';

export const LeafGroupRenderer = defineComponent({
  name: 'LeafGroupRenderer',
  props: {
    nodeId: {
      type: String as PropType<LayoutNodeId>,
      required: true,
    },
    groupId: {
      type: String as PropType<GroupId>,
      required: true,
    },
  },
  setup(props) {
    const { runtime, document, dispatch } = useWorkbench();
    const workspace = computed(() => document.value.workspaceStates[document.value.activeWorkspaceId]);
    const workspaceDescriptor = computed(() => runtime.core.workspaces.get(document.value.activeWorkspaceId));
    const availableEditors = computed(() => (workspaceDescriptor.value?.allowedEditorKinds ?? [])
      .map((kind) => runtime.core.editors.get(kind))
      .filter((descriptor): descriptor is EditorDescriptor => descriptor !== undefined && descriptor.capability.launcherVisibility !== 'hidden'));
    const group = computed(() => workspace.value.layout.groups[props.groupId]);
    const activeTab = computed(() => {
      const activeTabId = group.value?.activeTabId;
      return activeTabId ? workspace.value.tabs[activeTabId] : null;
    });

    // ---------- Tab 溢出收纳 ----------
    const tabsViewport = ref<HTMLElement | null>(null);
    const scrollVersion = ref(0);
    const overflowOpen = ref(false);
    let resizeObserver: ResizeObserver | null = null;

    const overflowState = computed(() => {
      // 依赖收集：滚动/尺寸/页签集合变化时重算可见性
      void scrollVersion.value;
      const el = tabsViewport.value;
      if (!el) {
        return { canLeft: false, canRight: false, hidden: [] as TabId[] };
      }
      const hidden: TabId[] = [];
      for (const tabId of group.value.tabIds) {
        const child = el.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement | null;
        if (!child) continue;
        const start = child.offsetLeft;
        const end = start + child.offsetWidth;
        if (end <= el.scrollLeft + 1 || start >= el.scrollLeft + el.clientWidth - 1) {
          hidden.push(tabId);
        }
      }
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      return {
        canLeft: el.scrollLeft > 1,
        canRight: el.scrollLeft < maxScroll - 1,
        hidden,
      };
    });

    const bumpScrollVersion = () => { scrollVersion.value += 1; };

    onMounted(() => {
      if (tabsViewport.value && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(bumpScrollVersion);
        resizeObserver.observe(tabsViewport.value);
      }
    });
    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      resizeObserver = null;
    });

    watch(() => group.value.tabIds.join(','), () => void nextTick(bumpScrollVersion));

    // 活动页签变更时自动滚动使其可见
    watch(() => group.value?.activeTabId, async () => {
      await nextTick();
      const el = tabsViewport.value;
      const activeTabId = group.value?.activeTabId;
      if (!el || !activeTabId) return;
      const child = el.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement | null;
      child?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
      bumpScrollVersion();
    });

    const scrollStrip = (delta: number) => {
      tabsViewport.value?.scrollBy({ left: delta, behavior: 'smooth' });
    };

    // ---------- 既有交互 ----------
    const split = (direction: SplitDirection) => void dispatch({ type: 'layout/splitLeaf', leafNodeId: props.nodeId, direction });
    const openEditor = (event: Event) => {
      const select = event.target as HTMLSelectElement;
      const editorKind = select.value;
      if (editorKind) {
        void dispatch({ type: 'editor/open', request: { editorKind, targetGroupId: props.groupId } });
      }
      select.value = '';
    };

    return () => h('section', {
      class: ['main-ui-leaf-group', workspace.value.layout.activeGroupId === props.groupId ? 'is-active' : ''],
      onPointerdown: () => void dispatch({ type: 'layout/setActiveGroup', groupId: props.groupId }),
    }, [
      h('div', { class: 'main-ui-tab-strip' }, [
        overflowState.value.canLeft ? h('button', {
          class: 'main-ui-tab-strip__scroll main-ui-tab-strip__scroll--left',
          type: 'button',
          title: 'Scroll tabs left',
          onClick: () => scrollStrip(-240),
        }, '‹') : null,
        h('div', {
          class: 'main-ui-tab-strip__tabs',
          ref: tabsViewport,
          onScroll: bumpScrollVersion,
        }, group.value.tabIds.map((tabId) => {
          const tab = workspace.value.tabs[tabId];
          if (!tab) {
            return null;
          }
          return h('button', {
            class: ['main-ui-tab', tabId === group.value.activeTabId ? 'is-active' : '', tab.dirty ? 'is-dirty' : '', tab.pinned ? 'is-pinned' : ''],
            type: 'button',
            tabindex: tabId === group.value.activeTabId ? 0 : -1,
            draggable: true,
            title: tab.title,
            'data-tab-id': tabId,
            onClick: () => void dispatch({ type: 'editor/activateTab', groupId: props.groupId, tabId }),
            onDragstart: (event: DragEvent) => event.dataTransfer?.setData('text/main-ui-tab', JSON.stringify({ groupId: props.groupId, tabId })),
            onDragover: (event: DragEvent) => event.preventDefault(),
            onDrop: (event: DragEvent) => {
              event.preventDefault();
              const raw = event.dataTransfer?.getData('text/main-ui-tab');
              if (!raw) return;
              try { const source = JSON.parse(raw) as { groupId: string; tabId: string }; const index = group.value.tabIds.indexOf(tabId); void dispatch(source.groupId === props.groupId ? { type: 'editor/reorderTab', groupId: props.groupId, tabId: source.tabId, index } : { type: 'editor/moveTabToGroup', fromGroupId: source.groupId, toGroupId: props.groupId, tabId: source.tabId, index }); } catch { /* ignore malformed drag payload */ }
            },
            onKeydown: (event: KeyboardEvent) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                const ids = group.value.tabIds; const current = ids.indexOf(tabId); const next = ids[Math.max(0, Math.min(ids.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)))];
                if (next) { event.preventDefault(); void dispatch({ type: 'editor/activateTab', groupId: props.groupId, tabId: next }); }
              }
            },
          }, [
            h('span', { class: 'main-ui-tab__icon' }, [renderIconToken(tab.icon)]),
            h('span', { class: 'main-ui-tab__title' }, tab.title),
            tab.pinned ? h('span', { class: 'main-ui-tab__pin', title: 'Pinned' }, '•') : null,
            tab.closable ? h('span', {
              class: 'main-ui-tab__close',
              title: 'Close tab',
              onClick: (event: MouseEvent) => {
                event.stopPropagation();
                void dispatch({ type: 'editor/closeTab', groupId: props.groupId, tabId });
              },
            }, [renderIconToken('close')]) : null,
          ]);
        })),
        overflowState.value.canRight ? h('button', {
          class: 'main-ui-tab-strip__scroll main-ui-tab-strip__scroll--right',
          type: 'button',
          title: 'Scroll tabs right',
          onClick: () => scrollStrip(240),
        }, '›') : null,
        overflowState.value.hidden.length > 0 ? h('div', { class: 'main-ui-tab-overflow' }, [
          h('button', {
            class: ['main-ui-tab-overflow__toggle', overflowOpen.value ? 'is-open' : ''],
            type: 'button',
            title: 'Show hidden tabs',
            'aria-expanded': overflowOpen.value,
            onClick: (event: MouseEvent) => {
              event.stopPropagation();
              overflowOpen.value = !overflowOpen.value;
            },
            onKeydown: (event: KeyboardEvent) => {
              if (event.key === 'Escape') overflowOpen.value = false;
            },
          }, '⋯'),
          overflowOpen.value ? h('div', { class: 'main-ui-tab-overflow__menu', role: 'menu' }, overflowState.value.hidden.map((tabId) => {
            const tab = workspace.value.tabs[tabId];
            if (!tab) return null;
            return h('button', {
              class: 'main-ui-tab-overflow__item',
              type: 'button',
              role: 'menuitem',
              title: tab.title,
              onClick: (event: MouseEvent) => {
                event.stopPropagation();
                overflowOpen.value = false;
                void dispatch({ type: 'editor/activateTab', groupId: props.groupId, tabId });
              },
            }, [
              h('span', { class: 'main-ui-tab__icon' }, [renderIconToken(tab.icon)]),
              h('span', { class: 'main-ui-tab-overflow__item-title' }, tab.title),
            ]);
          })) : null,
        ]) : null,
        h('div', { class: 'main-ui-tab-strip__actions' }, [
          h('select', {
            class: 'main-ui-editor-select',
            title: 'Open editor',
            value: '',
            onChange: openEditor,
            onClick: (event: MouseEvent) => event.stopPropagation(),
          }, [
            h('option', { value: '' }, '+'),
            ...availableEditors.value.map((editor) => h('option', { value: editor.kind }, editor.title)),
          ]),
          h('button', {
            class: 'main-ui-mini-button',
            type: 'button',
            title: 'Reopen recently closed editor',
            disabled: workspace.value.recentlyClosed.length === 0,
            onClick: () => void dispatch({ type: 'editor/reopenRecentlyClosed', targetGroupId: props.groupId }),
          }, [renderIconToken('refresh')]),
          h('button', { class: 'main-ui-mini-button', type: 'button', title: 'Split left', onClick: () => split('left') }, [renderIconToken('splitLeft')]),
          h('button', { class: 'main-ui-mini-button', type: 'button', title: 'Split right', onClick: () => split('right') }, [renderIconToken('splitRight')]),
          h('button', { class: 'main-ui-mini-button', type: 'button', title: 'Split up', onClick: () => split('up') }, [renderIconToken('splitUp')]),
          h('button', { class: 'main-ui-mini-button', type: 'button', title: 'Split down', onClick: () => split('down') }, [renderIconToken('splitDown')]),
          h('button', {
            class: 'main-ui-mini-button',
            type: 'button',
            title: 'Close group',
            onClick: () => void dispatch({ type: 'layout/closeLeaf', leafNodeId: props.nodeId }),
          }, [renderIconToken('close')]),
          h('button', {
            class: 'main-ui-mini-button',
            type: 'button',
            title: 'Maximize',
            onClick: () => void dispatch({ type: 'layout/toggleMaximize', nodeId: props.nodeId }),
          }, [renderIconToken(workspace.value.layout.maximizedNodeId === props.nodeId ? 'restore' : 'maximize')]),
        ]),
      ]),
      activeTab.value
        ? h(EditorSurfaceHost, { groupId: props.groupId, tabId: activeTab.value.id })
        : h(EmptyGroupLauncher, { groupId: props.groupId }),
    ]);
  },
});
