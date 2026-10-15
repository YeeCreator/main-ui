/**
 * @main-ui/view-formula 数据契约：宿主注入 LaTeX 与「变量 token → 符号 id」映射，
 * 视图只负责渲染与抛出锚点交互意图（hover / click），绝不发起网络请求。
 *
 * 契约4（符号寻址）对齐：符号解析与规范化由宿主（后端）完成，本包只消费映射结果。
 */

/** 公式内一个可锚定变量的声明。 */
export type FormulaVarAnchor = {
  /** 变量显示名（如 `A`、`x`），用于在扫描出的 token 序列中定位。 */
  name: string
  /** 契约4 符号 id；同一变量在不同公式中指向同一符号条目。 */
  symbolId: string
  /** 可选出现序号（从 0 计）；省略时该 name 的**全部**出现均可锚定。 */
  occurrence?: number
  /** 可选提示文本（宿主可放概念简述，供悬停卡片使用）。 */
  hint?: string
}

/** 锚点交互意图载荷。 */
export type FormulaAnchorIntent = {
  name: string
  symbolId: string
  /** 该变量在本次渲染的 token 序列中的全局序号。 */
  occurrence: number
  /** 触发时的 client 坐标（宿主据此定位弹窗）。 */
  clientX: number
  clientY: number
}

/** 公式视图状态契约。 */
export type FormulaViewState = {
  /** 已展开的符号 id 集合（宿主可用于恢复高亮）。 */
  expandedSymbolIds: string[]
}
