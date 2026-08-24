import { computed, defineComponent, h, ref } from 'vue';
import { evaluateMenuWhen, type MenuRenderItem } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';

export const MenuBar = defineComponent({
  name: 'MenuBar',
  setup() {
    const { runtime } = useWorkbench();
    const openMenu = ref<string | null>(null);
    const items = computed(() => runtime.core.menus.build('menubar', {
      workspaceId: runtime.core.getSnapshot().activeWorkspaceId,
      activeGroupId: runtime.core.getSnapshot().workspaceStates[runtime.core.getSnapshot().activeWorkspaceId]?.layout.activeGroupId ?? null,
    }, (id) => runtime.core.isCommandEnabled(id)));
    const run = async (item: MenuRenderItem) => {
      if (!item.enabled || !item.commandId) return;
      openMenu.value = null;
      await runtime.core.executeCommand(item.commandId);
    };
    const renderItem = (item: MenuRenderItem) => item.separator
      ? h('div', { class: 'main-ui-menu-separator', role: 'separator', key: item.id })
      : h('button', { class: 'main-ui-menu-item', type: 'button', disabled: !item.enabled, onClick: () => void run(item), key: item.id }, [item.label]);
    return () => items.value.length === 0 ? null : h('nav', { class: 'main-ui-menu-bar', 'aria-label': 'Application menu' }, items.value.map((item) => h('div', { class: 'main-ui-menu', key: item.id }, [
      h('button', { class: 'main-ui-menu-trigger', type: 'button', 'aria-expanded': openMenu.value === item.id, onClick: () => { if (item.children?.length) { openMenu.value = openMenu.value === item.id ? null : item.id; } else if (item.commandId) { void run(item); } } }, item.label),
      openMenu.value === item.id && item.children?.length ? h('div', { class: 'main-ui-menu-popup', role: 'menu' }, item.children.map(renderItem)) : null,
    ])));
  },
});
