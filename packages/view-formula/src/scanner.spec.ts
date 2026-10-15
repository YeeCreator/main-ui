import { describe, expect, it } from 'vitest'
import { matchAnchor, scanVariableTokens } from './scanner'

describe('scanner · LaTeX 变量扫描', () => {
  it('把单字母视为变量（含下标字母）', () => {
    const tokens = scanVariableTokens('A_{ij} = x^2')
    expect(tokens.map((t) => t.name)).toEqual(['A', 'i', 'j', 'x'])
  })

  it('反斜杠命令不计入变量', () => {
    const tokens = scanVariableTokens('\\alpha + \\beta_{k}')
    expect(tokens.map((t) => t.name)).toEqual(['k'])
  })

  it('\\text{...} 参数内不扫描', () => {
    const tokens = scanVariableTokens('x = \\text{the total value}')
    expect(tokens.map((t) => t.name)).toEqual(['x'])
  })

  it('同名变量按出现次数编号', () => {
    const tokens = scanVariableTokens('x + x + y + x')
    expect(tokens.filter((t) => t.name === 'x').map((t) => t.occurrence)).toEqual([0, 1, 2])
    expect(tokens.map((t) => t.index)).toEqual([0, 1, 2, 3])
  })

  it('数字与运算符不产生 token 但保留顺序', () => {
    const tokens = scanVariableTokens('a_1 + b_2')
    expect(tokens.map((t) => t.name)).toEqual(['a', 'b'])
  })
})

describe('scanner · 锚点命中', () => {
  const tokens = scanVariableTokens('x + x + y')

  it('按名称 + 出现序号命中', () => {
    expect(matchAnchor(tokens, 0, [{ name: 'x', symbolId: 'sym:x' }])).toEqual({ name: 'x', symbolId: 'sym:x' })
    expect(matchAnchor(tokens, 1, [{ name: 'x', symbolId: 'sym:x' }])).toEqual({ name: 'x', symbolId: 'sym:x' })
    expect(matchAnchor(tokens, 2, [{ name: 'y', symbolId: 'sym:y' }])).toEqual({ name: 'y', symbolId: 'sym:y' })
  })

  it('限定 occurrence 时只命中指定出现', () => {
    expect(matchAnchor(tokens, 0, [{ name: 'x', symbolId: 'sym:x', occurrence: 1 }])).toBeNull()
    expect(matchAnchor(tokens, 1, [{ name: 'x', symbolId: 'sym:x', occurrence: 1 }])).toEqual({ name: 'x', symbolId: 'sym:x' })
  })

  it('未声明的变量不命中', () => {
    expect(matchAnchor(tokens, 2, [{ name: 'x', symbolId: 'sym:x' }])).toBeNull()
  })
})
