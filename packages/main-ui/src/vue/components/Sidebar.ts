import { computed, defineComponent, h, ref, watch } from 'vue';
import { useWorkbench } from '../composables/useWorkbench';
import { ContributionSurface } from './ContributionSurface';
import { resolveSidebarActiveViewId } from '../../core/contribution/sidebar';

/**
 * 侧栏：rail（每个 view 一个按钮）+ 内容区（**只渲染当前激活的那一个**）。
 *
 * 两个关键行为：
 * 1. **一次只显示一个 view** —— 不是把所有面板竖着堆成一列。这是「Views not Apps」的落点：
 *    面板多了不是靠加开关，而是靠 rail 切换。
 * 2. **激活项跟随 workspace 收敛** —— 切 workspace 后原激活 view 可能不在新列表内；
 *    此时退回 `defaultVisible` / 首个，而不是拿 `undefined` 去渲染（旧实现会崩）。
 */
export const Sidebar = defineComponent({
  name: 'Sidebar',
  props: {
    /**
     * 受控激活的 view id。
     *
     * 非 null 时**优先于用户点击选择** —— 宿主改它即可强制切换面板
     * （例如「切到拓扑视角 → 展示拓扑面板」）。该 id 不在当前列表内时自动收敛到默认/首个。
     * 为 null 时退回「用户选择 → defaultVisible → 首个」的既有规则。
     */
    activeViewId: { type: String, default: null },
    /**
     * 作用域键（通常是 workspace id）。
     *
     * 变化时**清空用户选择**，使新的 `activeViewId` 建议生效。
     * 这是「切视角时重排右栏、但视角内仍可自由点 rail」的关键：
     * 若不清空，用户上次点过的面板会跨视角粘住；若每次都清空，
     * 用户在同一视角内点 rail 就没反应。
     */
    scopeKey: { type: String, default: '' },
    /**
     * 建议宽度（px）。
     *
     * 宿主按「当前工作的性质」给宽度：总览型面板（属性/历史）窄即可，
     * 专精型面板（拓扑视图 + 数据表 + 编辑控件）需要更多横向空间，
     * 否则内容会被截断成「剪断（一胞拆」这样的半截按钮。
     * 用户手动拖动过则以用户宽度为准。
     */
    preferredWidth: { type: Number, default: null },
  },
  setup(props) {
    const { runtime, document } = useWorkbench();
    const collapsed = ref(false);
    const width = ref(props.preferredWidth ?? 320);
    /** 用户是否手动调过宽度（调过后不再被宿主的建议宽度覆盖）。 */
    let widthTouched = false;
    watch(() => props.preferredWidth, (next) => {
      if (!widthTouched && typeof next === 'number') width.value = next;
    });
    watch(() => props.scopeKey, () => { widthTouched = false; });
    /** `null` 表示「跟随默认」，非 null 表示用户明确选过。 */
    const userActive = ref<string | null>(null);

    const views = computed(() => runtime.core.contributions.listViews({ workspaceId: document.value.activeWorkspaceId }));
    watch(() => props.scopeKey, () => { userActive.value = null; });
    const activeId = computed(() => resolveSidebarActiveViewId(views.value, {
      userActive: userActive.value,
      suggestedId: props.activeViewId,
    }));
    const activeView = computed(() => views.value.find((view) => view.id === activeId.value));

    return () => {
      if (views.value.length === 0) return null;
      const active = activeView.value;
      return h('aside', {
        class: ['main-ui-sidebar', collapsed.value ? 'is-collapsed' : null],
        style: { width: collapsed.value ? '34px' : `${width.value}px` },
      }, [
        h('div', { class: 'main-ui-sidebar__rail' }, views.value.map((view) => h('button', {
          key: view.id,
          type: 'button',
          title: view.title,
          class: activeId.value === view.id ? 'is-active' : null,
          onClick: () => {
            userActive.value = view.id;
            collapsed.value = false;
          },
        }, view.icon ?? view.title.slice(0, 1)))),
        h('button', {
          type: 'button',
          class: 'main-ui-sidebar__collapse',
          title: collapsed.value ? '展开侧栏' : '收起侧栏',
          onClick: () => { collapsed.value = !collapsed.value; },
        }, collapsed.value ? '›' : '‹'),
        !collapsed.value && active ? h(ContributionSurface, { contribution: active }) : null,
        !collapsed.value ? h('input', {
          class: 'main-ui-sidebar__resize',
          type: 'range',
          min: 240,
          max: 560,
          value: width.value,
          'aria-label': 'Sidebar width',
          onInput: (e: Event) => {
            widthTouched = true;
            width.value = Number((e.target as HTMLInputElement).value);
          },
        }) : null,
      ]);
    };
  },
});
