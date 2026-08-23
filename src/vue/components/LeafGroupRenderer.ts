import { computed, defineComponent, h, type PropType } from 'vue';
import type { EditorDescriptor, GroupId, LayoutNodeId, SplitDirection } from '../../core';
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
        h('div', { class: 'main-ui-tab-strip__tabs' }, group.value.tabIds.map((tabId) => {
          const tab = workspace.value.tabs[tabId];
          if (!tab) {
            return null;
          }
          return h('button', {
            class: ['main-ui-tab', tabId === group.value.activeTabId ? 'is-active' : '', tab.dirty ? 'is-dirty' : '', tab.pinned ? 'is-pinned' : ''],
            type: 'button',
            draggable: true,
            title: tab.title,
            onClick: () => void dispatch({ type: 'editor/activateTab', groupId: props.groupId, tabId }),
            onDragstart: (event: DragEvent) => event.dataTransfer?.setData('text/main-ui-tab', JSON.stringify({ groupId: props.groupId, tabId })),
            onDragover: (event: DragEvent) => event.preventDefault(),
            onDrop: (event: DragEvent) => {
              event.preventDefault();
              const raw = event.dataTransfer?.getData('text/main-ui-tab');
              if (!raw) return;
              try { const source = JSON.parse(raw) as { groupId: string; tabId: string }; const index = group.value.tabIds.indexOf(tabId); void dispatch(source.groupId === props.groupId ? { type: 'editor/reorderTab', groupId: props.groupId, tabId: source.tabId, index } : { type: 'editor/moveTabToGroup', fromGroupId: source.groupId, toGroupId: props.groupId, tabId: source.tabId, index }); } catch { /* ignore malformed drag payload */ }
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
