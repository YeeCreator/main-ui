/**
 * @main-ui/view-asset 数据契约：宿主适配层负责取数（含缩略图 URL / 二进制）并转成
 * 条目经 Props 注入；视图只呈现与抛出意图（Emits），**绝不发起网络请求、绝不自行取图**。
 *
 * 缩略图三态（loading / ready / error）必须由宿主声明，视图不做「加载失败自动重试」——
 * 重试策略属适配层职责，塞进视图会让每个宿主各写一套且互相不可见。
 */

/** 资产条目。 */
export type AssetItem = {
  /** 稳定标识（选择、增量更新、跨视图联动均以此为准） */
  id: string;
  /** 标题（网格下展示） */
  title: string;
  /** 可选副标题 / 描述 */
  description?: string;
  /**
   * 缩略图 URL（由宿主提供）。
   *
   * 视图**只把它塞进 `<img src>`**：不拼接、不代理、不取数。
   * 省略时呈现占位块（图标 + 标题首字），不算错误态。
   */
  thumbnailUrl?: string;
  /**
   * 缩略图状态（三态，宿主声明）。
   *
   * - `loading`：宿主正在取图 → 呈现骨架条
   * - `ready`（缺省）：正常呈现
   * - `error`：取图失败 → 呈现错误占位，**不重试**（重试由宿主决定）
   */
  thumbnailState?: 'loading' | 'ready' | 'error';
  /** 徽标（如格式、尺寸） */
  badges?: string[];
  /** 任意业务载荷：视图不解释，选择事件时原样回传给宿主 */
  payload?: Record<string, unknown>;
};

/** 呈现模式。 */
export type AssetLayout = 'grid' | 'list';

/** 选择意图载荷。 */
export type AssetSelectPayload = {
  id: string;
  /** 点击时是否按住了修饰键（宿主据此决定加选 / 连选语义） */
  additive: boolean;
  /** 条目携带的原始载荷（原样回传，视图不解释） */
  payload?: Record<string, unknown>;
};

/** 视图状态契约（MainUiViewLifecycle.getViewState 的产出形态）。 */
export type AssetViewState = {
  layout: AssetLayout;
  selectedIds: string[];
  scrollTop: number;
  /** 预览中的资产 id（省略表示未打开预览） */
  previewId: string | null;
};

/** 网格列数（响应式断点：容器宽度 → 列数）。 */
export const ASSET_GRID_BREAKPOINTS: ReadonlyArray<{ minWidth: number; columns: number }> = [
  { minWidth: 1200, columns: 6 },
  { minWidth: 960, columns: 5 },
  { minWidth: 720, columns: 4 },
  { minWidth: 480, columns: 3 },
  { minWidth: 0, columns: 2 },
];

/** 卡片固定高度（虚拟化与网格对齐都需要定高；列表模式复用同一值）。 */
export const DEFAULT_ASSET_CARD_HEIGHT = 132;
