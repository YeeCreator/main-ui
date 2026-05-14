import { computed, defineComponent, h } from 'vue';
import { useWorkbench } from '../composables/useWorkbench';
import { renderIconToken } from './IconToken';

export const StatusBar = defineComponent({
  name: 'StatusBar',
  setup() {
    const { runtime, document, dispatch } = useWorkbench();
    const activeWorkspace = computed(() => document.value.workspaceStates[document.value.activeWorkspaceId]);
    const tabCount = computed(() => Object.keys(activeWorkspace.value.tabs).length);
    const groupCount = computed(() => Object.keys(activeWorkspace.value.layout.groups).length);
    const settingsEditor = computed(() => runtime.core.editors.list().find((editor) => {
      const isAvailable = editor.availability.allowedWorkspaceIds.includes(document.value.activeWorkspaceId);
      const looksLikeSettings = editor.kind.includes('settings') || editor.title.toLowerCase().includes('settings') || editor.title.includes('设置');
      return isAvailable && looksLikeSettings && editor.capability.allowModalOverlay;
    }));

    const statusButton = (title: string, icon: string, onClick: () => void, label?: string) => h('button', {
      class: 'main-ui-status-button',
      type: 'button',
      title,
      onClick,
    }, [renderIconToken(icon), label ? h('span', label) : null]);

    return () => h('footer', { class: 'main-ui-status-bar' }, [
      h('div', { class: 'main-ui-status-bar__left' }, [
        settingsEditor.value ? statusButton(settingsEditor.value.title, 'settings', () => void dispatch({
          type: 'overlay/open',
          request: { editorKind: settingsEditor.value!.kind },
        })) : null,
        h('span', `Workspace: ${document.value.activeWorkspaceId}`),
        h('span', `Groups: ${groupCount.value}`),
        h('span', `Tabs: ${tabCount.value}`),
      ]),
      h('div', { class: 'main-ui-status-bar__right' }, [
        statusButton('Light theme', 'sun', () => void dispatch({ type: 'theme/setMode', mode: 'light' }), '浅色'),
        statusButton('Dark theme', 'moon', () => void dispatch({ type: 'theme/setMode', mode: 'dark' }), '深色'),
        statusButton('System theme', 'system', () => void dispatch({ type: 'theme/setMode', mode: 'system' }), '自动'),
        statusButton('Reset layout', 'reset', () => void dispatch({ type: 'layout/resetWorkspace', workspaceId: document.value.activeWorkspaceId }), '重置布局'),
        h('span', `Theme: ${document.value.theme.mode} / ${document.value.theme.resolvedMode}`),
      ]),
    ]);
  },
});
