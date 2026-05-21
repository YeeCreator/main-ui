import { defineComponent, h, type PropType, type VNode } from 'vue';
import type { TreeEditorModel, TreeNodeDescriptor } from '../../core';
import { renderIconToken } from './IconToken';

export const TreeEditor = defineComponent({
  name: 'TreeEditor',
  props: {
    model: {
      type: Object as PropType<TreeEditorModel>,
      required: true,
    },
    selectedId: {
      type: String,
      default: null,
    },
  },
  emits: {
    select: (_node: TreeNodeDescriptor) => true,
  },
  setup(props, { emit }) {
    const renderNode = (node: TreeNodeDescriptor, depth: number): VNode => {
      const children = node.children ?? [];
      const isExpanded = node.expanded ?? true;
      const hasChildren = children.length > 0;

      return h('li', { key: node.id, class: 'main-ui-tree-node' }, [
        h('button', {
          class: ['main-ui-tree-node__button', props.selectedId === node.id ? 'is-selected' : null],
          type: 'button',
          title: node.description ?? node.label,
          style: { paddingInlineStart: `${12 + depth * 14}px` },
          onClick: () => emit('select', node),
        }, [
          h('span', { class: 'main-ui-tree-node__caret' }, hasChildren ? (isExpanded ? '▾' : '▸') : '·'),
          node.icon ? h('span', { class: 'main-ui-tree-node__icon' }, [renderIconToken(node.icon)]) : null,
          h('span', { class: 'main-ui-tree-node__body' }, [
            h('span', { class: 'main-ui-tree-node__label' }, node.label),
            node.description ? h('span', { class: 'main-ui-tree-node__description' }, node.description) : null,
          ]),
          node.badge ? h('span', { class: 'main-ui-tree-node__badge' }, node.badge) : null,
        ]),
        hasChildren && isExpanded
          ? h('ul', { class: 'main-ui-tree-node__children' }, children.map((child) => renderNode(child, depth + 1)))
          : null,
      ]);
    };

    return () => h('section', { class: 'main-ui-tree-editor' }, [
      h('header', { class: 'main-ui-tree-editor__header' }, [
        props.model.title ? h('strong', props.model.title) : null,
        props.model.description ? h('p', props.model.description) : null,
      ]),
      props.model.sections.length > 0
        ? h('div', { class: 'main-ui-tree-editor__sections' }, props.model.sections.map((section) => h('section', {
          key: section.id,
          class: 'main-ui-tree-section',
        }, [
          section.title || section.description
            ? h('div', { class: 'main-ui-tree-section__meta' }, [
              section.title ? h('strong', section.title) : null,
              section.description ? h('p', section.description) : null,
            ])
            : null,
          h('ul', { class: 'main-ui-tree-section__list' }, section.nodes.map((node) => renderNode(node, 0))),
        ])))
        : h('div', { class: 'main-ui-tree-editor__empty' }, props.model.emptyState ?? 'No items.'),
    ]);
  },
});