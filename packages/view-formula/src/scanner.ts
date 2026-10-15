/**
 * LaTeX 变量扫描器（**纯函数、无 DOM 依赖**）。
 *
 * 存在理由：KaTeX 的 `output:'html'` 只产出排版好的 DOM，
 * **不保留源 token → DOM 的映射**；因此变量级锚点（悬停/点击定位符号）
 * 必须由前端自行扫描源 LaTeX，建立「第 n 个变量」的顺序表，
 * 再与渲染后的 DOM 顺序对齐（见 `anchor.ts`）。
 *
 * 扫描规则（数学 LaTeX 的收敛子集）：
 * - 反斜杠命令（`\alpha`、`\frac`…）整体跳过，**不**把命令名当变量；
 * - 单个 ASCII 字母 `[A-Za-z]` 视为一个变量 token；
 * - 数字、运算符、括号、花括号、上下标符（`_`/`^`）不计入 token，但**不影响**其后的变量顺序；
 * - `\text{...}`/`\mathrm{...}` 等文本参数内不扫描（避免把说明文字当变量）。
 */

/** 一个扫描出的变量 token（按源顺序）。 */
export type VariableToken = {
  /** 变量名（单个字母，或命令式符号的 `\name`）。 */
  name: string
  /** 该 name 在本文本中的第几次出现（从 0 计）。 */
  occurrence: number
  /** 在去除命令后的 token 序列中的全局序号。 */
  index: number
}

/** 反斜杠命令形态：`\alpha`（字母命令）或 `\{`（单字符命令）。 */
const COMMAND_PATTERN = /^\\([a-zA-Z]+|.)/

/** 内容不参与变量扫描的命令（其花括号参数视为文本）。 */
const TEXT_COMMANDS = new Set(['text', 'mathrm', 'operatorname', 'textbf', 'textit', 'mbox'])

/**
 * 扫描 LaTeX 源中的变量 token（按出现顺序）。
 *
 * @param latex LaTeX 源（不含定界符 `$$`）。
 * @returns 变量 token 表，按源顺序。
 *
 * @example
 * scanVariableTokens('A_{ij} = x^2 + \\alpha')
 * // -> A(0), i(1), j(2), x(3)  —— `\alpha` 不计入
 */
export function scanVariableTokens(latex: string): VariableToken[] {
  const tokens: VariableToken[] = []
  const seen = new Map<string, number>()
  let cursor = 0

  const push = (name: string) => {
    const occurrence = seen.get(name) ?? 0
    seen.set(name, occurrence + 1)
    tokens.push({ name, occurrence, index: tokens.length })
  }

  while (cursor < latex.length) {
    const char = latex[cursor]

    if (char === '\\') {
      const match = COMMAND_PATTERN.exec(latex.slice(cursor))
      const command = match ? match[1] : ''
      cursor += match ? match[0].length : 1
      // 文本类命令：跳过其花括号参数，避免把说明文字当变量
      if (TEXT_COMMANDS.has(command)) {
        const open = latex.indexOf('{', cursor)
        if (open >= 0) {
          let depth = 0
          let walk = open
          while (walk < latex.length) {
            if (latex[walk] === '{') depth += 1
            else if (latex[walk] === '}') {
              depth -= 1
              if (depth === 0) break
            }
            walk += 1
          }
          cursor = walk + 1
        }
      }
      continue
    }

    if (/[A-Za-z]/.test(char)) {
      push(char)
      cursor += 1
      continue
    }

    cursor += 1
  }

  return tokens
}

/** 判断某个 token 是否命中锚点声明（含 `occurrence` 限定）。 */
export function matchAnchor(tokens: VariableToken[], cursor: number, anchors: Array<{ name: string; symbolId: string; occurrence?: number }>): { symbolId: string; name: string } | null {
  const token = tokens[cursor]
  if (!token) return null
  for (const anchor of anchors) {
    if (anchor.name !== token.name) continue
    if (anchor.occurrence !== undefined && anchor.occurrence !== token.occurrence) continue
    return { symbolId: anchor.symbolId, name: anchor.name }
  }
  return null
}
