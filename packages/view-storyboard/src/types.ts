/**
 * @main-ui/view-storyboard 数据契约：宿主适配层负责把分镜卡片经 Props 注入，
 * 视图只呈现卡片列表与抛出增删改意图（Emits），绝不发起任何请求，也不绑定任何领域语义。
 *
 * 独立性约束：全部术语为通用分镜语义（card/tick/note/image），不含游戏或棋类专属概念。
 * 截图（image）由宿主在 add-card 意图回调中生成并回填（如视口导出 PNG），视图不自行截图。
 */

/** 单张分镜卡片。 */
export interface StoryboardCard {
  /** 卡片稳定标识（宿主生成，如 UUID）。 */
  id: string;
  /** 卡片对应的步/帧计数。 */
  tick: number;
  /** 卡片注释文本。 */
  note: string;
  /** 可选截图（如 base64 PNG data URL，由宿主生成）。 */
  image?: string;
}

/**
 * 分镜操作契约（宿主侧处理句柄的形态）。
 * 视图通过 Emits 抛出对应意图；addCard 由宿主据 StoryboardCardDraft 补全 tick/image 后构造完整卡片。
 */
export interface StoryboardEvents {
  addCard: (card: StoryboardCard) => void;
  removeCard: (id: string) => void;
  updateNote: (id: string, note: string) => void;
}

/** 视图抛出的新增意图载荷（仅含用户输入的注释；tick/image 由宿主补全）。 */
export type StoryboardCardDraft = {
  note: string;
};

/** serializeStoryboard 的封装元信息选项。 */
export interface StoryboardSerializeOptions {
  format?: string;
  version?: number;
}

/** 视图状态契约（MainUiViewLifecycle.getViewState 的产出形态；仅含本地呈现态）。 */
export type StoryboardViewState = {
  /** 新增卡片注释输入框的草稿文本。 */
  draftNote: string;
};
