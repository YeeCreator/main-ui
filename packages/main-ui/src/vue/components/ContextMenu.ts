import { defineComponent, h, type PropType } from 'vue';
import type { MenuRenderItem } from '../../core';

export const ContextMenu = defineComponent({
  name: 'ContextMenu', props: { items: { type: Array as PropType<MenuRenderItem[]>, required: true }, x: { type: Number, default: 0 }, y: { type: Number, default: 0 } }, emits: { select: (_item: MenuRenderItem) => true, close: () => true },
  setup(props, { emit }) { return () => h('div', { class: 'main-ui-context-menu', role: 'menu', style: { left: `${props.x}px`, top: `${props.y}px` }, onContextmenu: (e: Event) => e.preventDefault() }, props.items.map((item) => item.separator ? h('div', { class: 'main-ui-menu-separator', role: 'separator', key: item.id }) : h('button', { key: item.id, type: 'button', role: 'menuitem', disabled: !item.enabled, onClick: () => { emit('select', item); emit('close'); } }, item.label))); },
});
