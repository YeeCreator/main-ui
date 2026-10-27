import { defineComponent, h, type PropType } from 'vue';

/**
 * SurfaceShell —— 应用面的可选通用壳（MUI 拥有的 GUI 原语）。
 *
 * 只提供骨架与样式钩子：标题栏（标题 / 副标题 / 返回按钮 / 右侧操作区）+ 主体。
 * **不内置任何业务表单、按钮组或布局分栏** —— 面的内容与内部结构由宿主决定。
 *
 * 与 `StageView` 的区别：`StageView` 是「全屏专注面」的完整壳（含状态栏与左右面板）；
 * `SurfaceShell` 更薄，只解决「标题 + 返回 + 主体」，适用于不需要状态栏与侧栏的面。
 *
 * Examples:
 *   ```vue
 *   <SurfaceShell title="选项" :on-back="() => back()">
 *     <OptionsForm />
 *   </SurfaceShell>
 *   ```
 */
export const SurfaceShell = defineComponent({
  name: 'SurfaceShell',
  props: {
    /** 标题文本。留空则不渲染标题区。 */
    title: { type: String, default: '' },
    /** 副标题（小字，显示在标题下方）。 */
    subtitle: { type: String, default: '' },
    /**
     * 传入则显示返回按钮并在此回掉；不传则不渲染返回按钮（如栈根面）。
     * 显式用函数而非布尔 + emit：避免宿主忘记绑定 @back 时按钮可点却无反应。
     */
    onBack: {
      type: Function as unknown as PropType<(() => void) | null>,
      default: null,
    },
    /** 返回按钮文案。 */
    backLabel: { type: String, default: '返回' },
    /** 主题快照（脱离 WorkbenchShell 独立渲染时用于同步 data-mui-theme）。 */
    theme: {
      type: String as PropType<'light' | 'dark' | 'high-contrast' | 'system' | null>,
      default: null,
    },
  },
  setup(props, { slots }) {
    return () => {
      const hasHeader = Boolean(props.title || props.subtitle || props.onBack || slots.actions);
      const header = hasHeader
        ? h('header', { class: 'main-ui-surface-shell__header' }, [
            props.onBack
              ? h(
                  'button',
                  {
                    type: 'button',
                    class: 'main-ui-surface-shell__back',
                    onClick: () => props.onBack?.(),
                  },
                  props.backLabel,
                )
              : null,
            h('div', { class: 'main-ui-surface-shell__heading' }, [
              props.title
                ? h('h2', { class: 'main-ui-surface-shell__title' }, props.title)
                : null,
              props.subtitle
                ? h('p', { class: 'main-ui-surface-shell__subtitle' }, props.subtitle)
                : null,
            ]),
            slots.actions
              ? h('div', { class: 'main-ui-surface-shell__actions' }, slots.actions())
              : null,
          ])
        : null;

      return h(
        'div',
        {
          class: 'main-ui-surface-shell',
          'data-mui-theme':
            props.theme && props.theme !== 'system' ? props.theme : null,
        },
        [header, h('div', { class: 'main-ui-surface-shell__body' }, slots.default?.() ?? [])],
      );
    };
  },
});
