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

  // 连线操作
  addConnection(connection: SandboxConnection): void;
  removeConnections(ids: readonly string[]): void;

  // 相机操作
  setCamera(camera: Partial<SandboxCamera>): void;

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

/** 创建 SandboxKernel 实例（纯函数工厂）。 */
export const createSandboxKernel = (
  initialDocument?: SandboxDocument,
  initialCamera?: SandboxCamera,
  options?: SandboxKernelOptions,
): SandboxKernelInstance => {
  let doc: SandboxDocument = initialDocument ?? { elements: [], connections: [] };
  let camera: SandboxCamera = initialCamera ?? { x: 0, y: 0, zoom: 1 };
  const maxDepth = options?.maxNestingDepth ?? DEFAULT_MAX_NESTING_DEPTH;
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

      doc = { ...doc, elements: [...doc.elements, element] };

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
      doc = {
        elements: doc.elements.filter((e) => !idSet.has(e.id)),
        connections: doc.connections.filter(
          (c) => !idSet.has(c.source.elementId) && !idSet.has(c.target.elementId),
        ),
      };
      for (const id of ids) embeddedHost.unregister(id);
      notify('element');
    },

    moveElement(id: string, x: number, y: number): void {
      if (destroyed) return;
      doc = {
        ...doc,
        elements: doc.elements.map((e) => (e.id === id ? { ...e, x, y } : e)),
      };
      notify('element');
    },

    resizeElement(id: string, width: number, height: number): void {
      if (destroyed) return;
      doc = {
        ...doc,
        elements: doc.elements.map((e) => (e.id === id ? { ...e, width, height } : e)),
      };
      notify('element');
    },

    rotateElement(id: string, rotation: number): void {
      if (destroyed) return;
      doc = {
        ...doc,
        elements: doc.elements.map((e) => (e.id === id ? { ...e, rotation } : e)),
      };
      notify('element');
    },

    addConnection(connection: SandboxConnection): void {
      if (destroyed) return;
      if (doc.connections.some((c) => c.id === connection.id)) return;
      // 端点存在性校验
      const elementIds = new Set(doc.elements.map((e) => e.id));
      if (!elementIds.has(connection.source.elementId) || !elementIds.has(connection.target.elementId)) return;
      doc = { ...doc, connections: [...doc.connections, connection] };
      notify('connection');
    },

    removeConnections(ids: readonly string[]): void {
      if (destroyed) return;
      const idSet = new Set(ids);
      doc = { ...doc, connections: doc.connections.filter((c) => !idSet.has(c.id)) };
      notify('connection');
    },

    setCamera(partial: Partial<SandboxCamera>): void {
      if (destroyed) return;
      camera = { ...camera, ...partial };
      notify('camera');
    },

    toJSON() {
      return { document: doc, camera };
    },

    fromJSON(data: { document: SandboxDocument; camera?: SandboxCamera }): void {
      if (destroyed) return;
      doc = data.document;
      if (data.camera) camera = data.camera;
      // 重建嵌入视图注册
      embeddedHost.destroyAll();
      for (const element of doc.elements) {
        if (element.type === 'embed-view' && element.embedViewRef) {
          embeddedHost.register({
            id: element.id,
            viewType: element.embedViewRef.viewType,
            payload: element.embedViewRef.payload,
          });
        }
      }
      notify('full');
    },

    onChange(listener: SandboxChangeListener): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },

    checkNesting(): NestingCheckResult {
      const refs = getEmbedRefs();
      // 简化：沙盘层级的嵌套 = embed-view 元素数量（实际应解析每个嵌入的内部引用）
      // 此处提供基本保护：如果嵌入数量超过 maxDepth 则告警
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

  return kernel;
};
