/**
 * @main-ui/view-sandbox 数据契约：自由沙盘画布（旗舰复合模板）。
 *
 * 2D 视口 + 异构元素（shape / image / embed-view）+ 连线 + 可控嵌套。
 * 嵌入一律经 @main-ui/core 的 EmbeddedViewHost，禁手写子实例生命周期。
 * 约束：零网络语义字段；嵌套只走数据引用，绝不渗透布局树。
 */
import type { Camera2D } from '@main-ui/core/rendering';
import type { RefRelation } from '@main-ui/core';

export type { Camera2D, RefRelation };

// ============================================================
// 元素模型
// ============================================================

/**
 * 沙盘元素类型。
 *
 * 分三档（design-main-ui §二十一 7）：
 *
 * | 档 | 类型 | 承载 |
 * | --- | --- | --- |
 * | 原生轻内容 | `shape` / `text` / `formula` / `link` | 模板直接渲染，**无需注册视图** |
 * | 资源 | `image` | 模板渲染，资源由宿主 provider 注入 |
 * | 嵌入视图 | `embed-view` | 引用已注册 `viewType` + payload，走 `EmbeddedViewHost` |
 *
 * **判据**：它需不需要自己的生命周期与状态？需要 ⇒ `embed-view`；不需要 ⇒ 原生类型。
 * 为「一个公式」注册一整个 viewType 属过度设计。
 */
export type SandboxElementType = 'shape' | 'image' | 'embed-view' | 'text' | 'formula' | 'link';


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
  /**
   * `text` 类型载荷：**纯文本内容**（原地可编辑，无需注册视图）。
   *
   * 与 `shape.kind === 'text'` 的区别：那是「形状里写了字」，
   * 本项是「这个元素**就是**一段文本」，有独立的编辑与排版语义。
   */
  text?: { content: string; fontSize?: number; color?: string; align?: 'left' | 'center' | 'right' };
  /**
   * `formula` 类型载荷：LaTeX 源。
   *
   * **只存源串**，渲染结果运行时生成 —— 这样任意倍率都可由浏览器重新排版，
   * 不会像位图那样放大即糊。
   */
  formula?: { latex: string; displayMode?: boolean };
  /**
   * `link` 类型载荷：指向另一份内容。
   *
   * **MUI 不持有文件路径知识**（design-main-ui §二十一 6）：`refId` 是不透明标识，
   * 由宿主 resolver 解析。点击时抛意图，**由宿主执行跳转**。
   */
  link?: { refId: string; label?: string; relation?: RefRelation };
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
