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

    const rootStyle = computed<CSSProperties>(() => {
      const columns: string[] = [];
      if (hasLeft.value || !props.collapseEmptySidePanels) columns.push(toCssSize(props.leftPanelWidth, '210px'));
      columns.push('minmax(0, 1fr)');
      if (hasRight.value || !props.collapseEmptySidePanels) columns.push(toCssSize(props.rightPanelWidth, '320px'));
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

      if (hasLeft.value || !props.collapseEmptySidePanels) {
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

      if (hasRight.value || !props.collapseEmptySidePanels) {
        children.push(
          h('aside', { style: { ...PANEL_STYLE, borderLeft: '1px solid var(--mui-color-border, var(--main-ui-border, #d7dbe3))' } }, renderSlot('right')),
        );
      }

      return h('div', { style: rootStyle.value }, children);
    };
  },
});

export default ViewportCanvasShell;
