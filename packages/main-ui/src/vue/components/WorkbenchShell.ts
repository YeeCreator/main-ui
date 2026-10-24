import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue';
import { useWorkbench } from '../composables/useWorkbench';
import { ActivityBar } from './ActivityBar';
import { FloatingWindowLayer } from './FloatingWindowLayer';
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
  props: {
    /** opt-in：隐藏工作区活动栏（app 型宿主用主菜单/landing 入口替代）。默认 true = 既有行为不变。 */
    activityBar: { type: Boolean, default: true },
    /**
     * 受控的侧栏 view id（宿主按视角预设面板）。
     *
     * 透传给 `Sidebar`：非 null 时优先于用户点击，宿主改它即可强制切面板。
     * 不传则沿用侧栏自身的「用户选择 → defaultVisible → 首个」规则（既有行为不变）。
     */
    sidebarViewId: { type: String, default: null },
    /** 侧栏作用域键；变化时清空用户选择，使 `sidebarViewId` 建议重新生效。 */
    sidebarScopeKey: { type: String, default: '' },
    /** 侧栏建议宽度（px）。专精型面板需要更多横向空间，否则控件会被截断。 */
    sidebarWidth: { type: Number, default: null },
  },
  setup(props) {
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

    return () => h('div', { class: ['main-ui-shell', themeClass.value, props.activityBar ? null : 'main-ui-shell--no-activity-bar'], 'data-mui-theme': document.value.theme.resolvedMode, role: 'application', 'aria-label': 'main-ui workbench' }, [
      props.activityBar ? h(ActivityBar) : null,
      h(Sidebar, { activeViewId: props.sidebarViewId, scopeKey: props.sidebarScopeKey, preferredWidth: props.sidebarWidth }),
      h('div', { class: 'main-ui-shell__body' }, [
        h(TitleBar),
        h(MenuBar),
        h(WorkbenchLayoutRenderer),
        h(BottomPanel),
        h(StatusBar),
      ]),
      h(FloatingWindowLayer),
      h(OverlayLayer),
      h(CommandPalette, { open: paletteOpen.value, onClose: () => { paletteOpen.value = false; } }),
      h(QuickOpen, { open: quickOpen.value, onClose: () => { quickOpen.value = false; } }),
    ]);
  },
});
