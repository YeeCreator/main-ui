import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue';
import { useWorkbench } from '../composables/useWorkbench';
import { ActivityBar } from './ActivityBar';
import { OverlayLayer } from './OverlayLayer';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';
import { WorkbenchLayoutRenderer } from './WorkbenchLayoutRenderer';
import { MenuBar } from './MenuBar';
import { CommandPalette } from './CommandPalette';
import { QuickOpen } from './QuickOpen';
import { Sidebar } from './Sidebar';
import { BottomPanel } from './BottomPanel';

export const WorkbenchShell = defineComponent({
  name: 'WorkbenchShell',
  setup() {
    const { document } = useWorkbench();
    const themeClass = computed(() => `main-ui-theme--${document.value.theme.resolvedMode}`);
    const paletteOpen = ref(false);
    const quickOpen = ref(false);
    const onKeydown = (event: KeyboardEvent) => {
      const modifier = /Mac/i.test(navigator.platform) ? event.metaKey : event.ctrlKey;
      if (!modifier || event.altKey) return;
      if (event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); paletteOpen.value = true; quickOpen.value = false; }
      else if (!event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); quickOpen.value = true; paletteOpen.value = false; }
    };
    onMounted(() => window.addEventListener('keydown', onKeydown));
    onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

    return () => h('div', { class: ['main-ui-shell', themeClass.value] }, [
      h(ActivityBar),
      h(Sidebar),
      h('div', { class: 'main-ui-shell__body' }, [
        h(TitleBar),
        h(MenuBar),
        h(WorkbenchLayoutRenderer),
        h(BottomPanel),
        h(StatusBar),
      ]),
      h(OverlayLayer),
      h(CommandPalette, { open: paletteOpen.value, onClose: () => { paletteOpen.value = false; } }),
      h(QuickOpen, { open: quickOpen.value, onClose: () => { quickOpen.value = false; } }),
    ]);
  },
});
