import { computed, defineComponent, h } from 'vue';
import { useWorkbench } from '../composables/useWorkbench';
import { ActivityBar } from './ActivityBar';
import { OverlayLayer } from './OverlayLayer';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';
import { WorkbenchLayoutRenderer } from './WorkbenchLayoutRenderer';

export const WorkbenchShell = defineComponent({
  name: 'WorkbenchShell',
  setup() {
    const { document } = useWorkbench();
    const themeClass = computed(() => `main-ui-theme--${document.value.theme.resolvedMode}`);

    return () => h('div', { class: ['main-ui-shell', themeClass.value] }, [
      h(ActivityBar),
      h('div', { class: 'main-ui-shell__body' }, [
        h(TitleBar),
        h(WorkbenchLayoutRenderer),
        h(StatusBar),
      ]),
      h(OverlayLayer),
    ]);
  },
});
