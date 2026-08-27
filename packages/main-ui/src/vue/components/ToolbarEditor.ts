import { computed, defineComponent, h, ref, type PropType } from 'vue';
import type { ToolbarActionDescriptor, ToolbarEditorModel } from '../../core';
import { renderIconToken } from './IconToken';

export const ToolbarEditor = defineComponent({
  name: 'ToolbarEditor',
  props: {
    model: {
      type: Object as PropType<ToolbarEditorModel>,
      required: true,
    },
  },
  emits: {
    action: (_action: ToolbarActionDescriptor) => true,
  },
  setup(props, { emit }) {
    const hasActions = computed(() => props.model.groups.some((group) => group.actions.length > 0));
    const activeActionId = ref<string | null>(null);

    const handleAction = (action: ToolbarActionDescriptor) => {
      if (action.disabled) {
        return;
      }
      activeActionId.value = action.id;
      emit('action', action);
    };

    const renderAction = (action: ToolbarActionDescriptor) => h('button', {
      class: [
        'main-ui-toolbar-action',
        action.tone ? `is-${action.tone}` : null,
        activeActionId.value === action.id ? 'is-active' : null,
      ],
      type: 'button',
      title: action.description ?? action.label,
      disabled: action.disabled,
      'aria-pressed': activeActionId.value === action.id,
      onClick: () => handleAction(action),
    }, [
      action.icon ? h('span', { class: 'main-ui-toolbar-action__icon' }, [renderIconToken(action.icon)]) : null,
      h('span', { class: 'main-ui-toolbar-action__label' }, action.label),
      action.badge ? h('span', { class: 'main-ui-toolbar-action__badge' }, action.badge) : null,
    ]);

    return () => h('section', { class: 'main-ui-toolbar-editor' }, [
      h('header', { class: 'main-ui-toolbar-editor__header' }, [
        props.model.title ? h('strong', props.model.title) : null,
        props.model.description ? h('p', props.model.description) : null,
      ]),
      hasActions.value
        ? h('div', { class: 'main-ui-toolbar-editor__groups' }, props.model.groups.map((group) => h('section', {
          key: group.id,
          class: 'main-ui-toolbar-group',
        }, [
          group.title || group.description
            ? h('div', { class: 'main-ui-toolbar-group__meta' }, [
              group.title ? h('strong', group.title) : null,
              group.description ? h('p', group.description) : null,
            ])
            : null,
          h('div', { class: 'main-ui-toolbar-group__actions' }, group.actions.map(renderAction)),
        ])))
        : h('div', { class: 'main-ui-toolbar-editor__empty' }, 'No actions configured.'),
      props.model.statusText ? h('footer', { class: 'main-ui-toolbar-editor__status' }, props.model.statusText) : null,
    ]);
  },
});