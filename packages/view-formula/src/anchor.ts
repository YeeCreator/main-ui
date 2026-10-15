/**
 * 变量级 DOM 锚点装配。
 *
 * KaTeX `output:'html'` 把每个变量/运算符渲染成若干 `span`（变量多为 `.mord.mathnormal`）。
 * 本模块按**文档顺序**遍历这些候选节点，与 `scanner.ts` 扫出的 token 顺序一一对齐，
 * 给命中的节点打上 `data-mui-formula-anchor` 标记，供宿主绑定事件。
 *
 * 顺序对齐的依据：KaTeX 的 HTML 是**从源顺序线性展开**的，故「第 n 个字母变量候选」
 * 即「第 n 个变量 token」——这是无需改动 KaTeX 的唯一可行路径。
 */

import { scanVariableTokens, matchAnchor } from './scanner'
import type { FormulaVarAnchor } from './types'

/** 变量候选节点选择器（KaTeX 字母变量的常见类名）。 */
const VARIABLE_SELECTOR = '.mord.mathnormal, .mord.mathit, .mathnormal'

/** 锚点节点上写入的属性名（宿主事件委托用）。 */
export const ANCHOR_ATTR = 'data-mui-formula-anchor'

/** 锚点节点上写入的变量名属性。 */
export const ANCHOR_NAME_ATTR = 'data-mui-formula-name'

/** 锚点节点上写入的出现序号属性。 */
export const ANCHOR_OCCURRENCE_ATTR = 'data-mui-formula-occurrence'

/**
 * 在已渲染的 KaTeX 根节点内装配变量锚点。
 *
 * @param root KaTeX 渲染产物的根元素（含 `.katex-html`）。
 * @param latex 原始 LaTeX 源（与 root 对应）。
 * @param anchors 宿主要锚定的变量声明。
 * @returns 成功装配的锚点数量。
 *
 * @example
 * const n = attachVariableAnchors(katexRoot, 'A_{ij}=x', [{ name: 'A', symbolId: 'sym:A' }])
 */
export function attachVariableAnchors(root: HTMLElement, latex: string, anchors: FormulaVarAnchor[]): number {
  if (!anchors.length) return 0
  const tokens = scanVariableTokens(latex)
  if (!tokens.length) return 0

  const candidates = Array.from(root.querySelectorAll<HTMLElement>(VARIABLE_SELECTOR))
    // KaTeX 会把多字母下标（如 `ij`）合并进单个节点，故只取**单字母**候选参与对齐。
    .filter((node) => /^[A-Za-z]$/.test((node.textContent ?? '').trim()))

  let attached = 0
  let tokenCursor = 0

  for (const node of candidates) {
    const letter = (node.textContent ?? '').trim()
    // 按**字母名**在 token 序列中贪心前向对齐（而非纯位置对齐）——
    // 因为 DOM 候选数 ≠ token 数（多字母下标被合并、命令不渲染为候选）。
    let found = -1
    for (let scan = tokenCursor; scan < tokens.length; scan += 1) {
      if (tokens[scan].name === letter) {
        found = scan
        break
      }
    }
    if (found < 0) continue
    tokenCursor = found + 1

    const hit = matchAnchor(tokens, found, anchors)
    if (!hit) continue
    const token = tokens[found]
    node.setAttribute(ANCHOR_ATTR, hit.symbolId)
    node.setAttribute(ANCHOR_NAME_ATTR, hit.name)
    node.setAttribute(ANCHOR_OCCURRENCE_ATTR, String(token.occurrence))
    node.setAttribute('role', 'button')
    node.setAttribute('tabindex', '0')
    node.style.cursor = 'pointer'
    attached += 1
  }

  return attached
}

/**
 * 从事件目标向上寻找最近的锚点节点。
 *
 * @param target 事件目标节点。
 * @returns 锚点节点与其承载的信息；未命中返回 null。
 */
export function resolveAnchorFromEvent(target: EventTarget | null): { element: HTMLElement; symbolId: string; name: string; occurrence: number } | null {
  if (!(target instanceof HTMLElement)) return null
  const element = target.closest<HTMLElement>(`[${ANCHOR_ATTR}]`)
  if (!element) return null
  return {
    element,
    symbolId: element.getAttribute(ANCHOR_ATTR) ?? '',
    name: element.getAttribute(ANCHOR_NAME_ATTR) ?? '',
    occurrence: Number(element.getAttribute(ANCHOR_OCCURRENCE_ATTR) ?? '0'),
  }
}
