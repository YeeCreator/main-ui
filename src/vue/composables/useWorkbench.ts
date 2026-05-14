import { computed, inject } from 'vue';
import { MainUiContextKey } from '../provider/context';

export const useWorkbench = () => {
  const context = inject(MainUiContextKey);
  if (!context) {
    throw new Error('useWorkbench must be used inside MainUiProvider.');
  }
  return context;
};

export const useActiveWorkspace = () => {
  const context = useWorkbench();
  return computed(() => context.document.value.workspaceStates[context.document.value.activeWorkspaceId]);
};

export const useActiveGroup = () => {
  const activeWorkspace = useActiveWorkspace();
  return computed(() => {
    const groupId = activeWorkspace.value.layout.activeGroupId;
    return groupId ? activeWorkspace.value.layout.groups[groupId] : null;
  });
};

export const useActiveEditor = () => {
  const activeWorkspace = useActiveWorkspace();
  const activeGroup = useActiveGroup();
  return computed(() => {
    const tabId = activeGroup.value?.activeTabId;
    if (!tabId) {
      return null;
    }
    const tab = activeWorkspace.value.tabs[tabId];
    return tab ? activeWorkspace.value.editors[tab.editorInstanceId] : null;
  });
};

export const useCommandRegistry = () => useWorkbench().runtime.core.commands;

export const useMainUiTheme = () => computed(() => useWorkbench().document.value.theme);
