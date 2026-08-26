import { computed, defineComponent, h, nextTick, onMounted, ref } from 'vue';
import { searchQuickOpen, type QuickOpenItem } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';

export const CommandPalette = defineComponent({
  name: 'CommandPalette',
  props: { open: { type: Boolean, default: false } },
  emits: { close: () => true },
  setup(props, { emit }) {
    const { runtime } = useWorkbench();
    const query = ref(''); const selected = ref(0); const input = ref<HTMLInputElement>();
    const items = computed(() => searchQuickOpen(query.value, { commands: runtime.core.commands.list() }).filter((item) => item.kind === 'command' && runtime.core.isCommandEnabled(item.commandId!)));
    const choose = async (item: QuickOpenItem) => { if (!item.commandId) return; await runtime.core.executeCommand(item.commandId); emit('close'); };
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') emit('close'); else if (event.key === 'ArrowDown') selected.value = Math.min(selected.value + 1, items.value.length - 1); else if (event.key === 'ArrowUp') selected.value = Math.max(selected.value - 1, 0); else if (event.key === 'Enter' && items.value[selected.value]) void choose(items.value[selected.value]); };
    onMounted(() => { if (props.open) void nextTick(() => input.value?.focus()); });
    return () => !props.open ? null : h('div', { class: 'main-ui-quick-overlay', onKeydown: keydown }, [h('section', { class: 'main-ui-quick-panel', role: 'dialog', 'aria-label': 'Command Palette' }, [h('input', { ref: input, value: query.value, placeholder: 'Type a command', 'data-main-ui-scope': 'input', onInput: (e: Event) => { query.value = (e.target as HTMLInputElement).value; selected.value = 0; } }), h('ul', { role: 'listbox' }, items.value.map((item, index) => h('li', { key: item.id }, [h('button', { type: 'button', class: index === selected.value ? 'is-selected' : null, onClick: () => void choose(item) }, [h('strong', item.label), item.description ? h('small', item.description) : null])])))] )]);
  },
});
