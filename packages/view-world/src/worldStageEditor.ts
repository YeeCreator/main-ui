/**
 * view-world/worldStageEditor —— 通用「世界舞台」编辑器工厂（宿主薄壳）。
 *
 * 作用：把「WorldView + 维度开关 + 三维后端注入」这套样板收成**一个工厂函数**，
 * 使七个宿主仓的接入各自只需十几行（设计 §十九 9「宿主只注册一次」）。
 *
 * 不变量（为什么放在 `view-world` 而不是各仓）：
 * - 本文件**不 import 任何渲染库**（three / pixi 都不 import）。三维后端由宿主
 *   经 `backends` 参数注入，故 `view-world` 仍然对渲染库零依赖。
 * - 生成的是一个**视图模板的渲染器**（`rendererKey` 用的组件），不是新模板包；
 *   它由宿主注册到自己的 editorKind 上，因此不违反「一模板一包」。
 *
 * 用法（宿主 runtime）：
 * ```ts
 * import { createThreeBackend } from '@main-ui/render-3d';
 * import { createWorldStageRenderer, registerThreeBackend } from '@main-ui/view-world';
 *
 * const backends = registerThreeBackend({ factory: createThreeBackend });
 * registerEditorRenderer('cg-world-stage', createWorldStageRenderer({ backends, storageKey: 'cg:dimension' }));
 * ```
 */
import { defineComponent, h, type Component, type PropType } from 'vue';
import type { ViewportBackendFactory } from '@main-ui/core/rendering';
import type { EntitySnapshot, GridSpec, ViewBox } from './types';
import { WorldView } from './WorldView';
import { WorldDimensionToggle } from './WorldDimensionToggle';
import { useWorldDimension } from './useWorldDimension';

/** 宿主编辑器渲染上下文（只取需要的两个字段，避免拉入整个 main-ui 类型）。 */
export interface WorldStageRenderContextLike {
  editor: { id: string; payload?: Record<string, unknown> };
}

/** 舞台 payload 形状（宿主可把它写进 editor payload）。 */
export interface WorldStagePayload {
  snapshot?: EntitySnapshot | null;
  grid?: GridSpec | null;
  viewBox?: ViewBox | null;
  /** 初始维度（缺省读设置存储）。 */
  dimension?: 2 | 3;
}

export interface CreateWorldStageRendererOptions {
  /** 三维后端集合（键 → 工厂）；无三维后端时开关不渲染。 */
  backends?: Record<string, ViewportBackendFactory> | null;
  /** 维度设置的存储键（缺省 `view-world:dimension`）。 */
  storageKey?: string;
  /** 自定义 payload 解析（缺省读 `context.editor.payload` 的四个字段）。 */
  resolvePayload?: (context: WorldStageRenderContextLike) => WorldStagePayload;
  /** 视口交互缺省（缺省 panOnDrag=true、interactive=true）。 */
  interactive?: boolean;
  panOnDrag?: boolean;
}

const defaultResolvePayload = (context: WorldStageRenderContextLike): WorldStagePayload => {
  const payload = context.editor.payload ?? {};
  return {
    snapshot: (payload.snapshot as EntitySnapshot | null | undefined) ?? null,
    grid: (payload.grid as GridSpec | null | undefined) ?? null,
    viewBox: (payload.viewBox as ViewBox | null | undefined) ?? null,
    dimension: payload.dimension === 3 ? 3 : payload.dimension === 2 ? 2 : undefined,
  };
};

/**
 * 创建「世界舞台」编辑器渲染器。
 *
 * @param options 后端集合与设置键。
 * @returns 可直接交给 `runtime.vue.registerEditorRenderer(key, component)` 的组件。
 * @example
 * ```ts
 * const renderer = createWorldStageRenderer({ backends, storageKey: 'xg:dimension' });
 * runtime.vue.registerEditorRenderer('xg-world-stage', renderer);
 * ```
 */
export function createWorldStageRenderer(options: CreateWorldStageRendererOptions = {}): Component {
  const resolvePayload = options.resolvePayload ?? defaultResolvePayload;

  return defineComponent({
    name: 'WorldStageEditorAdapter',
    props: {
      context: { type: Object as PropType<WorldStageRenderContextLike>, required: true },
    },
    setup(props) {
      const dimension = useWorldDimension({
        backends: options.backends ?? null,
        storageKey: options.storageKey,
        initial: props.context.editor.payload?.dimension === 3 ? 3 : 2,
      });

      return () => {
        const payload = resolvePayload(props.context);
        return h('div', { class: 'main-ui-world-stage', style: { position: 'relative', width: '100%', height: '100%' } }, [
          h(WorldView, {
            snapshot: payload.snapshot ?? null,
            grid: payload.grid ?? null,
            viewBox: payload.viewBox ?? null,
            interactive: options.interactive ?? true,
            panOnDrag: options.panOnDrag ?? true,
            dimension: dimension.dimension.value,
            backends: options.backends ?? null,
            editorInstanceId: props.context.editor.id,
          }),
          h(
            'div',
            { class: 'main-ui-world-stage__toggle', style: { position: 'absolute', top: '8px', right: '8px', zIndex: '2' } },
            // 未装三维后端时组件内部返回 null（开关不渲染）
            [h(WorldDimensionToggle, { controller: dimension })],
          ),
        ]);
      };
    },
  });
}
