import { defineComponent, h, type PropType } from 'vue';
import { renderIconToken } from './IconToken';

/** 主菜单/启动器条目（app 型宿主的 landing 入口）。 */
export type LandingEntry = {
  id: string;
  label: string;
  description?: string;
  /** 图标 token（见 IconToken）或任意字符；缺省用 label 前两个字符。 */
  icon?: string;
};

/**
 * LandingView —— app 主菜单/启动器 surface（MUI 拥有的 GUI 原语，v0.6 起）。
 *
 * 面向 app 型宿主（如 YeeGames）：以大块按钮呈现顶层入口，取代 IDE 式工作区活动栏。
 * 纯呈现零业务：条目经 Props 进，选择经 `select` emit 出（意图由宿主裁决，如路由到
 * 游戏列表 / 设计器 / 设置 / 退出）。颜色消费 --mui-* 令牌；可选 `theme` prop 供脱离
 * WorkbenchShell 独立渲染时同步 data-mui-theme（宿主传已解析的 resolvedMode）。
 */
export const LandingView = defineComponent({
  name: 'LandingView',
  props: {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    entries: { type: Array as PropType<LandingEntry[]>, default: () => [] },
    theme: { type: String as PropType<'light' | 'dark' | 'high-contrast' | 'system' | null>, default: null },
  },
  emits: ['select'],
  setup(props, { emit }) {
    return () => h('div', {
      class: 'main-ui-landing',
      'data-mui-theme': props.theme && props.theme !== 'system' ? props.theme : null,
      role: 'navigation',
      'aria-label': props.title || 'Landing menu',
    }, [
      h('div', { class: 'main-ui-landing__inner' }, [
        (props.title || props.subtitle)
          ? h('div', { class: 'main-ui-landing__header' }, [
              props.title ? h('h1', { class: 'main-ui-landing__title' }, props.title) : null,
              props.subtitle ? h('p', { class: 'main-ui-landing__subtitle' }, props.subtitle) : null,
            ])
          : null,
        h('div', { class: 'main-ui-landing__grid' }, props.entries.map((entry) =>
          h('button', {
            type: 'button',
            class: 'main-ui-landing__card',
            onClick: () => emit('select', entry.id),
          }, [
            h('span', { class: 'main-ui-landing__card-icon' }, [renderIconToken(entry.icon, entry.label.slice(0, 2).toUpperCase())]),
            h('span', { class: 'main-ui-landing__card-body' }, [
              h('span', { class: 'main-ui-landing__card-label' }, entry.label),
              entry.description ? h('span', { class: 'main-ui-landing__card-desc' }, entry.description) : null,
            ]),
          ]),
        )),
      ]),
    ]);
  },
});
