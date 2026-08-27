import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType, type VNodeChild } from 'vue';
import type { EditorDescriptor, FloatingWindowId, GroupId, LayoutNodeId, SplitDirection, TabId } from '../../core';
import { dropZoneToSplitDirection, resolveDropZone, type DropZone } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';
import { beginDockingDrag, dockingDragSession, endDockingDrag, updateDockingHover } from '../dockingDrag';
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
    /** 浮动窗口内渲染时传入窗口 id：组从窗口布局子树解析，隐藏主布局专属操作。 */
    floatingWindowId: {
      type: String as PropType<FloatingWindowId>,
      default: null,
    },
  },
  setup(props) {
    const { runtime, document, dispatch } = useWorkbench();
    const workspace = computed(() => document.value.workspaceStates[document.value.activeWorkspaceId]);
    const workspaceDescriptor = computed(() => runtime.core.workspaces.get(document.value.activeWorkspaceId));
    const availableEditors = computed(() => (workspaceDescriptor.value?.allowedEditorKinds ?? [])
      .map((kind) => runtime.core.editors.get(kind))
      .filter((descriptor): descriptor is EditorDescriptor => descriptor !== undefined && descriptor.capability.launcherVisibility !== 'hidden'));
    const floatingWindow = computed(() => (props.floatingWindowId ? workspace.value.floatingWindows?.[props.floatingWindowId] ?? null : null));
    const layoutDoc = computed(() => floatingWindow.value?.layout ?? workspace.value.layout);
    const group = computed(() => layoutDoc.value.groups[props.groupId]);
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

    // ---------- 拖出浮动窗口（能力经 Slot 查询门控） ----------
    const canPopout = computed(() => !props.floatingWindowId && group.value.tabIds.some((tabId) => {
      const tab = workspace.value.tabs[tabId];
      const editor = tab ? workspace.value.editors[tab.editorInstanceId] : undefined;
      return editor ? runtime.core.slots.can(editor.kind, 'floatingWindow') : false;
    }));
    const popout = () => void dispatch({ type: 'floatingWindow/popout', groupId: props.groupId });

    // ---------- 停靠引导：五向落点指示 + Ghost 预览（v0.4） ----------
    // 拖拽中间态不落 action，只有 drop 才提交；合法性经 Slot 能力方法裁决。
    const dragOverZone = ref<DropZone | null>(null);
    const isDockingTarget = computed(() =>
      Boolean(dockingDragSession.source) && dockingDragSession.hover?.groupId === props.groupId && dragOverZone.value !== null);

    const zoneLegal = (zone: DropZone, kind: string | undefined): boolean => {
      if (!kind) return false;
      return zone === 'center'
        ? runtime.core.slots.can(kind, 'moveAcrossGroups')
        : runtime.core.slots.can(kind, 'splitDrop');
    };

    const handleDragOver = (event: DragEvent) => {
      if (!dockingDragSession.source) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const zone = resolveDropZone(rect, { x: event.clientX, y: event.clientY });
      dragOverZone.value = zone;
      updateDockingHover({ groupId: props.groupId, leafNodeId: props.nodeId, floatingWindowId: props.floatingWindowId, zone });
    };

    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      const source = dockingDragSession.source;
      const zone = dragOverZone.value;
      endDockingDrag();
      dragOverZone.value = null;
      if (!source || !zone || source.tabId === undefined) return;
      if (!zoneLegal(zone, source.editorKind)) return; // 非法落点：不命中、不落 action（完整回退）
      const fromSameGroup = source.groupId === props.groupId;
      if (zone === 'center') {
        if (fromSameGroup) return; // 同组堆叠即原位，无需动作（排序由 tab 条拖拽承担）
        void dispatch({ type: 'editor/moveTabToGroup', fromGroupId: source.groupId, toGroupId: props.groupId, tabId: source.tabId });
        return;
      }
      const direction = dropZoneToSplitDirection(zone);
      if (!direction) return;
      void dispatch({
        type: 'editor/moveTabToNewSplit',
        fromGroupId: source.groupId,
        targetLeafNodeId: props.nodeId,
        tabId: source.tabId,
        direction,
        floatingWindowId: props.floatingWindowId ?? undefined,
      });
    };

    const handleDragLeave = (event: DragEvent) => {
      // 离开本组表面时清理本组指示（进入子元素不算离开）
      const related = event.relatedTarget as Node | null;
      if (related && (event.currentTarget as Node).contains(related)) return;
      if (dockingDragSession.hover?.groupId === props.groupId) {
        dragOverZone.value = null;
        updateDockingHover(null);
      }
    };

    /** 五向落点指示器 + Non-Opaque Ghost 预览（原位不动，只画半透明虚影）。 */
    const renderDockingIndicator = (): VNodeChild => {
      if (!isDockingTarget.value) return null;
      const zones: DropZone[] = ['top', 'bottom', 'left', 'right', 'center'];
      return h('div', { class: 'main-ui-dock-indicator', 'aria-hidden': 'true' }, [
        ...zones.map((zone) => {
          const legal = zoneLegal(zone, dockingDragSession.source?.editorKind);
          const active = dragOverZone.value === zone;
          return h('div', {
            class: [
              'main-ui-dock-indicator__zone',
              `is-${zone}`,
              active && legal ? 'is-active' : '',
              legal ? '' : 'is-disabled',
            ],
            title: legal ? `Dock ${zone}` : `Dock ${zone} not allowed`,
          }, legal && zone !== 'center' ? [h('div', { class: 'main-ui-dock-indicator__ghost' })] : undefined);
        }),
      ]);
    };

    return () => h('section', {
      class: ['main-ui-leaf-group', layoutDoc.value.activeGroupId === props.groupId ? 'is-active' : ''],
      onPointerdown: () => { if (!props.floatingWindowId) void dispatch({ type: 'layout/setActiveGroup', groupId: props.groupId }); },
      onDragover: handleDragOver,
      onDrop: handleDrop,
      onDragleave: handleDragLeave,
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
            onDragstart: (event: DragEvent) => {
              event.dataTransfer?.setData('text/main-ui-tab', JSON.stringify({ groupId: props.groupId, tabId }));
              const editor = workspace.value.editors[tab.editorInstanceId];
              if (editor) beginDockingDrag({ groupId: props.groupId, tabId, editorKind: editor.kind });
            },
            onDragend: () => { endDockingDrag(); dragOverZone.value = null; },
            onDragover: (event: DragEvent) => event.preventDefault(),
            onDrop: (event: DragEvent) => {
              event.preventDefault();
              event.stopPropagation(); // tab 条自身排序/插入优先，不冒泡到组的停靠落点处理
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
        props.floatingWindowId ? null : h('div', { class: 'main-ui-tab-strip__actions' }, [
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
          canPopout.value ? h('button', {
            class: 'main-ui-mini-button',
            type: 'button',
            title: 'Pop out to floating window',
            onClick: () => popout(),
          }, [renderIconToken('popout')]) : null,
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
      renderDockingIndicator(),
    ]);
  },
});
