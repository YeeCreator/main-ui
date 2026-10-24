import { computed, defineComponent, h } from 'vue';
import { useWorkbench } from '../composables/useWorkbench';
import { renderIconToken } from './IconToken';

/**
 * 活动栏：workspace 档位切换。
 *
 * **分两区**是本组件的关键设计：
 * - 上半区 = 主视角（`pinToBottom !== true`）。它们共享同一份文档，只是布局预设；
 * - 下半区 = 辅助入口（`pinToBottom === true`，如文件/分析）+ 设置。
 *
 * 若不分区、全部并列，活动栏会读成「一堆并列的 App」——
 * 那正是 GeoGebra 分裂式入口被诟病之处。分区让「主视角 vs 辅助工具」一眼可辨。
 */
export const ActivityBar = defineComponent({
  name: 'ActivityBar',
  setup() {
    const { runtime, document, dispatch } = useWorkbench();
    const workspaces = computed(() => runtime.core.workspaces.list());
    const primaryWorkspaces = computed(() => workspaces.value.filter((workspace) => !workspace.pinToBottom));
    const auxiliaryWorkspaces = computed(() => workspaces.value.filter((workspace) => workspace.pinToBottom));

    const settingsEditor = computed(() => runtime.core.editors.list().find((editor) => {
      const isAvailable = editor.availability.allowedWorkspaceIds.includes(document.value.activeWorkspaceId);
      const looksLikeSettings = editor.kind.includes('settings') || editor.title.toLowerCase().includes('settings') || editor.title.includes('设置');
      return isAvailable && looksLikeSettings && editor.capability.allowModalOverlay;
    }));

    const renderWorkspaceButton = (workspace: (typeof workspaces.value)[number]) => h('button', {
      key: workspace.id,
      class: ['main-ui-activity-button', workspace.id === document.value.activeWorkspaceId ? 'is-active' : ''],
      title: workspace.description ? `${workspace.title} · ${workspace.description}` : workspace.title,
      type: 'button',
      'aria-pressed': workspace.id === document.value.activeWorkspaceId,
      onClick: () => void dispatch({ type: 'workspace/switch', workspaceId: workspace.id }),
    }, [
      h('span', { class: 'main-ui-activity-button__icon' }, [renderIconToken(workspace.icon, workspace.title.slice(0, 2).toUpperCase())]),
      h('span', { class: 'main-ui-activity-button__label' }, workspace.title),
    ]);

    return () => h('aside', { class: 'main-ui-activity-bar', 'aria-label': 'Workspaces' }, [
      h('div', { class: 'main-ui-activity-bar__top' }, primaryWorkspaces.value.map(renderWorkspaceButton)),
      h('div', { class: 'main-ui-activity-bar__bottom' }, [
        ...auxiliaryWorkspaces.value.map(renderWorkspaceButton),
        settingsEditor.value
          ? h('button', {
              class: 'main-ui-activity-button main-ui-settings-entry',
              title: settingsEditor.value.title,
              type: 'button',
              onClick: () => void dispatch({ type: 'overlay/open', request: { editorKind: settingsEditor.value!.kind } }),
            }, [
              h('span', { class: 'main-ui-activity-button__icon' }, [renderIconToken('settings')]),
              h('span', { class: 'main-ui-activity-button__label' }, settingsEditor.value.title),
            ])
          : null,
      ]),
    ]);
  },
});
