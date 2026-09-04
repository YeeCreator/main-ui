import { defineComponent, h, type PropType } from 'vue';
import { renderIconToken } from './IconToken';

/** 画廊/列表条目（卡片网格，app 型宿主的游戏/项目列表等）。 */
export type GalleryItem = {
  id: string;
  title: string;
  description?: string;
  /** 缩略图 URL；缺省时用 icon/首字母占位。 */
  image?: string;
  /** 图标 token（见 IconToken）或任意字符（无 image 时占位）。 */
  icon?: string;
  /** 角标（如 YGE / Standalone / Parity）。 */
  badges?: string[];
};

/**
 * GalleryView —— 卡片网格/瀑布流 surface（MUI 拥有的 GUI 原语，v0.6 起）。
 *
 * 面向 app 型宿主的「实例列表」（如 YeeGames 游戏列表）：CSS columns 瀑布流 + 卡片。
 * 纯呈现零业务：条目经 Props 进，选择经 `select`(id) emit 出（意图由宿主裁决）。
 * 颜色消费 --mui-* 令牌；可选 `theme` prop 供脱离 WorkbenchShell 独立渲染时同步 data-mui-theme。
 */
export const GalleryView = defineComponent({
  name: 'GalleryView',
  props: {
    items: { type: Array as PropType<GalleryItem[]>, default: () => [] },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    theme: { type: String as PropType<'light' | 'dark' | 'high-contrast' | 'system' | null>, default: null },
    loading: { type: Boolean, default: false },
    emptyText: { type: String, default: '暂无条目' },
  },
  emits: ['select'],
  setup(props, { emit }) {
    return () => {
      const header = (props.title || props.subtitle)
        ? h('div', { class: 'main-ui-gallery__header' }, [
            props.title ? h('h2', { class: 'main-ui-gallery__title' }, props.title) : null,
            props.subtitle ? h('p', { class: 'main-ui-gallery__subtitle' }, props.subtitle) : null,
          ])
        : null;

      let body;
      if (props.loading) {
        body = h('div', { class: 'main-ui-gallery__empty' }, 'Loading…');
      } else if (props.items.length === 0) {
        body = h('div', { class: 'main-ui-gallery__empty' }, props.emptyText);
      } else {
        body = h('div', { class: 'main-ui-gallery__masonry' }, props.items.map((item) =>
          h('button', {
            type: 'button',
            class: 'main-ui-gallery__card',
            'aria-label': item.title,
            onClick: () => emit('select', item.id),
          }, [
            h('div', { class: 'main-ui-gallery__media', 'aria-hidden': 'true' }, [
              item.image
                ? h('img', { class: 'main-ui-gallery__img', src: item.image, alt: '', loading: 'lazy' })
                : h('div', { class: 'main-ui-gallery__placeholder' }, [renderIconToken(item.icon, item.title.slice(0, 2).toUpperCase())]),
            ]),
            h('div', { class: 'main-ui-gallery__card-body' }, [
              h('div', { class: 'main-ui-gallery__card-title' }, item.title),
              (item.badges && item.badges.length > 0)
                ? h('div', { class: 'main-ui-gallery__badges' }, item.badges.map((badge) => h('span', { class: 'main-ui-gallery__badge' }, badge)))
                : null,
              item.description ? h('div', { class: 'main-ui-gallery__desc' }, item.description) : null,
            ]),
          ]),
        ));
      }

      return h('div', {
        class: 'main-ui-gallery',
        'data-mui-theme': props.theme && props.theme !== 'system' ? props.theme : null,
        'aria-label': props.title || 'Gallery',
      }, [h('div', { class: 'main-ui-gallery__inner' }, [header, body])]);
    };
  },
});
