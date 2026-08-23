import { computed, defineComponent, h, type PropType } from 'vue';
import type { ContributionContext, ViewContribution } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';

export const ContributionSurface = defineComponent({
  name: 'ContributionSurface',
  props: { contribution: { type: Object as PropType<ViewContribution>, required: true } },
  setup(props) {
    const { runtime, document } = useWorkbench();
    const context = computed<ContributionContext>(() => ({ workspaceId: document.value.activeWorkspaceId }));
    return () => {
      const item = props.contribution;
      const renderer = item.rendererKey ? runtime.vue.resolveEditorRenderer(item.rendererKey) : undefined;
      return h('section', { class: 'main-ui-contribution-surface', 'aria-label': item.title }, [
        h('header', { class: 'main-ui-contribution-surface__header' }, [h('strong', item.title), item.description ? h('small', item.description) : null]),
        renderer ? h(renderer, { context: context.value, contribution: item }) : h('div', { class: 'main-ui-contribution-empty' }, [h('strong', `${item.title} provider unavailable`), h('span', item.providerKey ? `Register provider '${item.providerKey}' to populate this view.` : 'This view has no renderer configured.')]),
      ]);
    };
  },
});
