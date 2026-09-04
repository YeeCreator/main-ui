import { defineComponent, h, type PropType } from 'vue';

/**
 * StageView —— 独占舞台壳（MUI 拥有的 GUI 原语，v0.6 起）。
 *
 * 面向 app 型宿主的「全屏专注面」（如 YeeGames 游戏主舞台）：
 *   上（返回 + 标题 + 动作区）· 下（状态栏）· 左/右（可选面板插槽）· 中央（默认插槽 = 主视口/内容）。
 * 纯壳零业务：中央内容由宿主注入（游戏 Screen / 引擎视口）；返回经 `back` emit 出。
 * 左右插槽缺省时不渲染（中央独占）。颜色消费 --mui-* 令牌；可选 `theme` prop 供独立渲染同步。
 *
 * 说明：中央「主视口」的具体渲染引擎（view-2d / scene-kit / pixi 等）由宿主按选型决定，
 * StageView 只提供布局壳，与引擎解耦。
 */
export const StageView = defineComponent({
  name: 'StageView',
  props: {
    title: { type: String, default: '' },
    /** 底部状态栏文本（也可用 statusBar 插槽覆盖）。 */
    status: { type: String, default: '' },
    backLabel: { type: String, default: '返回' },
    /** 是否显示返回按钮（嵌入工作台等场景可关）。 */
    backable: { type: Boolean, default: true },
    theme: { type: String as PropType<'light' | 'dark' | 'high-contrast' | 'system' | null>, default: null },
  },
  emits: ['back'],
  setup(props, { emit, slots }) {
    return () => h('div', {
      class: 'main-ui-stage',
      'data-mui-theme': props.theme && props.theme !== 'system' ? props.theme : null,
    }, [
      h('div', { class: 'main-ui-stage__top' }, [
        props.backable
          ? h('button', { type: 'button', class: 'main-ui-stage__back', onClick: () => emit('back') }, props.backLabel)
          : null,
        props.title ? h('div', { class: 'main-ui-stage__title' }, props.title) : null,
        h('div', { class: 'main-ui-stage__top-actions' }, slots.topActions?.() ?? []),
      ]),
      h('div', { class: 'main-ui-stage__body' }, [
        slots.left ? h('aside', { class: 'main-ui-stage__side main-ui-stage__side--left' }, slots.left()) : null,
        h('div', { class: 'main-ui-stage__center' }, slots.default?.() ?? []),
        slots.right ? h('aside', { class: 'main-ui-stage__side main-ui-stage__side--right' }, slots.right()) : null,
      ]),
      h('div', { class: 'main-ui-stage__status' }, slots.statusBar?.() ?? (props.status || '')),
    ]);
  },
});
