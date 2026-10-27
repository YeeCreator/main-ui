/**
 * WorldDimensionToggle —— 维度开关控件（WP4）。
 *
 * 设计 §十九 9：开关控件挂宿主 renderer 组合的 `ToolbarView` **右插槽**
 * （与"视口复位"同位）。本组件只负责显示与点击，能力探测与持久化由
 * `useWorldDimension` 完成 —— 因此「只装二维后端的宿主」传进来的
 * `canToggle === false` 时本组件**不渲染任何 DOM**（不占位、不报错）。
 *
 * 用法（宿主工具栏）：
 * ```ts
 * h(ToolbarView, null, {
 *   right: () => h(WorldDimensionToggle, { controller: dim }),
 * });
 * ```
 */
import { defineComponent, h, type PropType } from 'vue';
import type { WorldDimensionController } from './useWorldDimension';

export const WorldDimensionToggle = defineComponent({
  name: 'WorldDimensionToggle',
  props: {
    /** 维度控制器（来自 `useWorldDimension`）。 */
    controller: { type: Object as PropType<WorldDimensionController>, required: true },
    /** 无障碍标签前缀（缺省「切换视图维度」）。 */
    title: { type: String, default: '切换视图维度' },
  },
  setup(props) {
    return () => {
      const controller = props.controller;
      // 未装三维后端：开关**不渲染**（设计 §十九 9 的判据）
      if (!controller.canToggle.value) return null;

      const is3d = controller.dimension.value === 3;
      return h(
        'button',
        {
          type: 'button',
          class: 'main-ui-world-dimension-toggle',
          title: `${props.title}（当前 ${is3d ? '3D' : '2D'}）`,
          'aria-pressed': is3d ? 'true' : 'false',
          'data-dimension': String(controller.dimension.value),
          onClick: () => controller.toggle(),
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            height: '22px',
            padding: '0 8px',
            fontSize: '11px',
            lineHeight: '1',
            borderRadius: '4px',
            border: '1px solid var(--mui-color-border)',
            background: 'transparent',
            color: 'var(--mui-color-text)',
            cursor: 'pointer',
          },
        },
        controller.label.value,
      );
    };
  },
});

export default WorldDimensionToggle;
