import { computed, defineComponent, h, ref } from 'vue';
import { searchQuickOpen, type QuickOpenItem } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';

export const QuickOpen = defineComponent({
  name: 'QuickOpen', props: { open: { type: Boolean, default: false } }, emits: { close: () => true },
  setup(props, { emit }) {
    const { runtime, dispatch, document } = useWorkbench(); const query = ref('');
    const items = computed(() => searchQuickOpen(query.value, { editors: runtime.core.editors.list(), workspaces: runtime.core.workspaces.list(), recent: runtime.core.listRecentlyUsedCommands().map((entry) => ({ id: `recent:${entry.commandId}`, label: entry.commandId, kind: 'recent' as const, commandId: entry.commandId, score: 1 })) }));
    const choose = async (item: QuickOpenItem) => { if (item.workspaceId) await dispatch({ type: 'workspace/switch', workspaceId: item.workspaceId }); else if (item.editorKind) await dispatch({ type: 'editor/open', request: { editorKind: item.editorKind } }); else if (item.commandId) await runtime.core.executeCommand(item.commandId); emit('close'); };
    return () => !props.open ? null : h('div', { class: 'main-ui-quick-overlay' }, [h('section', { class: 'main-ui-quick-panel', role: 'dialog', 'aria-label': 'Quick Open' }, [h('input', { autofocus: true, value: query.value, placeholder: 'Open editor or workspace', 'data-main-ui-scope': 'input', onInput: (e: Event) => { query.value = (e.target as HTMLInputElement).value; } }), h('ul', items.value.map((item) => h('li', { key: item.id }, h('button', { type: 'button', onClick: () => void choose(item) }, [h('strong', item.label), h('small', item.kind)]))))])]);
  },
});
