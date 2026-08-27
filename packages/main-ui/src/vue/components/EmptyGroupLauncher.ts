import { computed, defineComponent, h, type PropType } from 'vue';
import type { GroupId } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';

export const EmptyGroupLauncher = defineComponent({
  name: 'EmptyGroupLauncher',
  props: {
    groupId: {
      type: String as PropType<GroupId>,
      required: true,
    },
  },
  setup(props) {
    const { document } = useWorkbench();

    return () => h('div', {
      class: 'main-ui-empty-launcher',
      'aria-label': `Empty group ${props.groupId} in workspace ${document.value.activeWorkspaceId}`,
    });
  },
});
