/**
 * @main-ui/view-formula —— 数学公式视图模板。
 *
 * 提供：KaTeX 渲染的公式视图（`FormulaView`）+ 变量级锚点装配
 * （`scanVariableTokens` / `attachVariableAnchors`）。锚点 id 对齐契约4（符号寻址）。
 */
export * from './types'
export * from './scanner'
export * from './anchor'
export * from './FormulaView'
