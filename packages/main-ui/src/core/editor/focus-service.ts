import type { EditorInstanceId, GroupId, TabId, WorkspaceId } from '../types';
import type { WorkbenchDocument } from '../workspace/types';

/**
 * 焦点事实源（FocusService 语义）。
 *
 * ## 为什么需要它
 *
 * 焦点此前是**散落的事实**：布局组自己记 `activeTabId`、runtime 另有
 * `focusScope` 字符串、keybinding 的 `when` 上下文又各读一处。三者可以互相矛盾，
 * 且没有任何单一出口能回答「此刻用户正盯着哪个视图」。
 *
 * 缺了这一层，跨层联动只能各自打补丁：全局菜单栏要合并激活视图的菜单、树与检视器
 * 要互相通知、keybinding 的 `when` 要判断输入作用域 —— 每一处都在猜同一个事实。
 *
 * ## 职责边界（红线）
 *
 * - **只上报焦点，不调度业务**。Docking 不知道「激活的是树还是检视器」的业务含义，
 *   它只知道「哪个 viewInstance 现在有焦点」。
 * - **不依赖任何渲染层**：无 Vue、无 DOM、无事件循环假设。纯数据 + 回调集合。
 * - **单向数据流**：焦点由布局状态推导（`syncFrom(document)`），反向订阅者只读。
 */

/** 焦点变更原因：区分「用户点的」与「程序设的」，供订阅者决定是否响应。 */
export type FocusChangeReason =
  /** 用户交互（点击页签、点击视图内容） */
  | 'click'
  /** 程序化设置（命令、恢复快照、打开新视图） */
  | 'programmatic'
  /** 当前视图被关闭，焦点自动转移 */
  | 'close'
  /** 从持久化快照恢复 */
  | 'restore'
  /** 焦点离开工作台（如焦点进入宿主自有面板） */
  | 'leave';

/** 焦点事实：唯一权威的「当前激活视图」描述。 */
export type FocusSnapshot = {
  /** 当前有焦点的编辑实例 id；无任何激活视图时为 null */
  viewInstanceId: EditorInstanceId | null;
  /** 该实例所属的插槽/视图类型（= editor kind / rendererKey 命名空间） */
  viewType: string | null;
  /** 承载它的布局组 id */
  groupId: GroupId | null;
  /** 承载它的页签 id */
  tabId: TabId | null;
  workspaceId: WorkspaceId | null;
  /** 变更原因（变更事件里才有意义） */
  reason: FocusChangeReason;
};

/** 焦点变更监听器：收到新快照与前一份快照。 */
export type FocusListener = (next: FocusSnapshot, previous: FocusSnapshot) => void;

const EMPTY_FOCUS: FocusSnapshot = {
  viewInstanceId: null,
  viewType: null,
  groupId: null,
  tabId: null,
  workspaceId: null,
  reason: 'restore',
};

/**
 * 从布局文档推导焦点事实（纯函数，无副作用）。
 *
 * 推导规则：取活动 workspace 的 `layout.activeGroupId` → 该组的 `activeTabId`
 * → 该页签的 `editorInstanceId`。任一环缺失即视为「无焦点」，不抛出。
 *
 * 为什么从布局推导而非自己记账：**布局是唯一真源**。若焦点服务自持一份状态，
 * 就会立刻出现「布局关了页签但焦点还指着它」这类两份真相。
 *
 * @param document 工作台文档。
 * @returns 焦点事实（reason 固定为 'restore'，由调用方在派发时覆盖）。
 * @example
 * ```ts
 * const focus = deriveFocus(document);
 * focus.viewInstanceId; // 'editor-7' 或 null
 * ```
 */
