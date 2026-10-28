/**
 * @main-ui/view-sandbox 数据契约：自由沙盘画布（旗舰复合模板）。
 *
 * 2D 视口 + 异构元素（shape / image / embed-view）+ 连线 + 可控嵌套。
 * 嵌入一律经 @main-ui/core 的 EmbeddedViewHost，禁手写子实例生命周期。
 * 约束：零网络语义字段；嵌套只走数据引用，绝不渗透布局树。
 */
import type { Camera2D } from '@main-ui/core/rendering';

export type { Camera2D };

// ============================================================
// 元素模型
// ============================================================

/** 沙盘元素类型。 */
export type SandboxElementType = 'shape' | 'image' | 'embed-view';

/** 沙盘元素（异构联合体）。 */
export type SandboxElement = {
  id: string;
  type: SandboxElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** shape 类型载荷（矩形/圆/文本等） */
  shape?: { kind: 'rect' | 'ellipse' | 'text'; label?: string; fill?: string };
  /** image 类型载荷（数据字段，宿主 provider 注入） */
  image?: { src: string; alt?: string };
  /** embed-view 类型载荷：引用已注册的 viewType + payload */
  embedViewRef?: { viewType: string; payload?: Record<string, unknown> };
  /** 宿主业务载荷（透传） */
  data?: Record<string, unknown>;
};

// ============================================================
// 连线模型
// ============================================================

/** 沙盘连线端点。 */
export type SandboxConnectionEndpoint = {
  elementId: string;
  /** 可选端口标识（元素内多锚点时使用） */
  anchor?: string;
};

/** 沙盘连线。 */
export type SandboxConnection = {
  id: string;
  source: SandboxConnectionEndpoint;
  target: SandboxConnectionEndpoint;
  label?: string;
  /** 连线样式（宿主自定义） */
  style?: { stroke?: string; dash?: boolean };
};

// ============================================================
// 相机
// ============================================================

/**
 * 沙盘相机状态。
 *
 * **就是 `Camera2D`**，不另立形状 —— 设计要求「相机内部只有一种可计算表示」
 * （design-main-ui §二十 5）。历史上此处曾是 `{ x, y, zoom }`，与 `Camera2D`
 * 的 `{ scale, pan }` 只是命名不同，却使两套桥接函数必须同时存在。
 */
export type SandboxCamera = Camera2D;

/** 沙盘文档模型（进持久化）。 */
export type SandboxDocument = {
  elements: SandboxElement[];
  connections: SandboxConnection[];
};

/** 沙盘视图状态契约（进 getViewState，非文档）。 */
export type SandboxViewState = {
  camera: SandboxCamera;
  selectedElementIds: string[];
  /** 嵌入子 View 引用快照（仅存 refId，不深拷贝子 View 数据） */
  embeddedRefs: string[];
};

// ============================================================
// 意图载荷
// ============================================================

export type SandboxMoveElementIntent = { elementId: string; x: number; y: number };
export type SandboxResizeElementIntent = { elementId: string; width: number; height: number };
export type SandboxRotateElementIntent = { elementId: string; rotation: number };
export type SandboxAddElementIntent = { element: SandboxElement };
export type SandboxRemoveElementIntent = { elementIds: string[] };
export type SandboxConnectIntent = { source: SandboxConnectionEndpoint; target: SandboxConnectionEndpoint };
export type SandboxSelectionIntent = { elementIds: string[] };

// ============================================================
// 默认值
// ============================================================

export const DEFAULT_SANDBOX_CAMERA: SandboxCamera = { scale: 1, pan: { x: 0, y: 0 } };

export const createEmptySandboxDocument = (): SandboxDocument => ({
  elements: [],
  connections: [],
});
