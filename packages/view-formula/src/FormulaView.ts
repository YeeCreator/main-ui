import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import katex from 'katex'
import { attachVariableAnchors, resolveAnchorFromEvent } from './anchor'
import type { FormulaAnchorIntent, FormulaVarAnchor } from './types'

/**
 * FormulaView —— 数学公式视图（KaTeX 渲染 + 变量级锚点）。
 *
 * 数据经 Props 注入（LaTeX + 变量锚点声明）；交互经 Emits 抛出；
 * 颜色一律消费 `--mui-*` 变量；不发网络请求、不做符号解析（契约4：解析在宿主/后端）。
 */
export const FormulaView = defineComponent({
  name: 'FormulaView',
  props: {
    /** LaTeX 源（不含 `$$` 定界符）。 */
    latex: { type: String, required: true },
    /** 行间模式（display）；false 为行内。 */
    displayMode: { type: Boolean, default: true },
    /** 变量锚点声明（token→符号 id）。 */
    anchors: { type: Array as PropType<FormulaVarAnchor[]>, default: () => [] },
    /** 渲染失败时是否抛出（默认容错，渲染为错误色文本）。 */
    throwOnError: { type: Boolean, default: false },
  },
  emits: ['anchor-hover', 'anchor-click'],
  setup(props, { emit }) {
    const rootRef = ref<HTMLDivElement | null>(null)

    const render = () => {
      const host = rootRef.value
      if (!host) return
      let html = ''
      try {
        html = katex.renderToString(props.latex, {
          throwOnError: props.throwOnError,
          displayMode: props.displayMode,
          output: 'html',
        })
      } catch (error) {
        host.innerHTML = `<span class="mui-formula-error">${(error as Error).message}</span>`
        return
      }
      host.innerHTML = html
      const inner = host.querySelector<HTMLElement>('.katex')
      if (inner) attachVariableAnchors(inner, props.latex, props.anchors)
    }

    const emitIntent = (event: MouseEvent, type: 'anchor-hover' | 'anchor-click') => {
      const hit = resolveAnchorFromEvent(event.target)
      if (!hit) return
      const intent: FormulaAnchorIntent = {
        name: hit.name,
        symbolId: hit.symbolId,
        occurrence: hit.occurrence,
        clientX: event.clientX,
        clientY: event.clientY,
      }
      emit(type, intent)
    }

    const onClick = (event: MouseEvent) => emitIntent(event, 'anchor-click')
    const onMouseOver = (event: MouseEvent) => emitIntent(event, 'anchor-hover')

    onMounted(render)
    watch(() => [props.latex, props.displayMode, props.anchors], render, { deep: true })
    onBeforeUnmount(() => {
      const host = rootRef.value
      if (host) host.innerHTML = ''
    })

    return () =>
      h('div', {
        class: 'mui-view-formula',
        ref: rootRef,
        style: { color: 'var(--mui-color-text, inherit)' },
        onClick,
        onMouseover: onMouseOver,
      })
  },
})
