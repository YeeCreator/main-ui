import { computed, defineComponent, h, onBeforeUnmount, onMounted, PropType, ref, watch } from 'vue'
import {
  type Viewport2DCamera,
  type Viewport2DController,
  type ViewBox,
  type Vec2,
  fitCameraToViewBox,
  cameraToCssTransform,
  createViewportInteractions,
  clientToLocalCssPoint,
} from '../core/index'
import type { ViewportInteractionMode, ViewportPointerEventLike, ViewportWheelEventLike } from '../interactions'

export type Viewport2DChildrenArgs = {
  camera: Viewport2DCamera
  fitToCenter: () => void
}

export type Viewport2DProps = {
  width?: number | string
  height?: number | string
  viewBox: ViewBox
  background?: string
  paddingPx?: number
  minScaleFactor?: number
  maxScaleFactor?: number
  wheelZoomSpeed?: number
  wheelPanSpeed?: number
  style?: Record<string, string | number>
  allowDragPan?: boolean
  allowPointerPan?: boolean
  interactions?: ViewportInteractionMode
  holdToPanKey?: 'space' | 'none'
  onCamera?: (camera: Viewport2DCamera) => void
  controllerRef?: { value: Viewport2DController | null }
}

export const Viewport2D = defineComponent({
  name: 'Viewport2D',
  props: {
    width: {
      type: [Number, String],
      default: '100%',
    },
    height: {
      type: [Number, String],
      default: '100%',
    },
    viewBox: {
      type: Object as PropType<ViewBox>,
      required: true,
    },
    background: {
      type: String,
      default: '#fff',
    },
    paddingPx: {
      type: Number,
      default: 12,
    },
    minScaleFactor: {
      type: Number,
      default: 0.6,
    },
    maxScaleFactor: {
      type: Number,
      default: 10,
    },
    wheelZoomSpeed: {
      type: Number,
      default: 0.006,
    },
    wheelPanSpeed: {
      type: Number,
      default: 1.1,
    },
    style: {
      type: Object as PropType<Record<string, string | number>>,
      default: undefined,
    },
    allowDragPan: {
      type: Boolean,
      default: true,
    },
    allowPointerPan: {
      type: Boolean,
      default: true,
    },
    interactions: {
      type: Object as PropType<ViewportInteractionMode>,
      default: undefined,
    },
    holdToPanKey: {
      type: String as PropType<'space' | 'none'>,
      default: 'space',
    },
    onCamera: {
      type: Function as PropType<(camera: Viewport2DCamera) => void>,
      default: undefined,
    },
    controllerRef: {
      type: Object as PropType<{ value: Viewport2DController | null }>,
      default: undefined,
    },
  },
  setup(props, { slots }) {
    const viewportRef = ref<HTMLDivElement | null>(null)
    const camera = ref<Viewport2DCamera>({ scale: 1, pan: { x: 0, y: 0 } })
    const lastCursorLocalRef = ref<Vec2 | null>(null)
    const navModeActive = ref(props.holdToPanKey === 'none')
    const handlersRef = ref<ReturnType<typeof createViewportInteractions> | null>(null)

    const applyCamera = (nextCamera: Viewport2DCamera) => {
      camera.value = {
        scale: nextCamera.scale,
        pan: { x: nextCamera.pan.x, y: nextCamera.pan.y },
      }
      props.onCamera?.(camera.value)
      if (props.controllerRef?.value) {
        props.controllerRef.value.getCamera = () => camera.value
      }
    }

    const fitToCenter = () => {
      const el = viewportRef.value
      if (!el) {
        return
      }
      applyCamera(
        fitCameraToViewBox({
          viewBox: props.viewBox,
          containerPx: { width: Math.max(1, el.clientWidth), height: Math.max(1, el.clientHeight) },
          paddingPx: props.paddingPx,
        }),
      )
    }

    const rebuildInteractions = () => {
      const el = viewportRef.value
      if (!el) {
        handlersRef.value = null
        return
      }

      handlersRef.value = createViewportInteractions({
        getRect: () => ({
          left: el.getBoundingClientRect().left,
          top: el.getBoundingClientRect().top,
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
        }),
        toLocal: (clientX, clientY) => clientToLocalCssPoint(el, clientX, clientY),
        camera: {
          get: () => camera.value,
          set: applyCamera,
          constrain: (next) => ({
            ...next,
            scale: Math.min(props.maxScaleFactor, Math.max(props.minScaleFactor, next.scale)),
          }),
        },
        getCursorLocal: () => lastCursorLocalRef.value,
        mode: {
          ...props.interactions,
          dragPan: props.allowDragPan && navModeActive.value && (props.interactions?.dragPan ?? true),
          wheelZoomSpeed: props.wheelZoomSpeed,
          wheelPanSpeed: props.wheelPanSpeed,
        },
      })
    }

    const updateCursorLocal = (clientX: number, clientY: number) => {
      const el = viewportRef.value
      if (!el) {
        return
      }
      lastCursorLocalRef.value = clientToLocalCssPoint(el, clientX, clientY)
    }

    const onPointerDown = (e: PointerEvent) => {
      updateCursorLocal(e.clientX, e.clientY)
      if (props.allowPointerPan && navModeActive.value) {
        const like: ViewportPointerEventLike = {
          pointerId: e.pointerId,
          clientX: e.clientX,
          clientY: e.clientY,
          preventDefault: () => e.preventDefault(),
          currentTarget: {
            setPointerCapture: (pointerId) => viewportRef.value?.setPointerCapture(pointerId),
          },
        }
        handlersRef.value?.onPointerDown(like)
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      updateCursorLocal(e.clientX, e.clientY)
      if (props.allowPointerPan && navModeActive.value) {
        const like: ViewportPointerEventLike = {
          pointerId: e.pointerId,
          clientX: e.clientX,
          clientY: e.clientY,
          preventDefault: () => e.preventDefault(),
          currentTarget: {
            setPointerCapture: (pointerId) => viewportRef.value?.setPointerCapture(pointerId),
          },
        }
        handlersRef.value?.onPointerMove(like)
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (props.allowPointerPan && navModeActive.value) {
        const like: ViewportPointerEventLike = {
          pointerId: e.pointerId,
          clientX: e.clientX,
          clientY: e.clientY,
          preventDefault: () => e.preventDefault(),
          currentTarget: {
            setPointerCapture: (pointerId) => viewportRef.value?.setPointerCapture(pointerId),
          },
        }
        handlersRef.value?.onPointerUp(like)
      }
    }

    const onPointerCancel = (e: PointerEvent) => {
      if (props.allowPointerPan && navModeActive.value) {
        const like: ViewportPointerEventLike = {
          pointerId: e.pointerId,
          clientX: e.clientX,
          clientY: e.clientY,
          preventDefault: () => e.preventDefault(),
          currentTarget: {
            setPointerCapture: (pointerId) => viewportRef.value?.setPointerCapture(pointerId),
          },
        }
        handlersRef.value?.onPointerCancel(like)
      }
    }

    const onWheelCapture = (e: WheelEvent) => {
      const like: ViewportWheelEventLike = {
        ctrlKey: e.ctrlKey,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        clientX: e.clientX,
        clientY: e.clientY,
        preventDefault: () => e.preventDefault(),
      }
      handlersRef.value?.onWheel(like)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (props.holdToPanKey === 'space' && e.code === 'Space') {
        navModeActive.value = true
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (props.holdToPanKey === 'space' && e.code === 'Space') {
        navModeActive.value = false
      }
    }

    const onBlur = () => {
      if (props.holdToPanKey === 'space') {
        navModeActive.value = false
      }
    }

    watch(
      () => [
        props.viewBox.x,
        props.viewBox.y,
        props.viewBox.width,
        props.viewBox.height,
        props.paddingPx,
        props.minScaleFactor,
        props.maxScaleFactor,
        props.wheelZoomSpeed,
        props.wheelPanSpeed,
        props.allowDragPan,
        props.allowPointerPan,
        props.holdToPanKey,
      ],
      () => {
        rebuildInteractions()
        fitToCenter()
      },
      { deep: false },
    )

    watch(navModeActive, () => {
      rebuildInteractions()
    })

    const contentStyle = computed(() => ({
      position: 'absolute',
      inset: 0,
      transformOrigin: '0 0',
      transform: cameraToCssTransform(camera.value),
    }))

    const rootStyle = computed(() => ({
      width: props.width,
      height: props.height,
      position: 'relative',
      overflow: 'hidden',
      touchAction: 'none',
      background: props.background,
      ...(props.style ?? {}),
    }))

    onMounted(() => {
      fitToCenter()
      rebuildInteractions()

      if (props.controllerRef) {
        props.controllerRef.value = {
          fitToCenter,
          getCamera: () => camera.value,
          setCamera: (next) => applyCamera(next),
        }
      }

      window.addEventListener('keydown', onKeyDown, true)
      window.addEventListener('keyup', onKeyUp, true)
      window.addEventListener('blur', onBlur)
    })

    onBeforeUnmount(() => {
      if (props.controllerRef) {
        props.controllerRef.value = null
      }
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onBlur)
    })

    return () =>
      h(
        'div',
        {
          ref: viewportRef,
          style: rootStyle.value,
          onPointerdown: onPointerDown,
          onPointermove: onPointerMove,
          onPointerup: onPointerUp,
          onPointercancel: onPointerCancel,
          onWheelCapture,
        },
        [
          h('div', { style: contentStyle.value }, slots.default?.({ camera: camera.value, fitToCenter })),
          slots.overlay ? h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } }, slots.overlay({ camera: camera.value, fitToCenter })) : null,
        ],
      )
  },
})

export default Viewport2D
