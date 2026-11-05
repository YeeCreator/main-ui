import { computed, defineComponent, h, onBeforeUnmount, ref, watch } from 'vue';
import { useWorkbench } from '../composables/useWorkbench';
import { ContributionSurface } from './ContributionSurface';
import {
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  clampSidebarWidth,
  resolveSidebarActiveViewId,
} from '../../core/contribution/sidebar';

/**
 * 侧栏：rail（每个 view 一个按钮）+ 内容区（**只渲染当前激活的那一个**）。
 *
 * 三个关键行为：
 * 1. **一次只显示一个 view** —— 不是把所有面板竖着堆成一列。这是「Views not Apps」的落点：
 *    面板多了不是靠加开关，而是靠 rail 切换。
 * 2. **激活项跟随 workspace 收敛** —— 切 workspace 后原激活 view 可能不在新列表内；
 *    此时退回 `defaultVisible` / 首个，而不是拿 `undefined` 去渲染（旧实现会崩）。
 * 3. **宽度由「边界的 sash」调整，不由栏内控件调整** —— 拖动条骑在侧栏与主区的分界线上，
 *    6px 宽、悬停高亮、光标为 `col-resize`。放在栏内部会让人误以为它是个"控件"，
 *    而不是"两栏的边界"（IDE 世界的既有共识：VS Code 叫 sash）。
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
    const width = ref(clampSidebarWidth(props.preferredWidth ?? 320));
    /** 用户是否手动调过宽度（调过后不再被宿主的建议宽度覆盖）。 */
    let widthTouched = false;
    watch(() => props.preferredWidth, (next) => {
      if (!widthTouched && typeof next === 'number') width.value = clampSidebarWidth(next);
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

    /**
     * 拖动起点。`null` = 未在拖动。
     *
     * 指针移动监听挂到 `window` 而不是 sash 自身：拖动时指针常会跑到 sash 之外
     * （尤其是快速拖到主区或越过侧栏），挂自身会中断。这是所有 resizer 的通行做法。
     */
    let dragStart: { x: number; width: number } | null = null;

    const applyWidth = (next: number): void => {
      widthTouched = true;
      width.value = clampSidebarWidth(next);
    };

    const onSashPointerMove = (event: PointerEvent): void => {
      if (!dragStart) return;
      applyWidth(dragStart.width + (event.clientX - dragStart.x));
    };

    const endSashDrag = (): void => {
      if (!dragStart) return;
      dragStart = null;
      window.removeEventListener('pointermove', onSashPointerMove);
      window.removeEventListener('pointerup', endSashDrag);
      window.removeEventListener('pointercancel', endSashDrag);
      window.document.body.style.removeProperty('cursor');
      window.document.body.style.removeProperty('user-select');
    };

    const startSashDrag = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      /*
       * `preventDefault()` 会顺带取消浏览器对本次按下的默认聚焦行为 ——
       * 分隔条是 `tabindex=0` 的可聚焦元素，若不手动补回焦点，键盘调节（方向键/Home/End）
       * 在鼠标点过之后就再也收不到事件（实测：点完 activeElement 是 body）。
       * 故：先保留 preventDefault（避免拖动时选中文本），再显式 focus。
       */
      event.preventDefault();
      (event.currentTarget as HTMLElement | null)?.focus();
      dragStart = { x: event.clientX, width: width.value };
      window.addEventListener('pointermove', onSashPointerMove);
      window.addEventListener('pointerup', endSashDrag);
      window.addEventListener('pointercancel', endSashDrag);
      // 拖动中锁光标与选区：否则越过主区时光标变回文本、拖动会顺带选中内容
      window.document.body.style.cursor = 'col-resize';
      window.document.body.style.userSelect = 'none';
    };

    /**
     * 键盘调宽（分隔条是 `role="separator"`，按 WAI-ARIA 需可聚焦并响应方向键）。
     * `Home` / `End` 直达上下界。
     */
    const onSashKeydown = (event: KeyboardEvent): void => {
      const step = event.shiftKey ? 48 : 16;
      if (event.key === 'ArrowLeft') applyWidth(width.value - step);
      else if (event.key === 'ArrowRight') applyWidth(width.value + step);
      else if (event.key === 'Home') applyWidth(SIDEBAR_WIDTH_MIN);
      else if (event.key === 'End') applyWidth(SIDEBAR_WIDTH_MAX);
      else return;
      event.preventDefault();
    };

    /** 双击分隔条＝恢复宿主建议宽度（用户宽度偏好清零）。 */
    const resetWidth = (): void => {
      widthTouched = false;
      width.value = clampSidebarWidth(props.preferredWidth ?? 320);
    };

    onBeforeUnmount(endSashDrag);

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
        /*
         * 分隔条**骑在侧栏右缘**（= 侧栏与主区的分界线），绝对定位跨出栏外各 3px。
         *
         * 不塞进 flex 流：那会让它占据栏内空间、被读成"栏里的滑块"；
         * 也不另开栅格列：壳层有活动栏/无活动栏两套列定义，新增一列要同时改两处，
         * 而边界本就与侧栏右缘重合，贴边即可精确落位。
         *
         * 收起态不渲染：没有可调的边界，拖动只会得到一条无处落脚的细线。
         */
        !collapsed.value ? h('div', {
          class: 'main-ui-sidebar-sash',
          role: 'separator',
          tabindex: 0,
          'aria-orientation': 'vertical',
          'aria-label': '调整侧栏宽度',
          'aria-valuemin': SIDEBAR_WIDTH_MIN,
          'aria-valuemax': SIDEBAR_WIDTH_MAX,
          'aria-valuenow': width.value,
          title: '拖动调整侧栏宽度（双击恢复默认）',
          onPointerdown: startSashDrag,
          onKeydown: onSashKeydown,
          onDblclick: resetWidth,
        }, [h('span', { class: 'main-ui-sidebar-sash__handle' })]) : null,
      ]);
    };
  },
});
