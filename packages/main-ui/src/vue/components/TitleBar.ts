import { computed, defineComponent, h } from 'vue';
import type { LeafNode } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';
import { renderIconToken } from './IconToken';

const findActiveLeaf = (workspace: ReturnType<typeof useWorkbench>['document']['value']['workspaceStates'][string]): LeafNode | null => {
  const activeGroupId = workspace.layout.activeGroupId;
  if (!activeGroupId) {
    return null;
  }

  return Object.values(workspace.layout.nodes).find((node): node is LeafNode => node.type === 'leaf' && node.groupId === activeGroupId) ?? null;
};

export const TitleBar = defineComponent({
  name: 'TitleBar',
  setup() {
    const { runtime, document, dispatch } = useWorkbench();
    const activeWorkspace = computed(() => document.value.workspaceStates[document.value.activeWorkspaceId]);
    const activeWorkspaceDescriptor = computed(() => runtime.core.workspaces.get(document.value.activeWorkspaceId));
    const activeLeaf = computed(() => findActiveLeaf(activeWorkspace.value));

    const splitButton = (icon: string, direction: 'left' | 'right' | 'up' | 'down') => h('button', {
      class: 'main-ui-icon-button',
      type: 'button',
      title: `Split ${direction}`,
      disabled: !activeLeaf.value,
      onClick: () => activeLeaf.value && void dispatch({ type: 'layout/splitLeaf', leafNodeId: activeLeaf.value.id, direction }),
    }, [renderIconToken(icon)]);

    return () => h('header', { class: 'main-ui-title-bar' }, [
      h('div', { class: 'main-ui-title-bar__title' }, [
        h('span', { class: 'main-ui-title-bar__icon' }, [renderIconToken(activeWorkspaceDescriptor.value?.icon)]),
        h('strong', activeWorkspaceDescriptor.value?.title ?? 'main-ui'),
        h('span', activeWorkspaceDescriptor.value?.description ?? 'Vue3 + core workbench'),
      ]),
      h('div', { class: 'main-ui-title-bar__actions' }, [
        splitButton('splitLeft', 'left'),
        splitButton('splitRight', 'right'),
        splitButton('splitUp', 'up'),
        splitButton('splitDown', 'down'),
        h('button', {
          class: 'main-ui-icon-button',
          type: 'button',
          title: 'Reset workspace layout',
          onClick: () => void dispatch({ type: 'layout/resetWorkspace', workspaceId: document.value.activeWorkspaceId }),
        }, [renderIconToken('reset')]),
        h('button', {
          class: 'main-ui-icon-button',
          type: 'button',
          title: document.value.theme.resolvedMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
          onClick: () => void dispatch({
            type: 'theme/setMode',
            mode: document.value.theme.resolvedMode === 'dark' ? 'light' : 'dark',
          }),
        }, [renderIconToken(document.value.theme.resolvedMode === 'dark' ? 'sun' : 'moon')]),
      ]),
    ]);
  },
});
