import { computed, defineComponent, h } from 'vue';
import { useWorkbench } from '../composables/useWorkbench';
import { renderIconToken } from './IconToken';

export const ActivityBar = defineComponent({
  name: 'ActivityBar',
  setup() {
    const { runtime, document, dispatch } = useWorkbench();
    const workspaces = computed(() => runtime.core.workspaces.list());
    const settingsEditor = computed(() => runtime.core.editors.list().find((editor) => {
      const isAvailable = editor.availability.allowedWorkspaceIds.includes(document.value.activeWorkspaceId);
      const looksLikeSettings = editor.kind.includes('settings') || editor.title.toLowerCase().includes('settings') || editor.title.includes('设置');
      return isAvailable && looksLikeSettings && editor.capability.allowModalOverlay;
    }));

    return () => h('aside', { class: 'main-ui-activity-bar', 'aria-label': 'Workspaces' }, [
      h('div', { class: 'main-ui-activity-bar__top' }, workspaces.value.map((workspace) => h('button', {
        class: ['main-ui-activity-button', workspace.id === document.value.activeWorkspaceId ? 'is-active' : ''],
        title: workspace.title,
        type: 'button',
        onClick: () => void dispatch({ type: 'workspace/switch', workspaceId: workspace.id }),
      }, [
        h('span', { class: 'main-ui-activity-button__icon' }, [renderIconToken(workspace.icon, workspace.title.slice(0, 2).toUpperCase())]),
        h('span', { class: 'main-ui-activity-button__label' }, workspace.title),
      ]))),
      settingsEditor.value ? h('div', { class: 'main-ui-activity-bar__bottom' }, [
        h('button', {
          class: 'main-ui-activity-button main-ui-settings-entry',
          title: settingsEditor.value.title,
          type: 'button',
          onClick: () => void dispatch({ type: 'overlay/open', request: { editorKind: settingsEditor.value!.kind } }),
        }, [
          h('span', { class: 'main-ui-activity-button__icon' }, [renderIconToken('settings')]),
          h('span', { class: 'main-ui-activity-button__label' }, settingsEditor.value.title),
        ]),
      ]) : null,
    ]);
  },
});
