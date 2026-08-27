import { computed, defineComponent, h } from 'vue';
import { useWorkbench } from '../composables/useWorkbench';
import { LayoutNodeRenderer } from './LayoutNodeRenderer';

export const WorkbenchLayoutRenderer = defineComponent({
  name: 'WorkbenchLayoutRenderer',
  setup() {
    const { document } = useWorkbench();
    const workspace = computed(() => document.value.workspaceStates[document.value.activeWorkspaceId]);
    // 最大化时以最大化节点作为有效根节点渲染（原递归内就地替换的等价实现）。
    const effectiveRootNodeId = computed(() => workspace.value.layout.maximizedNodeId ?? workspace.value.layout.rootNodeId);

    return () => h('main', { class: 'main-ui-layout-renderer' }, [
      h(LayoutNodeRenderer, { layout: workspace.value.layout, nodeId: effectiveRootNodeId.value }),
    ]);
  },
});
