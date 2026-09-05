import { defineComponent, h, type CSSProperties, type PropType } from 'vue';

/**
 * SidebarView —— 侧栏轻组件（MUI 拥有的 GUI 原语，v0.6 起）。
 *
 * 纯壳零业务：提供标题栏 + 内容区 + 可选页脚的侧栏布局，内容由宿主经插槽注入。
 * 面向 app 型宿主的左/右侧信息面板（如 YeeGames 对局信息 / 棋谱记录侧栏）。
 * 颜色消费 --mui-* 令牌；可选 `theme` prop 供独立渲染同步。
 */
export const SidebarView = defineComponent({
  name: 'SidebarView',
  props: {
    title: { type: String, default: '' },
    /** 固定宽度（CSS 长度）。 */
    width: { type: String, default: '280px' },
    side: { type: String as PropType<'left' | 'right'>, default: 'left' },
    /** 是否显示折叠按钮。 */
    collapsible: { type: Boolean, default: false },
    collapsed: { type: Boolean, default: false },
    theme: { type: String as PropType<'light' | 'dark' | 'high-contrast' | 'system' | null>, default: null },
  },
  emits: ['toggle'],
  setup(props, { emit, slots }) {
    return () => {
      const rootStyle: CSSProperties = {
        display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box',
        width: props.collapsed ? 'auto' : props.width,
        minWidth: props.collapsed ? '36px' : undefined,
        background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
        borderLeft: props.side === 'right' ? '1px solid var(--mui-color-border)' : undefined,
        borderRight: props.side === 'left' ? '1px solid var(--mui-color-border)' : undefined,
      };

      const showHeader = Boolean(props.title || props.collapsible || slots.header);

      return h('aside', {
        class: ['main-ui-sidebar-view', `main-ui-sidebar-view--${props.side}`],
        'data-mui-theme': props.theme && props.theme !== 'system' ? props.theme : null,
        style: rootStyle,
      }, [
        showHeader
          ? h('div', { class: 'main-ui-sidebar-view__header', style: headerStyle }, [
              slots.header
                ? slots.header()
                : h('div', { class: 'main-ui-sidebar-view__title', style: titleStyle }, props.title),
              props.collapsible
                ? h('button', {
                    type: 'button',
                    class: 'main-ui-sidebar-view__toggle',
                    style: toggleStyle,
                    onClick: () => emit('toggle', !props.collapsed),
                  }, props.collapsed ? '▸' : '▾')
                : null,
            ])
          : null,
        props.collapsed
          ? null
          : h('div', { class: 'main-ui-sidebar-view__body', style: bodyStyle }, slots.default?.() ?? []),
        (!props.collapsed && slots.footer)
          ? h('div', { class: 'main-ui-sidebar-view__footer', style: footerStyle }, slots.footer())
          : null,
      ]);
    };
  },
});

const headerStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
  padding: '8px 12px', borderBottom: '1px solid var(--mui-color-border)', flex: '0 0 auto',
};
const titleStyle: CSSProperties = {
  fontSize: '13px', fontWeight: '600', color: 'var(--mui-color-text)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const toggleStyle: CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--mui-color-text-muted)', fontSize: '12px', lineHeight: '1',
};
const bodyStyle: CSSProperties = {
  flex: '1 1 auto', overflow: 'auto', padding: '8px 12px',
};
const footerStyle: CSSProperties = {
  flex: '0 0 auto', padding: '8px 12px', borderTop: '1px solid var(--mui-color-border)',
};
