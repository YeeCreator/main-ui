/**
 * ViewportCanvasShell —— 通用业务画布壳（view-canvas）。
 *
 * 三栏布局（左面板 + 舞台(工具条 + 主体) + 右面板），只承载结构，不理解业务。
 * 左右面板为空时按 `collapseEmptySidePanels` 自动收起。
 *
 * 取代已废弃的 `viewport-2d-kit/vue` 的 `ViewportBusinessCanvasShell`。
 */
import { computed, defineComponent, h, type CSSProperties, type PropType, type VNode } from 'vue';

type SizeLike = number | string;

const toCssSize = (value: SizeLike | undefined, fallback: string): string =>
  typeof value === 'number' ? `${value}px` : (value ?? fallback);

export type ViewportCanvasShellProps = {
  leftPanelWidth?: SizeLike;
  rightPanelWidth?: SizeLike;
  toolbarHeight?: SizeLike;
  collapseEmptySidePanels?: boolean;
};

const ROOT_STYLE: CSSProperties = {
  minWidth: 0,
  minHeight: 0,
  width: '100%',
  height: '100%',
  background: 'var(--mui-color-bg, var(--main-ui-bg, #f8fafc))',
  color: 'var(--mui-color-text, var(--main-ui-text, #0f172a))',
};

const PANEL_STYLE: CSSProperties = {
  minWidth: 0,
  minHeight: 0,
  overflow: 'auto',
  background: 'var(--mui-color-panel, var(--main-ui-panel, #ffffff))',
  padding: '10px',
};

const STAGE_STYLE: CSSProperties = {
  minWidth: 0,
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: '36px minmax(0, 1fr)',
};

const TOOLBAR_STYLE: CSSProperties = {
  minWidth: 0,
  display: 'grid',
  alignItems: 'center',
  gap: '10px',
  padding: '0 10px',
  borderBottom: '1px solid var(--mui-color-border, var(--main-ui-border, #d7dbe3))',
  background: 'var(--mui-color-panel, var(--main-ui-panel, #ffffff))',
};

const TOOLBAR_CENTER_STYLE: CSSProperties = { minWidth: 0, overflow: 'hidden' };
const BODY_STYLE: CSSProperties = { minWidth: 0, minHeight: 0, position: 'relative' };

/**
 * 某一侧面板是否应占位渲染。
 *
 * ## 判据只有两个输入
 *
 * 1. `hasSlot` —— **调用方是否真的提供了该侧插槽内容**；
 * 2. `collapseEmpty` —— 空插槽时是否收起。
 *
 * ## ⚠️ 这条契约有个高发的破法，务必知晓
 *
 * `hasSlot` 必须是**最上游**是否给了内容。中间转发层（宿主在 `Shell` 之上再包一层壳）若
 * 无条件写 `<template #left><slot name="left" /></template>`，转发生成的插槽函数**恒存在**，
 * 于是这里的判断恒为真、`collapseEmpty` 彻底失效，表现为**两侧各留一个只剩内距与边框的空壳**
 * （实测 21px：0 宽内容 + 10px×2 内距 + 1px 边框）。
 *
 * 转发层的正确写法是 `<template v-if="$slots.left" #left>` —— 判据落在「上游给没给」。
 *
 * 本函数只负责「给了判据之后怎么裁决」，无法识破转发层的假阳性；
 * 故它被抽出来单独测，使至少这一层的行为是钉死的。
 */
export const shouldRenderSidePanel = (hasSlot: boolean, collapseEmpty: boolean): boolean =>
  hasSlot || !collapseEmpty;

export const ViewportCanvasShell = defineComponent({
  name: 'ViewportCanvasShell',
  props: {
    leftPanelWidth: { type: [Number, String] as PropType<SizeLike>, default: 210 },
    rightPanelWidth: { type: [Number, String] as PropType<SizeLike>, default: 320 },
    toolbarHeight: { type: [Number, String] as PropType<SizeLike>, default: 36 },
    collapseEmptySidePanels: { type: Boolean, default: true },
  },
  setup(props, { slots }) {
    const hasLeft = computed(() => Boolean(slots.left));
    const hasRight = computed(() => Boolean(slots.right));
    /** 两侧面板是否占位（抽成纯函数以便测试，判据见 `shouldRenderSidePanel`）。 */
    const showLeft = computed(() => shouldRenderSidePanel(hasLeft.value, props.collapseEmptySidePanels));
    const showRight = computed(() => shouldRenderSidePanel(hasRight.value, props.collapseEmptySidePanels));

    const rootStyle = computed<CSSProperties>(() => {
      const columns: string[] = [];
      if (showLeft.value) columns.push(toCssSize(props.leftPanelWidth, '210px'));
      columns.push('minmax(0, 1fr)');
      if (showRight.value) columns.push(toCssSize(props.rightPanelWidth, '320px'));
      return { ...ROOT_STYLE, display: 'grid', gridTemplateColumns: columns.join(' ') };
    });

    const toolbarStyle = computed<CSSProperties>(() => ({
      ...TOOLBAR_STYLE,
      minHeight: toCssSize(props.toolbarHeight, '36px'),
      gridTemplateColumns: 'auto minmax(0, 1fr) auto',
    }));

    const stageStyle = computed<CSSProperties>(() => ({
      ...STAGE_STYLE,
      gridTemplateRows: `${toCssSize(props.toolbarHeight, '36px')} minmax(0, 1fr)`,
    }));

    const renderSlot = (name: string): VNode[] => slots[name]?.() ?? [];

    return () => {
      const children: VNode[] = [];

      if (showLeft.value) {
        children.push(
          h('aside', { style: { ...PANEL_STYLE, borderRight: '1px solid var(--mui-color-border, var(--main-ui-border, #d7dbe3))' } }, renderSlot('left')),
        );
      }

      children.push(
        h('section', { style: stageStyle.value }, [
          h('div', { style: toolbarStyle.value }, [
            h('div', renderSlot('toolbarLeading')),
            h('div', { style: TOOLBAR_CENTER_STYLE }, renderSlot('toolbarCenter')),
            h('div', renderSlot('toolbarTrailing')),
          ]),
          h('div', { style: BODY_STYLE }, slots.default?.() ?? []),
        ]),
      );

      if (showRight.value) {
        children.push(
          h('aside', { style: { ...PANEL_STYLE, borderLeft: '1px solid var(--mui-color-border, var(--main-ui-border, #d7dbe3))' } }, renderSlot('right')),
        );
      }

      return h('div', { style: rootStyle.value }, children);
    };
  },
});

export default ViewportCanvasShell;
