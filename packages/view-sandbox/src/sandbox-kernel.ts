/**
 * SandboxKernel —— L2 无头纯 TS 内核（零 DOM / 零 Vue，可 Node 单测）。
 *
 * 数据流范式：交互 → 调用内核方法（禁直接改 state）→ 内核抛变更事件 → 渲染层订阅刷新。
 * 嵌套保护：递归校验 embedViewRef 引用链，默认最大深度 8 层。
 */

import {
  checkNestingDepth,
  createEmbeddedViewHost,
  DEFAULT_MAX_NESTING_DEPTH,
  type EmbeddedViewHostContract,
  type NestingCheckResult,
} from '@main-ui/core';
import type {
  SandboxCamera,
  SandboxConnection,
  SandboxConnectionEndpoint,
  SandboxDocument,
  SandboxElement,
} from './types';
import { normalizeSandboxCamera } from './camera';

/** 变更事件类型。 */
export type SandboxChangeType = 'element' | 'connection' | 'camera' | 'full';

/** 变更事件载荷。 */
export type SandboxChangeEvent = {
  type: SandboxChangeType;
  document: SandboxDocument;
};

/** 变更监听器。 */
export type SandboxChangeListener = (event: SandboxChangeEvent) => void;

/** SandboxKernel 配置。 */
export type SandboxKernelOptions = {
  maxNestingDepth?: number;
};

/**
 * SandboxKernel 实例。
 *
 * 所有状态变更必须通过内核方法（禁直接修改 state），
 * 每次变更后通知全部已注册的变更监听器。
 */
export type SandboxKernelInstance = {
  /** 当前文档快照（只读）。 */
  readonly document: SandboxDocument;
  /** 当前相机状态。 */
  readonly camera: SandboxCamera;
  /** 嵌入视图托管件。 */
  readonly embeddedHost: EmbeddedViewHostContract;
  /** 嵌套深度配置。 */
  readonly maxNestingDepth: number;

  // 元素操作
  addElement(element: SandboxElement): NestingCheckResult;
  removeElements(ids: readonly string[]): void;
  moveElement(id: string, x: number, y: number): void;
  resizeElement(id: string, width: number, height: number): void;
  rotateElement(id: string, rotation: number): void;
  /**
   * 更新元素的**内容载荷**（text / formula / link / image / shape / embed-view）。
   *
   * 与位置/尺寸/旋转分开：那三项有专属方法，撤销粒度也不同
   * （拖拽一次算一步，内容编辑一次算一步）。
   */
  updateElementContent(id: string, patch: Partial<SandboxElement>): void;

  // 连线操作
  addConnection(connection: SandboxConnection): void;
  removeConnections(ids: readonly string[]): void;

  // 相机操作
  setCamera(camera: Partial<SandboxCamera>): void;

  // 撤销 / 重做
  /** 是否有可撤销的步骤。 */
  canUndo(): boolean;
  /** 是否有可重做的步骤。 */
  canRedo(): boolean;
  /** 撤销一步文档变更（相机与选中态不入历史）。 */
  undo(): void;
  /** 重做一步。 */
  redo(): void;
  /** 丢弃全部历史（加载新文档后用）。 */
  clearHistory(): void;

  // 序列化
  toJSON(): { document: SandboxDocument; camera: SandboxCamera };
  fromJSON(data: { document: SandboxDocument; camera?: SandboxCamera }): void;

  // 事件
  onChange(listener: SandboxChangeListener): () => void;

  // 嵌套校验
  checkNesting(): NestingCheckResult;

  // 销毁
  destroy(): void;
};

/** 撤销历史的最大步数（超出则丢最旧，防止长期编辑吃内存）。 */
const MAX_HISTORY = 100;

