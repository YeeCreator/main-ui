/**
 * @main-ui/core —— 嵌入视图托管件（EmbeddedViewHost）与嵌套深度保护。
 *
 * 为复合 View（如 view-sandbox）提供统一的子视图实例托管契约：
 * - 子实例挂载 / 销毁 / 隔离由托管件统一管理，禁止复合 View 手写子实例生命周期。
 * - 嵌套深度保护纯函数确保递归引用链不会无限膨胀（默认最大 8 层）。
 *
 * 约束：框架无关纯 TS，零 DOM / 零 Vue 依赖，可 Node 单测。
 */

/** 默认最大嵌套深度（可由宿主或复合 View 按需覆写）。 */
export const DEFAULT_MAX_NESTING_DEPTH = 8;

/**
 * 嵌套深度校验结果。
 *
 * - `ok`：引用链深度在允许范围内。
 * - `exceeded`：超出最大深度，应降级为占位表面并告警。
 */
export type NestingCheckResult =
  | { status: 'ok'; depth: number }
  | { status: 'exceeded'; depth: number; maxDepth: number };

/**
 * 校验嵌套引用链深度（纯函数，可单测）。
 *
 * 给定一条从根到当前节点的 `refId` 引用链（数组），递归解析每个 refId
 * 指向的子文档是否又包含更深的引用。`resolveRefs` 回调负责取出某 refId
 * 对应的下级 refId 列表（若不存在则返回空数组）。
 *
 * @param rootRefIds 顶层嵌入的 refId 列表
 * @param resolveRefs refId → 下级 refId 列表的解析函数
 * @param maxDepth 最大允许深度（默认 8）
 * @returns NestingCheckResult
 */
export const checkNestingDepth = (
  rootRefIds: readonly string[],
  resolveRefs: (refId: string) => readonly string[],
  maxDepth = DEFAULT_MAX_NESTING_DEPTH,
): NestingCheckResult => {
  let maxFound = 0;

  const visit = (refIds: readonly string[], currentDepth: number, visited: Set<string>): void => {
    if (currentDepth > maxFound) maxFound = currentDepth;
    if (currentDepth >= maxDepth) return;
    for (const refId of refIds) {
      if (visited.has(refId)) continue; // 防止循环引用死循环
      visited.add(refId);
      const children = resolveRefs(refId);
      if (children.length > 0) {
        visit(children, currentDepth + 1, visited);
      }
      visited.delete(refId);
    }
  };

  visit(rootRefIds, 0, new Set());

  if (maxFound >= maxDepth) {
    return { status: 'exceeded', depth: maxFound, maxDepth };
  }
  return { status: 'ok', depth: maxFound };
};

/**
 * 嵌入视图描述符：声明一个被嵌入的子视图实例。
 *
 * 复合 View（如 view-sandbox）以此描述其内部嵌入的全部子视图，
 * 由 `EmbeddedViewHost` 统一管理生命周期。
 */
export type EmbeddedViewDescriptor = {
  /** 子实例唯一标识（同复合 View 内唯一）。 */
  id: string;
  /** 对应已注册的 viewType（如 'view-flow-canvas'、'view-node-canvas'）。 */
  viewType: string;
  /** 传递给子视图的 payload（纯 JSON，不序列化为布局快照）。 */
  payload?: Record<string, unknown>;
};

/**
 * 嵌入视图托管契约（框架无关）。
 *
 * 复合 View 必须经此托管件管理子实例生命周期，禁止手写挂载/销毁逻辑。
 * Vue 渲染层负责将 `mount` / `unmount` 桥接到 Vue 组件生命周期。
 */
export type EmbeddedViewHostContract = {
  /** 当前托管的全部子实例描述。 */
  readonly children: readonly EmbeddedViewDescriptor[];
  /** 注册一个子实例（幂等：相同 id 不重复添加）。 */
  register(descriptor: EmbeddedViewDescriptor): void;
  /** 移除并销毁一个子实例（幂等：不存在时静默）。 */
  unregister(id: string): void;
  /** 销毁全部子实例（幂等，onDestroy 级联调用）。 */
  destroyAll(): void;
  /** 查询子实例是否存在。 */
  has(id: string): boolean;
};

/**
 * 创建嵌入视图托管件实例（纯函数工厂）。
 *
 * `onChildDestroy` 回调用于桥接渲染层的实际销毁逻辑
 * （Vue 层可在其中触发组件卸载、DOM 清理等）。
 */
export const createEmbeddedViewHost = (
  onChildDestroy?: (descriptor: EmbeddedViewDescriptor) => void,
): EmbeddedViewHostContract => {
  const children = new Map<string, EmbeddedViewDescriptor>();
  let destroyed = false;

  const host: EmbeddedViewHostContract = {
    get children(): readonly EmbeddedViewDescriptor[] {
      return [...children.values()];
    },

    register(descriptor: EmbeddedViewDescriptor): void {
      if (destroyed) return;
      if (children.has(descriptor.id)) return; // 幂等
      children.set(descriptor.id, descriptor);
    },

    unregister(id: string): void {
      const existing = children.get(id);
      if (!existing) return; // 幂等
      children.delete(id);
      onChildDestroy?.(existing);
    },

    destroyAll(): void {
      if (destroyed) return;
      destroyed = true;
      for (const descriptor of children.values()) {
        onChildDestroy?.(descriptor);
      }
      children.clear();
    },

    has(id: string): boolean {
      return children.has(id);
    },
  };

  return host;
};