export const deriveFocus = (document: WorkbenchDocument | null): FocusSnapshot => {
  if (!document) return EMPTY_FOCUS;
  const workspaceId = document.activeWorkspaceId;
  const workspace = document.workspaceStates[workspaceId];
  if (!workspace) return { ...EMPTY_FOCUS, workspaceId };

  const groupId = workspace.layout.activeGroupId;
  if (!groupId) return { ...EMPTY_FOCUS, workspaceId };
  // 活动组可能位于浮动窗口的布局子树内
  const group = workspace.layout.groups[groupId]
    ?? Object.values(workspace.floatingWindows ?? {})
      .map((window) => window.layout.groups[groupId])
      .find(Boolean);
  if (!group) return { ...EMPTY_FOCUS, workspaceId };

  const activeTabId = group.activeTabId ?? group.lastActiveTabId ?? null;
  const tab = activeTabId ? workspace.tabs[activeTabId] : undefined;
  if (!tab) {
    return { ...EMPTY_FOCUS, groupId, workspaceId };
  }

  const editor = workspace.editors[tab.editorInstanceId];
  return {
    viewInstanceId: tab.editorInstanceId,
    viewType: editor?.kind ?? null,
    groupId,
    tabId: tab.id,
    workspaceId,
    reason: 'restore',
  };
};

/**
 * 焦点服务：持有当前焦点事实，向外广播变更。
 *
 * 使用方式只有三步：
 * 1. 布局变化后调 `syncFrom(document, reason)` —— 由 runtime 统一驱动；
 * 2. 订阅 `subscribe(listener)` 消费焦点；
 * 3. 需要「当前焦点」时读 `current()`（同步、无副作用）。
 *
 * @example
 * ```ts
 * const focus = new FocusService();
 * const off = focus.subscribe((next) => console.log(next.viewType));
 * focus.syncFrom(document, 'click');
 * off(); // 取消订阅
 * ```
 */
export class FocusService {
  private snapshot: FocusSnapshot = EMPTY_FOCUS;
  private readonly listeners = new Set<FocusListener>();

  /** 当前焦点事实（引用稳定，未变更时返回同一对象）。 */
  current(): FocusSnapshot {
    return this.snapshot;
  }

  /**
   * 从布局文档同步焦点；仅在事实真正变化时广播。
   *
   * 「真正变化」的判据只比 `viewInstanceId` / `groupId` / `tabId` 三项 ——
   * 不比 `reason`。否则同一次点击会因 reason 不同而重复广播，订阅者被无意义地唤醒。
   *
   * @param document 工作台文档（可为 null，表示尚未 boot）。
   * @param reason 变更原因；由调用方依据触发动作判定。
   * @returns 是否发生了变更。
   */
  syncFrom(document: WorkbenchDocument | null, reason: FocusChangeReason): boolean {
    const derived = deriveFocus(document);
    const previous = this.snapshot;
    const unchanged = previous.viewInstanceId === derived.viewInstanceId
      && previous.groupId === derived.groupId
      && previous.tabId === derived.tabId
      && previous.workspaceId === derived.workspaceId;
    if (unchanged) {
      // 仍更新 reason 之外的引用不变，保证 current() 稳定
      return false;
    }
    this.snapshot = { ...derived, reason };
    for (const listener of this.listeners) {
      listener(this.snapshot, previous);
    }
    return true;
  }

  /**
   * 显式声明焦点离开工作台（如焦点进入宿主自有面板）。
   *
   * 不清空布局上的 `activeTabId` —— 那是布局的真源，本就该保留；
   * 这里只意味着「键盘焦点不在工作台内」，供 keybinding 的 when 上下文消费。
   */
  leave(): boolean {
    if (this.snapshot.reason === 'leave' && this.snapshot.viewInstanceId === null) {
      return false;
    }
    const previous = this.snapshot;
    this.snapshot = { ...EMPTY_FOCUS, workspaceId: previous.workspaceId, reason: 'leave' };
    for (const listener of this.listeners) {
      listener(this.snapshot, previous);
    }
    return true;
  }

  /**
   * 订阅焦点变更。
   *
   * 注意：**订阅时不立即回调**。这与 runtime 的 `subscribe`（立即回调当前快照）
   * 刻意不同 —— 焦点订阅者通常在挂载时才需要「变更通知」，首帧焦点由布局渲染
   * 自行处理；立即回调会造成「挂载即触发一次假变更」。
   *
   * @param listener 监听器。
   * @returns 取消订阅函数。
   */
  subscribe(listener: FocusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 清空（运行时重置场景）。 */
  reset(): void {
    this.snapshot = EMPTY_FOCUS;
  }
}
