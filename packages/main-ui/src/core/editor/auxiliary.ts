/**
 * 局部微件契约（内容-表现分离）。
 *
 * ## 问题
 *
 * 视图想贡献一个工具栏按钮、一条右键菜单项、一段状态栏文字时，此前的做法只能
 * 是：① 宿主在注册时把这些写死在 shell 里 —— 那么视图的动态性全没了；
 * ② 视图直接 import 菜单/工具栏组件 —— 那么内核就被绑到了具体 UI 组件上。
 *
 * ## 判据
 *
 * **视图输出数据，不输出 DOM；内核消费数据，不 import 组件。**
 *
 * 微件条目一律绑定 `commandId`，**禁止 inline 回调**。理由不是洁癖：
 * 回调会让「同一条命令在菜单、快捷键、工具栏三处行为不同」成为可能，而 main-ui
 * 的第一条设计不变量就是「所有可执行入口最终归一到 command」。
 *
 * ## 什么不该进微件
 *
 * 微件是**展示**，不是**能力**。若某个东西需要自己的注册表、自己的生命周期、
 * 自己的调度 —— 它是贡献点（contribution），不是微件。二者混用会让微件体系
 * 长成第二个插件系统。
 */

/** 微件位置。 */
export type AuxiliarySlot =
  /** 该视图自己的局部工具栏 */
  | 'toolbar'
  /** 该视图的右键上下文菜单 */
  | 'context-menu'
  /** 全局状态栏中属于该视图的片段 */
  | 'status';

/**
 * 一个微件条目。
 *
 * 全部字段都是**纯数据**：可 JSON 序列化、可比较、可单测。
 * `commandId` 是唯一的行为入口 —— 微件没有任何执行逻辑。
 */
export type AuxiliaryItem = {
  /** 稳定 id（同一视图内唯一；用于显隐与去重） */
  id: string;
  /** 绑定的命令 id（唯一行为入口） */
  commandId: string;
  /** 显示文案（省略则由命令标题兜底） */
  label?: string;
  /** 图标 token */
  icon?: string;
  /** 是否可用（由视图依据自身状态计算，非命令的 enablement） */
  enabled?: boolean;
  /** 复选态（`toggle` 类条目用） */
  checked?: boolean;
  /** 危险操作（删除等）—— 供渲染层加警示样式 */
  danger?: boolean;
  /** 分组序号：同组相邻渲染，不同组之间画分隔线 */
  group?: number;
  /** 排序权重（同组内由小到大） */
  order?: number;
  /** 提示文本 */
  tooltip?: string;
};

/**
 * 视图向外输出的微件模型。
 *
 * 视图通过生命周期钩子 `getAuxiliaryItems()` 返回它；返回 `null`/`undefined`
 * 表示「本视图不贡献微件」，与返回空数组等价。
 */
export type ViewAuxiliaryModel = Partial<Record<AuxiliarySlot, AuxiliaryItem[]>>;

/**
 * 视图可选实现的附属部件契约。
 *
 * 实现方式与 `MainUiViewLifecycle` 相同：可选、不实现则零影响。
 *
 * @example
 * ```ts
 * const aux: ViewAuxiliaryContract = {
 *   getAuxiliaryItems: () => ({
 *     toolbar: [
 *       { id: 'zoom-in', commandId: 'world.zoomIn', label: '放大', group: 0 },
 *       { id: 'reset', commandId: 'world.resetView', label: '复位', group: 1 },
 *     ],
 *     status: [{ id: 'zoom', commandId: 'world.showZoom', label: `${Math.round(zoom * 100)}%` }],
 *   }),
 * };
 * ```
 */
export interface ViewAuxiliaryContract {
  /**
   * 返回当前微件模型。
   *
   * 调用时机：挂载后、以及视图自身状态变化时（视图经模型变更通知触发刷新）。
   * **不得**在此方法里做副作用或异步取数 —— 它会被频繁调用。
   */
  getAuxiliaryItems(): ViewAuxiliaryModel | null | undefined;
}

/** 微件模型变更事件载荷。 */
export type AuxiliaryModelChange = {
  /** 发出变更的视图实例 */
  viewInstanceId: string;
  /** 新的完整模型（增量合并由消费方决定） */
  model: ViewAuxiliaryModel;
};

/**
 * 规范化微件模型（纯函数，可单测）：丢弃无效条目、按 group/order 排序、去重。
 *
 * 为什么要规范化而不是原样透传：微件由视图产出，而视图是**各宿主**实现的 ——
 * 不能指望每个视图都记得排序与去重。把它做成内核的纯函数，渲染层就总能拿到
 * 一致形态的输入。
 *
 * 无效条目的判据：缺 `id`、缺 `commandId`、或 `id` 重复（后者保留首次出现）。
 *
 * @param model 视图产出的原始模型。
 * @returns 规范化后的模型（仅含出现过的位置）。
 * @example
 * ```ts
 * normalizeAuxiliaryModel({
 *   toolbar: [
 *     { id: 'b', commandId: 'x', order: 2 },
 *     { id: 'a', commandId: 'y', order: 1 },
 *   ],
 * }).toolbar?.map((i) => i.id); // ['a', 'b']
 * ```
 */
export const normalizeAuxiliaryModel = (
  model: ViewAuxiliaryModel | null | undefined,
): ViewAuxiliaryModel => {
  if (!model) return {};
  const result: ViewAuxiliaryModel = {};
  for (const slot of ['toolbar', 'context-menu', 'status'] as const) {
    const items = model[slot];
    if (!items || items.length === 0) continue;
    const seen = new Set<string>();
    const valid = items.filter((item) => {
      if (!item?.id || !item.commandId) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    if (valid.length === 0) continue;
    result[slot] = [...valid].sort((a, b) => {
      const groupDelta = (a.group ?? 0) - (b.group ?? 0);
      if (groupDelta !== 0) return groupDelta;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }
  return result;
};

/**
 * 合并多个视图的微件模型（纯函数）。
 *
 * 用于「全局菜单栏 / 状态栏」这类需要同时展示多个视图微件的容器：
 * 以视图出现顺序拼接，同 `id` 冲突时后者加视图前缀后缀，避免互相覆盖。
 *
 * @param entries 视图实例 id → 原始模型。
 * @returns 合并后的模型。
 */
export const mergeAuxiliaryModels = (
  entries: ReadonlyArray<{ viewInstanceId: string; model: ViewAuxiliaryModel | null | undefined }>,
): ViewAuxiliaryModel => {
  const merged: ViewAuxiliaryModel = {};
  const usedIds = new Set<string>();
  for (const entry of entries) {
    const normalized = normalizeAuxiliaryModel(entry.model);
    for (const slot of ['toolbar', 'context-menu', 'status'] as const) {
      const items = normalized[slot];
      if (!items) continue;
      const bucket = merged[slot] ?? [];
      for (const item of items) {
        const id = usedIds.has(item.id) ? `${entry.viewInstanceId}:${item.id}` : item.id;
        usedIds.add(id);
        bucket.push({ ...item, id });
      }
      merged[slot] = bucket;
    }
  }
  return merged;
};
