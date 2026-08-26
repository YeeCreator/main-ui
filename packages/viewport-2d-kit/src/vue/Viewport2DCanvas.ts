import {
  clamp,
  fitCameraToViewBox,
  panBy,
  screenToWorld,
  zoomAtScreenPoint,
  type Camera2D,
  type ViewBox,
} from '../core/index'
import {
  computed,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  type PropType,
  type VNode,
} from 'vue'

export type ViewportContainerSize = {
  width: number
  height: number
}

export type Viewport2DCanvasExpose = {
  fitToBounds: () => void
  zoomIn: () => void
  zoomOut: () => void
  getCamera: () => Camera2D
  screenToWorld: (point: { x: number; y: number }) => { x: number; y: number }
}

function toLocalPoint(target: HTMLElement, event: PointerEvent | WheelEvent): { x: number; y: number } {
  const rect = target.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

export const Viewport2DCanvas = defineComponent({
  name: 'Viewport2DCanvas',
  props: {
    viewBox: {
      type: Object as PropType<ViewBox>,
      required: true,
    },
    minScale: {
      type: Number,
      default: 0.2,
    },
    maxScale: {
      type: Number,
      default: 4,
    },
    paddingPx: {
      type: Number,
      default: 40,
    },
    disablePan: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    zoomPercentChange: (value: number) => Number.isFinite(value),
    interactingChange: (value: boolean) => typeof value === 'boolean',
    cameraChange: (value: Camera2D, size: ViewportContainerSize) =>
      Number.isFinite(value.scale) && Number.isFinite(value.pan.x) && Number.isFinite(value.pan.y) && Number.isFinite(size.width) && Number.isFinite(size.height),
  },
  setup(props, { emit, expose, slots }) {
    const containerRef = ref<HTMLElement | null>(null)
    const resizeObserverRef = ref<ResizeObserver | null>(null)
    const containerSize = reactive<ViewportContainerSize>({
      width: 0,
      height: 0,
    })

    const camera = ref<Camera2D>({
      scale: 1,
      pan: { x: 0, y: 0 },
    })

    const pointerState = reactive({
      pointerId: -1,
      lastX: 0,
      lastY: 0,
      active: false,
    })

    const cameraTransform = computed(() => {
      return `translate(${camera.value.pan.x} ${camera.value.pan.y}) scale(${camera.value.scale})`
    })

    function publishCamera(): void {
      emit('zoomPercentChange', Math.round(camera.value.scale * 100))
      emit('cameraChange', camera.value, { width: containerSize.width, height: containerSize.height })
    }

    function normalizeCamera(nextCamera: Camera2D): Camera2D {
      return {
        ...nextCamera,
        scale: clamp(nextCamera.scale, props.minScale, props.maxScale),
      }
    }

    function fitToBounds(): void {
      if (containerSize.width <= 0 || containerSize.height <= 0) {
        return
      }

      camera.value = normalizeCamera(
        fitCameraToViewBox({
          containerPx: {
            width: containerSize.width,
            height: containerSize.height,
          },
          viewBox: props.viewBox,
          paddingPx: props.paddingPx,
        }),
      )
      publishCamera()
    }

    function zoomByFactor(factor: number, anchor?: { x: number; y: number }): void {
      const fallbackAnchor = {
        x: containerSize.width / 2,
        y: containerSize.height / 2,
      }

      camera.value = normalizeCamera(
        zoomAtScreenPoint(camera.value, {
          factor,
          anchorScreen: anchor ?? fallbackAnchor,
        }),
      )
      publishCamera()
    }

    function zoomIn(): void {
      zoomByFactor(1.15)
    }

    function zoomOut(): void {
      zoomByFactor(1 / 1.15)
    }

    function convertScreenToWorld(point: { x: number; y: number }): { x: number; y: number } {
      return screenToWorld(camera.value, point)
    }

    function handlePointerDown(event: PointerEvent): void {
      if (event.button !== 0 || props.disablePan) {
        return
      }

      pointerState.pointerId = event.pointerId
      pointerState.lastX = event.clientX
      pointerState.lastY = event.clientY
      pointerState.active = true
      emit('interactingChange', true)
      containerRef.value?.setPointerCapture(event.pointerId)
    }

    function handlePointerMove(event: PointerEvent): void {
      if (!pointerState.active || pointerState.pointerId !== event.pointerId || props.disablePan) {
        return
      }

      const deltaX = event.clientX - pointerState.lastX
      const deltaY = event.clientY - pointerState.lastY
      pointerState.lastX = event.clientX
      pointerState.lastY = event.clientY

      camera.value = panBy(camera.value, { x: deltaX, y: deltaY })
      publishCamera()
    }

    function finishPointer(event: PointerEvent): void {
      if (pointerState.pointerId !== event.pointerId) {
        return
      }

      pointerState.pointerId = -1
      pointerState.active = false
      emit('interactingChange', false)
    }

    function handleWheel(event: WheelEvent): void {
      if (!containerRef.value) {
        return
      }

      event.preventDefault()
      const anchor = toLocalPoint(containerRef.value, event)
      const factor = Math.exp(-event.deltaY * 0.0016)
      zoomByFactor(factor, anchor)
    }

    function updateContainerSize(): void {
      const target = containerRef.value
      if (!target) {
        return
      }

      containerSize.width = target.clientWidth
      containerSize.height = target.clientHeight
    }

    onMounted(() => {
      updateContainerSize()
      fitToBounds()

      if (containerRef.value) {
        resizeObserverRef.value = new ResizeObserver(() => {
          updateContainerSize()
          fitToBounds()
        })
        resizeObserverRef.value.observe(containerRef.value)

        containerRef.value.addEventListener('pointerdown', handlePointerDown)
        containerRef.value.addEventListener('pointermove', handlePointerMove)
        containerRef.value.addEventListener('pointerup', finishPointer)
        containerRef.value.addEventListener('pointercancel', finishPointer)
        containerRef.value.addEventListener('wheel', handleWheel, { passive: false })
      }
    })

    onUnmounted(() => {
      resizeObserverRef.value?.disconnect()

      if (containerRef.value) {
        containerRef.value.removeEventListener('pointerdown', handlePointerDown)
        containerRef.value.removeEventListener('pointermove', handlePointerMove)
        containerRef.value.removeEventListener('pointerup', finishPointer)
        containerRef.value.removeEventListener('pointercancel', finishPointer)
        containerRef.value.removeEventListener('wheel', handleWheel)
      }
    })

    expose<Viewport2DCanvasExpose>({
      fitToBounds,
      zoomIn,
      zoomOut,
      getCamera: () => camera.value,
      screenToWorld: convertScreenToWorld,
    })

    return () => {
      const children = slots.default
        ? slots.default({
            width: containerSize.width,
            height: containerSize.height,
            cameraTransform: cameraTransform.value,
            scale: camera.value.scale,
            camera: camera.value,
          })
        : ([] as VNode[])

      return h(
        'div',
        {
          ref: containerRef,
          class: 'viewport-2d-surface',
        },
        children,
      )
    }
  },
})

