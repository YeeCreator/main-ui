import type { EditorInstanceId, GroupId, TabId } from '../types';
import type { WorkbenchDocument } from '../workspace/types';

/**
 * Slot ↔ View 实例绑定查询。
 *
 * ## 为什么内核要提供它
 *
 * 「这个插槽当前挂着哪个实例」是**布局的真源能直接回答的问题**，但此前只能由宿主
 * 自己遍历 layout/tabs/editors 三张表拼出来。宿主于是各自记账，出现两个后果：
 *
 * 1. **两份真相**：宿主记的账落后于布局（页签已经拖走、实例已经换了），校验就失效；
 * 2. **实例独占校验无从下手**：宿主想让「某类视图在整窗只能有一个」时，
 *    只能靠打开前的猜测，而不是打开后的查证。
 *
 * 本模块把这张查表变成内核的公开能力 —— 单向从布局推导，不新增状态。
 */

/** 一处视图实例的挂载位置。 */
export type SlotBinding = {
  /** 视图实例 id（同一实例可能有多个表面 → 多条绑定）。 */
  viewInstanceId: EditorInstanceId;
  /** 视图类型（= editor kind）。 */
  viewType: string;
  /** 承载它的布局组。 */
  groupId: GroupId;
  /** 承载它的页签。 */
  tabId: TabId;
  /** 所属 workspace。 */
  workspaceId: string;
  /** 是否位于浮动窗口的布局子树内。 */
  floating: boolean;
};

/**
 * 列出当前文档中全部视图实例绑定（纯函数，不修改入参）。
 *
 * 顺序：先主布局树，再浮动窗口；同一组内按 `tabIds` 顺序。调用方可自行再排序。
 *
 * @param document 工作台文档（null 时返回空数组）。
 * @param workspaceId 限定 workspace；省略则遍历全部。
 * @returns 绑定列表。
 * @example
 * ```ts
 * listSlotBindings(document).filter((b) => b.viewType === 'view-world');
 * // 有多少个世界视口实例正打开着
 * ```
 */
export const listSlotBindings = (
  document: WorkbenchDocument | null,
  workspaceId?: string,
): SlotBinding[] => {
  if (!document) return [];
  const bindings: SlotBinding[] = [];
  const targets = workspaceId
    ? [[workspaceId, document.workspaceStates[workspaceId]] as const]
    : Object.entries(document.workspaceStates);

  for (const [id, workspace] of targets) {
    if (!workspace) continue;
    const collectFrom = (
      groups: Record<GroupId, { tabIds: TabId[] }>,
      floating: boolean,
    ): void => {
      for (const [groupId, group] of Object.entries(groups)) {
        for (const tabId of group.tabIds) {
          const tab = workspace.tabs[tabId];
          if (!tab) continue;
          const editor = workspace.editors[tab.editorInstanceId];
          bindings.push({
            viewInstanceId: tab.editorInstanceId,
            viewType: editor?.kind ?? '',
            groupId,
            tabId,
            workspaceId: id,
            floating,
          });
        }
      }
    };
    collectFrom(workspace.layout.groups, false);
    for (const window of Object.values(workspace.floatingWindows ?? {})) {
      collectFrom(window.layout.groups, true);
    }
  }
  return bindings;
};

/**
 * 查询某个视图实例的全部绑定（同一实例可能被多个表面上显示）。
 *
 * @param document 工作台文档。
 * @param viewInstanceId 视图实例 id。
 * @returns 绑定列表；未打开时为空数组。
 */
export const findBindingsByInstance = (
  document: WorkbenchDocument | null,
  viewInstanceId: EditorInstanceId,
): SlotBinding[] => listSlotBindings(document).filter((b) => b.viewInstanceId === viewInstanceId);

/**
 * 查询某个插槽/视图类型当前挂着的实例（宿主做实例独占校验用）。
 *
 * @param document 工作台文档。
 * @param viewType 视图类型（editor kind）。
 * @returns 绑定列表；可据此判断「是否已有一个」。
 * @example
 * ```ts
 * const existing = findBindingsByViewType(document, 'view-world');
 * if (existing.length > 0) commandFocusExisting(existing[0].viewInstanceId);
 * ```
 */
export const findBindingsByViewType = (
  document: WorkbenchDocument | null,
  viewType: string,
): SlotBinding[] => listSlotBindings(document).filter((b) => b.viewType === viewType);

/**
 * 实例独占校验：某视图类型是否已打开、且是否超过允许数量。
 *
 * 这是宿主最常用的那条判据，直接提供以免各仓重复实现（重复实现必然口径不一）。
 *
 * @param document 工作台文档。
 * @param viewType 视图类型。
 * @param limit 允许的同时打开数量（默认 1）。
 * @returns `ok` 表示可再开；`duplicated` 表示已达上限并给出已有绑定。
 */
export const checkInstanceQuota = (
  document: WorkbenchDocument | null,
  viewType: string,
  limit = 1,
): { status: 'ok' } | { status: 'duplicated'; existing: SlotBinding[] } => {
  const existing = findBindingsByViewType(document, viewType);
  return existing.length >= limit ? { status: 'duplicated', existing } : { status: 'ok' };
};
