import { defineComponent, h, type CSSProperties, type PropType } from 'vue';

/**
 * ToolbarView —— 工具栏轻组件（MUI 拥有的 GUI 原语，v0.6 起）。
 *
 * 纯壳零业务：左 / 中 / 右三区插槽的水平工具条，按钮与内容由宿主注入。
 * 面向 app 型宿主的舞台顶栏（如 YeeGames 对局工具栏：悔棋 / 重置 / 视口复位）。
 * 颜色消费 --mui-* 令牌；可选 `theme` prop 供独立渲染同步。
 */
export const ToolbarView = defineComponent({
  name: 'ToolbarView',
  props: {
    /** 工具栏高度（CSS 长度）。 */
    height: { type: String, default: '44px' },
    theme: { type: String as PropType<'light' | 'dark' | 'high-contrast' | 'system' | null>, default: null },
  },
  setup(props, { slots }) {
    return () => h('div', {
      class: 'main-ui-toolbar-view',
      'data-mui-theme': props.theme && props.theme !== 'system' ? props.theme : null,
      style: { ...rootStyle, height: props.height },
    }, [
      h('div', { class: 'main-ui-toolbar-view__left', style: sideStyle }, slots.left?.() ?? []),
      h('div', { class: 'main-ui-toolbar-view__center', style: centerStyle }, slots.center?.() ?? slots.default?.() ?? []),
      h('div', { class: 'main-ui-toolbar-view__right', style: sideStyle }, slots.right?.() ?? []),
    ]);
  },
});

const rootStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px', boxSizing: 'border-box',
  padding: '0 12px', width: '100%',
  background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
  borderBottom: '1px solid var(--mui-color-border)',
};
const sideStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto',
};
const centerStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: '1 1 auto',
  minWidth: '0',
};
