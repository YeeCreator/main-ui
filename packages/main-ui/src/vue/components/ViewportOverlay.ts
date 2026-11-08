/**
 * ViewportOverlay —— 视口叠加控件容器（纯布局，无业务语义）。
 *
 * ## 术语：这类控件叫什么
 *
 * 前端没有一个放之四海皆准的名字，取决于它承载什么：
 *
 * | 名称 | 承载 | 特征 |
 * | --- | --- | --- |
 * | **Floating Toolbar** 悬浮工具栏 | 操作按钮 | 悬浮于内容之上，不占布局 |
 * | **Viewport Overlay** 视口叠加层 | **视口自身**的操作与辅助信息 | 与视口同域、随视口区域定位 |
 * | **Utility Panel** 工具面板 | 辅助信息（小地图、坐标） | 常可折叠 |
 * | **HUD** (Heads-Up Display) | 游戏状态 | 透明叠加，抬头可见 |
 *
 * 本组件是 **Viewport Overlay**（视口叠加层）的容器实现 —— 它同时承载
 * 「操作按钮」与「辅助信息（小地图）」，且位置与视口区域绑定。
 * 三维软件里这个位置叫 **Viewport Navigation Widget** 区。
 *
 * ## 为什么需要它（而不是让每个宿主自己绝对定位）
 *
 * 宿主各自写 `position: absolute; top: 12px; right: 12px` 会带来三类问题：
 *
 * 1. **互相遮挡** —— 各自的偏移量各写各的，加一个控件就得改其他控件的数值；
 * 2. **业主要求一变就得改 N 处** —— 想从右上挪到右下，每个宿主都要改；
 * 3. **间距与对齐不一致** —— 有的 6px、有的 8px，会显得零散。
 *
 * 收进一个容器后，位置、间距、层叠、对齐都只在这一处定义。
 *
 * ## 设计取舍
 *
 * - **不引入拖动 / 折叠**：那会带来「拖到哪了」的持久化问题，而视口叠加层的
 *   价值恰恰在「位置固定、闭着眼也能找到」。需要可移动时由宿主自己包一层。
 * - **`pointer-events: none` 在容器上、`auto` 在子项上**：容器铺满整个角落区域时
 *   不会吞掉下面画布的点击。这是浮层最容易踩的坑 —— 忘了这条就会
 *   「按钮周围一大片区域点不动」。
 * - **四角停靠**：`corner` 只表达「贴哪个角」，具体偏移由 `offset` 控制。
 *   不提供「居中」这类值：视口中央应当留给内容，控件占据中央会挡视线。
 */

import { computed, defineComponent, h, type CSSProperties, type PropType } from 'vue';

/** 停靠的角落。 */
export type ViewportOverlayCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** 排列方向。 */
export type ViewportOverlayDirection = 'row' | 'column';

export const ViewportOverlay = defineComponent({
  name: 'ViewportOverlay',
  props: {
    /** 停靠在哪个角。缺省右下（小地图的惯常位置）。 */
    corner: {
      type: String as PropType<ViewportOverlayCorner>,
      default: 'bottom-right',
    },
    /**
     * 排列方向。缺省 `column`（自上而下）。
     *
     * 小地图 + 按钮的组合通常用 `column`：小地图在上、按钮在下，
     * 或反过来。用 `row` 时按钮会横排在小地图旁边。
     */
    direction: {
      type: String as PropType<ViewportOverlayDirection>,
      default: 'column',
    },
    /**
     * 与视口边缘的距离（像素）。可传单值或 `[水平, 垂直]`。
     *
     * 需要避开其他浮层（如右侧边栏）时用它调。
     */
    offset: {
      type: [Number, Array] as PropType<number | [number, number]>,
      default: 12,
    },
    /** 子项之间的间距（像素）。 */
    gap: { type: Number, default: 6 },
    /** 子项对齐方式（对应 flex 的 align-items）。缺省跟随停靠角。 */
    align: {
      type: String as PropType<'start' | 'end' | 'center' | 'stretch' | null>,
      default: null,
    },
    /** 层叠次序。缺省 2（在内容之上、模态之下）。 */
    zIndex: { type: Number, default: 2 },
    /** 无障碍标签（容器本身不聚焦，仅用于结构语义）。 */
    label: { type: String as PropType<string | null>, default: null },
  },
  setup(props, { slots }) {
    const resolvedOffset = computed<[number, number]>(() => {
      const raw = props.offset;
      if (Array.isArray(raw)) return [raw[0] ?? 12, raw[1] ?? 12];
      return [raw, raw];
    });

    /**
     * 默认对齐：贴着角落时，子项朝「内侧」对齐看起来更整齐。
     * 例如右下角的小地图与按钮都应当右对齐。
     */
    const resolvedAlign = computed(() => {
      if (props.align) return props.align;
      return props.corner === 'top-right' || props.corner === 'bottom-right' ? 'flex-end' : 'flex-start';
    });

    const style = computed<CSSProperties>(() => {
      const [ox, oy] = resolvedOffset.value;
      const vertical = props.corner === 'top-left' || props.corner === 'top-right' ? 'top' : 'bottom';
      const horizontal = props.corner === 'top-left' || props.corner === 'bottom-left' ? 'left' : 'right';
      return {
        position: 'absolute',
        [vertical]: `${oy}px`,
        [horizontal]: `${ox}px`,
        display: 'flex',
        flexDirection: props.direction,
        alignItems: resolvedAlign.value,
        gap: `${props.gap}px`,
        zIndex: props.zIndex,
        /**
         * 容器自身不接收指针事件，只让子项接收。
         *
         * 少了这一条，容器会变成一个「隐形挡板」：它虽然看起来只有几个按钮那么大，
         * 但 flex 容器的盒模型会撑到内容尺寸，加上环绕的间距，
         * 周围一片区域就点不动了 —— 浮层最常见的事故。
         */
        pointerEvents: 'none',
      } as CSSProperties;
    });

    return () => h(
      'div',
      {
        class: ['main-ui-viewport-overlay', `is-${props.corner}`],
        style: style.value,
        'data-corner': props.corner,
        'aria-label': props.label ?? undefined,
      },
      (slots.default?.() ?? []).map((child) => child),
    );
  },
});

export default ViewportOverlay;