/** 创建 SandboxKernel 实例（纯函数工厂）。 */
export const createSandboxKernel = (
  initialDocument?: SandboxDocument,
  initialCamera?: SandboxCamera,
  options?: SandboxKernelOptions,
): SandboxKernelInstance => {
  let doc: SandboxDocument = initialDocument ?? { elements: [], connections: [] };
  let camera: SandboxCamera = initialCamera ?? { scale: 1, pan: { x: 0, y: 0 } };
  const maxDepth = options?.maxNestingDepth ?? DEFAULT_MAX_NESTING_DEPTH;

  /**
   * 撤销历史。
   *
   * **只存文档快照，不存相机与选中态** —— 撤销一次拖拽不应该把视口拉回原位，
   * 那是编辑器里最招人烦的行为之一。
   */
  const undoStack: SandboxDocument[] = [];
  const redoStack: SandboxDocument[] = [];

  /** 在每次**文档**变更前压栈（相机变更不入历史）。 */
  const pushHistory = (next: SandboxDocument): void => {
    undoStack.push(doc);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
    doc = next;
  };

  /**
   * 按当前文档重建嵌入视图注册。
   *
   * 四个场景共用：**构造（初始文档）**、加载文档、撤销、重做。
   * 此前该逻辑内联在 `fromJSON` 里，导致两个缺口：
   * ① 撤销/重做恢复了 embed-view 元素却不重新注册（子视图空白）；
   * ② 传初始文档构造时也从不注册（首屏就空白）。
   */
  const rebuildEmbedRegistrations = (): void => {
    // **不能用 `embeddedHost.destroyAll()`**：那是终态操作，它会把 host 标记为
    // 已销毁，之后所有 `register` 都被静默忽略 —— 表现为「子视图永远空白」。
    // 这里要的是「清空后重新登记」，必须逐个 unregister。
    for (const child of [...embeddedHost.children]) {
      embeddedHost.unregister(child.id);
    }
    for (const element of doc.elements) {
      if (element.type === 'embed-view' && element.embedViewRef) {
        embeddedHost.register({
          id: element.id,
          viewType: element.embedViewRef.viewType,
          payload: element.embedViewRef.payload,
        });
      }
    }
  };
  const listeners = new Set<SandboxChangeListener>();
  let destroyed = false;

  const embeddedHost = createEmbeddedViewHost();

  const notify = (type: SandboxChangeType) => {
    if (destroyed) return;
    const event: SandboxChangeEvent = { type, document: doc };
    for (const listener of listeners) listener(event);
  };

  const findElement = (id: string): SandboxElement | undefined =>
    doc.elements.find((e) => e.id === id);

  const getEmbedRefs = (): string[] =>
    doc.elements
      .filter((e) => e.type === 'embed-view' && e.embedViewRef)
      .map((e) => e.id);

  const kernel: SandboxKernelInstance = {
    get document() { return doc; },
    get camera() { return camera; },
    embeddedHost,
    maxNestingDepth: maxDepth,

    addElement(element: SandboxElement): NestingCheckResult {
      if (destroyed) return { status: 'ok', depth: 0 };
      if (doc.elements.some((e) => e.id === element.id)) return { status: 'ok', depth: 0 };

      // 嵌套检查（仅 embed-view 类型）
      if (element.type === 'embed-view') {
        const result = kernel.checkNesting();
        if (result.status === 'exceeded') return result;
      }

      pushHistory({ ...doc, elements: [...doc.elements, element] });

      // 注册嵌入视图
      if (element.type === 'embed-view' && element.embedViewRef) {
        embeddedHost.register({
          id: element.id,
          viewType: element.embedViewRef.viewType,
          payload: element.embedViewRef.payload,
        });
      }

      notify('element');
      return { status: 'ok', depth: 0 };
    },

    removeElements(ids: readonly string[]): void {
      if (destroyed) return;
      const idSet = new Set(ids);
      pushHistory({
        elements: doc.elements.filter((e) => !idSet.has(e.id)),
        connections: doc.connections.filter(
          (c) => !idSet.has(c.source.elementId) && !idSet.has(c.target.elementId),
        ),
      });
      for (const id of ids) embeddedHost.unregister(id);
      notify('element');
    },

    moveElement(id: string, x: number, y: number): void {
      if (destroyed) return;
      pushHistory({
        ...doc,
        elements: doc.elements.map((e) => (e.id === id ? { ...e, x, y } : e)),
      });
      notify('element');
    },

    resizeElement(id: string, width: number, height: number): void {
      if (destroyed) return;
      pushHistory({
        ...doc,
        elements: doc.elements.map((e) => (e.id === id ? { ...e, width, height } : e)),
      });
      notify('element');
    },

    rotateElement(id: string, rotation: number): void {
      if (destroyed) return;
      pushHistory({
        ...doc,
        elements: doc.elements.map((e) => (e.id === id ? { ...e, rotation } : e)),
      });
      notify('element');
    },

    updateElementContent(id: string, patch: Partial<SandboxElement>): void {
      if (destroyed) return;
      pushHistory({
        ...doc,
        // 只覆盖传入字段：位置/尺寸/旋转不由本方法改（它们有专属方法，
        // 各自承担不同的语义与撤销粒度）。
        elements: doc.elements.map((e) => (e.id === id
          ? {
            ...e,
            ...(patch.shape === undefined ? {} : { shape: patch.shape }),
            ...(patch.image === undefined ? {} : { image: patch.image }),
            ...(patch.text === undefined ? {} : { text: patch.text }),
            ...(patch.formula === undefined ? {} : { formula: patch.formula }),
            ...(patch.link === undefined ? {} : { link: patch.link }),
            ...(patch.embedViewRef === undefined ? {} : { embedViewRef: patch.embedViewRef }),
            ...(patch.data === undefined ? {} : { data: patch.data }),
          }
          : e)),
      });
      notify('element');
    },

    addConnection(connection: SandboxConnection): void {
      if (destroyed) return;
      if (doc.connections.some((c) => c.id === connection.id)) return;
      // 端点存在性校验
      const elementIds = new Set(doc.elements.map((e) => e.id));
      if (!elementIds.has(connection.source.elementId) || !elementIds.has(connection.target.elementId)) return;
      pushHistory({ ...doc, connections: [...doc.connections, connection] });
      notify('connection');
    },

    removeConnections(ids: readonly string[]): void {
      if (destroyed) return;
      const idSet = new Set(ids);
      pushHistory({ ...doc, connections: doc.connections.filter((c) => !idSet.has(c.id)) });
      notify('connection');
    },

    setCamera(partial: Partial<SandboxCamera>): void {
      if (destroyed) return;
      camera = { ...camera, ...partial };
      notify('camera');
    },

    canUndo(): boolean {
      return undoStack.length > 0;
    },

    canRedo(): boolean {
      return redoStack.length > 0;
    },

    undo(): void {
      if (destroyed) return;
      const previous = undoStack.pop();
      if (!previous) return;
      redoStack.push(doc);
      doc = previous;
      // 撤销可能删掉/恢复嵌入元素，需重算嵌入注册
      rebuildEmbedRegistrations();
      notify('full');
    },

    redo(): void {
      if (destroyed) return;
      const next = redoStack.pop();
      if (!next) return;
      undoStack.push(doc);
      doc = next;
      rebuildEmbedRegistrations();
      notify('full');
    },

    clearHistory(): void {
      undoStack.length = 0;
      redoStack.length = 0;
    },

    toJSON() {
      return { document: doc, camera };
    },

    fromJSON(data: { document: SandboxDocument; camera?: SandboxCamera }): void {
      if (destroyed) return;
      doc = data.document;
      // 相机可能是旧版 `{x,y,zoom}` 形状的存量快照，必须归一化后再用。
      if (data.camera) camera = normalizeSandboxCamera(data.camera);
      rebuildEmbedRegistrations();
      // 加载新文档后旧历史失效：拿旧快照做撤销会把文档换回上一份
      undoStack.length = 0;
      redoStack.length = 0;
      notify('full');
    },

    onChange(listener: SandboxChangeListener): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },

    checkNesting(): NestingCheckResult {
      const refs = getEmbedRefs();
      // 本层能看到的只有 embed-view 元素本身；**更深的内联链由宿主提供的
      // resolver 决定**（MUI 不懂文件系统，见 design-main-ui §二十一 6）。
      // 这里只做本层数量保护：嵌入数超过上限即告警，避免一层就撑爆。
      if (refs.length >= maxDepth) {
        return { status: 'exceeded', depth: refs.length, maxDepth };
      }
      return checkNestingDepth(refs, () => [], maxDepth);
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      embeddedHost.destroyAll();
      listeners.clear();
    },
  };

  // 初始文档里的 embed-view 也要注册，否则首屏即空白。
  rebuildEmbedRegistrations();

  return kernel;
};
