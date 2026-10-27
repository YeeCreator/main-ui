import {
  computed,
  inject,
  shallowRef,
  type Component,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue';

/**
 * 面参数 —— 面与面之间的运行期最小传参（如 `{ itemId }`）。
 *
 * 与 editor 的 `payload` 语义不同：editor 的 `payload` 是**持久化恢复参数**（受快照铁律约束，
 * 只存结构与引用）；此处是**运行期传参，不落盘、不入布局快照**。
 */
export type SurfacePayload = Record<string, unknown>;

/**
 * 一个应用面的声明。
 *
 * `component` 是普通 Vue 组件，**不是** IView —— Surface 不进 Docking 布局树，
 * 不实现 `MainUiViewLifecycle`，不参与布局快照。
 */
export type SurfaceDescriptor = {
  /** 面 id，在本宿主内唯一。 */
  id: string;
  /** 显示名（可被壳组件用作标题）。 */
  title: string;
  /** 面的内容组件。 */
  component: Component;
  /** 是否为栈根（`back()` 不会越过它）。缺省 false。 */
  root?: boolean;
  /** 可选副标题 / 说明。 */
  description?: string;
};

/**
 * 应用面栈 API。
 *
 * 语义：Surface 是「此刻整窗显示哪一整屏」，一次只显一个，切换即整屏替换（电视换台）。
 * 与之正交的是 Workspace —— 那管同一份内容内部换哪些工具（Blender 模式）。
 */
export interface SurfaceStackApi {
  /** 当前面 id，恒等于 `stack` 末项。 */
  readonly active: Ref<string>;
  /** 历史栈（含 active，末项为当前）。 */
  readonly stack: Ref<readonly string[]>;
  /** 各面最近一次收到的参数。 */
  readonly payloads: Ref<Readonly<Record<string, SurfacePayload | undefined>>>;
  /** 是否有可返回的历史（栈深 > 1）。 */
  readonly canBack: ComputedRef<boolean>;
  /** 打开一个面（压栈）。对当前面重复调用视为「重入」，只更新参数、不重复压栈。 */
  open(id: string, payload?: SurfacePayload): void;
  /** 返回上一面；已在栈根时无操作。 */
  back(): void;
  /** 清空历史并重置到指定面（缺省回到栈根）。 */
  reset(id?: string): void;
}

export type CreateSurfaceStackOptions = {
  /** 栈根面 id。同时作为初始 `active`。 */
  initial: string;
};

/**
 * 供 `provide` / `inject` 使用的键。
 *
 * 由 `<SurfaceHost>` 在自身 setup 中 provide，面组件通过 `useSurfaceStack()` 取得同一实例，
 * 因此面内部的跳转不需要层层传 props。
 */
export const SurfaceStackKey: InjectionKey<SurfaceStackApi> = Symbol('MainUiSurfaceStack');

/**
 * 创建一个独立的表面栈（不依赖组件上下文）。
 *
 * 用途：① `<SurfaceHost>` 内部自建；② 宿主想在组件外先持有栈（如声明式命令里调用 `open`）；
 * ③ 单元测试。
 *
 * Args:
 *   options: 栈根面 id。为空串时栈为 `['']`，此时不应渲染任何面。
 *
 * Returns:
 *   满足 {@link SurfaceStackApi} 的对象。`active` 与 `stack` 是只读派生，写入只经方法。
 *
 * Examples:
 *   ```ts
 *   const stack = createSurfaceStack({ initial: 'hall' });
 *   stack.open('options', { itemId: 'x' });
 *   stack.back();
 *   ```
 */
export const createSurfaceStack = (options: CreateSurfaceStackOptions): SurfaceStackApi => {
  const root = options.initial;
  const stack = shallowRef<readonly string[]>([root]);
  const payloads = shallowRef<Readonly<Record<string, SurfacePayload | undefined>>>({});

  // active 由 stack 派生，避免两者各自更新造成状态分裂。
  const active = computed(() => {
    const items = stack.value;
    return items.length > 0 ? items[items.length - 1]! : root;
  });
  const canBack = computed(() => stack.value.length > 1);

  const open = (id: string, payload?: SurfacePayload): void => {
    if (!id) return;
    if (payload !== undefined) {
      payloads.value = { ...payloads.value, [id]: payload };
    }
    // 重入同面：只更新参数，不再压栈（否则 back() 需按多次才能退出）。
    if (stack.value[stack.value.length - 1] === id) return;
    stack.value = [...stack.value, id];
  };

  const back = (): void => {
    if (stack.value.length <= 1) return;
    stack.value = stack.value.slice(0, -1);
  };

  const reset = (id?: string): void => {
    stack.value = [id ?? root];
  };

  return { active, stack, payloads, canBack, open, back, reset };
};

/**
 * 取当前 `<SurfaceHost>` 提供的表面栈。
 *
 * Raises:
 *   Error: 不在 `<SurfaceHost>` 之内（且未手动 `provide(SurfaceStackKey, …)`）时抛出。
 *     显式报错优于静默返回空操作 —— 后者会让「点了没反应」难以定位。
 *
 * Examples:
 *   ```ts
 *   // 面组件内部
 *   const { open } = useSurfaceStack();
 *   open('options', { itemId: 'x' });
 *   ```
 */
export const useSurfaceStack = (): SurfaceStackApi => {
  const injected = inject(SurfaceStackKey, null);
  if (!injected) {
    throw new Error(
      'useSurfaceStack must be used inside <SurfaceHost> (or after provide(SurfaceStackKey, stack)).',
    );
  }
  return injected;
};
