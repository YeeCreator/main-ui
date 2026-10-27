import {
  defineComponent,
  h,
  KeepAlive,
  provide,
  ref,
  watch,
  type PropType,
  type Slots,
} from 'vue';
import {
  createSurfaceStack,
  SurfaceStackKey,
  type SurfaceDescriptor,
  type SurfacePayload,
} from '../composables/useSurfaceStack';

/**
 * 面切换动效。默认 `none` —— 不把动画依赖强加给宿主。
 */
export type SurfaceTransition = 'none' | 'fade' | 'slide';

/**
 * SurfaceHost —— 应用面渲染器（MUI 拥有的 GUI 原语）。
 *
 * 职责：按当前面 id **互斥**渲染对应 Surface 组件，切换即整屏替换。
 * 与 Workspace 正交：Surface 决定「此刻是哪一整屏」，Workspace 决定「这一屏内部用哪些工具」。
 *
 * 关键约束：
 *   1. Surface 不进 Docking 布局树，不实现 View 生命周期，不参与布局快照；
 *   2. 一次只挂载一个面；切面即旧面 unmount（依赖此点释放渲染循环 / 连接的宿主可正常工作）；
 *   3. `payload` 是运行期传参，**不落盘**（区别于 editor 的持久化 payload）；
 *   4. 域无关：本组件与类型零游戏 / 学科词汇，多步向导、结账流程等任意场景等价可用。
 *
 * Examples:
 *   ```vue
 *   <MainUiProvider :runtime="runtime">
 *     <SurfaceHost :surfaces="surfaces" initial="hall" @change="onChange" />
 *   </MainUiProvider>
 *   ```
 */
export const SurfaceHost = defineComponent({
  name: 'SurfaceHost',
  props: {
    /** 全部可用面。 */
    surfaces: {
      type: Array as PropType<SurfaceDescriptor[]>,
      default: () => [],
    },
    /** 初始面 id（应为 root 面）。缺省取第一个 `root` 面，再缺省取第一个面。 */
    initial: { type: String, default: '' },
    /** 切换动效。 */
    transition: { type: String as PropType<SurfaceTransition>, default: 'none' },
    /** 是否缓存已访问过的面（`KeepAlive`）。默认 false：切面即卸载。 */
    keepAlive: { type: Boolean, default: false },
    /**
     * 外部注入的栈（可选）。缺省时组件自建。
     * 宿主若需在组件外调用 `open`，可先建栈再传入。
     */
    stack: { type: Object as PropType<ReturnType<typeof createSurfaceStack>>, default: null },
  },
  emits: {
    /** 面已切换。 */
    change: (_id: string, _payload?: SurfacePayload) => true,
    /** 发生一次返回。 */
    back: () => true,
  },
  setup(props, { emit, slots }) {
    const resolveInitial = (): string => {
      if (props.initial) return props.initial;
      const rootSurface = props.surfaces.find((surface) => surface.root);
      return rootSurface?.id ?? props.surfaces[0]?.id ?? '';
    };

    const ownStack = createSurfaceStack({ initial: resolveInitial() });
    const stack = props.stack ?? ownStack;

    // 供面组件 inject：面内部直接 open/back，不需要层层传 props。
    provide(SurfaceStackKey, stack);

    // 记录上一次渲染的面与栈深，用于在切换后发出 change / back。
    const rendered = ref(stack.active.value);
    const previousDepth = ref(stack.stack.value.length);

    watch(
      stack.active,
      (id) => {
        if (id === rendered.value) return;
        rendered.value = id;
        const depth = stack.stack.value.length;
        const wentBack = depth < previousDepth.value;
        previousDepth.value = depth;
        emit('change', id, stack.payloads.value[id]);
        // 栈深减小判定为「返回」，同时发出 back（两者语义不同，宿主可能只关心其一）。
        if (wentBack) {
          emit('back');
        }
      },
      { flush: 'post' },
    );

    const renderSurface = (): unknown => {
      const id = stack.active.value;
      const descriptor = props.surfaces.find((surface) => surface.id === id);
      if (!descriptor) {
        // 缺失兜底：渲染 #missing slot，无则空白不报错（避免宿主运行时崩溃）。
        return slots.missing ? slots.missing({ id }) : null;
      }
      const payload = stack.payloads.value[id];
      if (slots.default) {
        return slots.default({ descriptor, payload });
      }
      return h(descriptor.component, { key: id, payload });
    };

    const transitionClass = (): string | null => {
      if (props.transition === 'fade') return 'main-ui-surface-host--fade';
      if (props.transition === 'slide') return 'main-ui-surface-host--slide';
      return null;
    };

    return () => {
      const body = renderSurface();
      const content = props.keepAlive
        ? h(KeepAlive, null, { default: () => body })
        : body;
      return h(
        'div',
        {
          class: ['main-ui-surface-host', transitionClass()],
          'data-mui-surface': stack.active.value,
        },
        content as never,
      );
    };
  },
});

export type SurfaceHostSlots = Slots & {
  /** 完全接管渲染：(descriptor, payload) => VNode。 */
  default?: (args: { descriptor: SurfaceDescriptor; payload?: SurfacePayload }) => unknown;
  /** 当前面 id 无对应 descriptor 时的兜底。 */
  missing?: (args: { id: string }) => unknown;
};
