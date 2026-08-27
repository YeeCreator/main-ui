import { computed, defineComponent, h, type PropType, type VNode } from 'vue';

type SizeLike = number | string;

const toCssSize = (value: SizeLike | undefined, fallback: string): string => {
  if (typeof value === 'number') {
    return `${value}px`;
  }
  return value ?? fallback;
};

const ROOT_STYLE = {
  minWidth: 0,
  minHeight: 0,
  width: '100%',
  height: '100%',
  background: 'var(--main-ui-bg, #f8fafc)',
  color: 'var(--main-ui-text, #0f172a)',
};

const PANEL_STYLE = {
  minWidth: 0,
  minHeight: 0,
  overflow: 'auto',
  background: 'var(--main-ui-panel, #ffffff)',
  padding: '10px',
};

const STAGE_STYLE = {
  minWidth: 0,
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: '36px minmax(0, 1fr)',
};

const TOOLBAR_STYLE = {
  minWidth: 0,
  display: 'grid',
  alignItems: 'center',
  gap: '10px',
  padding: '0 10px',
  borderBottom: '1px solid var(--main-ui-border, #d7dbe3)',
  background: 'var(--main-ui-panel, #ffffff)',
};

const TOOLBAR_CENTER_STYLE = {
  minWidth: 0,
  overflow: 'hidden',
};

const BODY_STYLE = {
  minWidth: 0,
  minHeight: 0,
  position: 'relative',
};

export type ViewportBusinessCanvasShellProps = {
  leftPanelWidth?: SizeLike;
  rightPanelWidth?: SizeLike;
  toolbarHeight?: SizeLike;
  collapseEmptySidePanels?: boolean;
};

/**
 * 通用业务画布壳。
 *
 * 目标：把宿主项目里反复出现的“三栏布局 + stage toolbar + viewport body”样板收口到 V2K。
 * 约束：只负责承载结构，不理解业务节点、规则、状态机与服务。
 */
export const ViewportBusinessCanvasShell = defineComponent({
  name: 'ViewportBusinessCanvasShell',
  props: {
    leftPanelWidth: {
      type: [Number, String] as PropType<SizeLike>,
      default: 210,
    },
    rightPanelWidth: {
      type: [Number, String] as PropType<SizeLike>,
      default: 320,
    },
    toolbarHeight: {
      type: [Number, String] as PropType<SizeLike>,
      default: 36,
    },
    collapseEmptySidePanels: {
      type: Boolean,
      default: true,
    },
  },
  setup(props, { slots }) {
    const hasLeft = computed(() => Boolean(slots.left));
    const hasRight = computed(() => Boolean(slots.right));

    const rootGridStyle = computed(() => {
      const columns: string[] = [];
      if (hasLeft.value || !props.collapseEmptySidePanels) {
        columns.push(toCssSize(props.leftPanelWidth, '210px'));
      }
      columns.push('minmax(0, 1fr)');
      if (hasRight.value || !props.collapseEmptySidePanels) {
        columns.push(toCssSize(props.rightPanelWidth, '320px'));
      }
      return {
        ...ROOT_STYLE,
        display: 'grid',
        gridTemplateColumns: columns.join(' '),
      };
    });

    const toolbarStyle = computed(() => ({
      ...TOOLBAR_STYLE,
      minHeight: toCssSize(props.toolbarHeight, '36px'),
      gridTemplateColumns: 'auto minmax(0, 1fr) auto',
    }));

    const stageStyle = computed(() => ({
      ...STAGE_STYLE,
      gridTemplateRows: `${toCssSize(props.toolbarHeight, '36px')} minmax(0, 1fr)`,
    }));

    const renderSlot = (name: string): VNode[] => slots[name]?.() ?? [];

    return () => {
      const children: VNode[] = [];

      if (hasLeft.value || !props.collapseEmptySidePanels) {
        children.push(
          h(
            'aside',
            {
              style: {
                ...PANEL_STYLE,
                borderRight: '1px solid var(--main-ui-border, #d7dbe3)',
              },
            },
            renderSlot('left'),
          ),
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
          h(
            'aside',
            {
              style: {
                ...PANEL_STYLE,
                borderLeft: '1px solid var(--main-ui-border, #d7dbe3)',
              },
            },
            renderSlot('right'),
          ),
        );
      }

      return h('div', { style: rootGridStyle.value }, children);
    };
  },
});

export default ViewportBusinessCanvasShell;