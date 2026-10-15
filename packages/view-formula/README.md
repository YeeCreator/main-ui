# @main-ui/view-formula

main-ui 官方视图模板：**数学公式视图**。

- `FormulaView` —— KaTeX 渲染的公式视图（`output: 'html'`），支持变量级锚点；
- `scanVariableTokens` —— LaTeX 变量扫描器（纯函数，KaTeX 不保留 token→DOM 映射，故需自扫）；
- `attachVariableAnchors` / `resolveAnchorFromEvent` —— 按 DOM 顺序对齐 token，打锚点标记。

## 契约

- 变量锚点的 id 对齐**契约4（符号寻址）**：符号解析与规范化在宿主/后端，本包只消费映射结果；
- 数据经 Props 注入（`latex` + `anchors`），交互经 Emits 抛出（`anchor-hover` / `anchor-click`）；
- **零网络**：本包不发起任何请求；颜色消费 `--mui-*` 变量。

## 用法

```ts
import { FormulaView, type FormulaVarAnchor } from '@main-ui/view-formula'

const anchors: FormulaVarAnchor[] = [{ name: 'A', symbolId: 'sym:A', hint: '邻接矩阵' }]
// <FormulaView :latex="'A_{ij}=x^2'" :anchors="anchors" @anchor-click="onAnchorClick" />
```
