import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

export type Camera2D = {
  scale: number
  pan: {
    x: number
    y: number
  }
}

export type ViewportContainerSize = {
  width: number
  height: number
}

export type ViewportWorldPoint = {
  x: number
  y: number
}

export type Viewport2DCanvasExpose = {
  fitToBounds: () => void
  zoomIn: () => void
  zoomOut: () => void
  screenToWorld: (point: ViewportWorldPoint) => ViewportWorldPoint
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export const Viewport2DCanvas = defineComponent({
  name: 'Viewport2DCanvas',
  inheritAttrs: false,
  props: {
    viewBox: {
      type: Object as () => { x: number; y: number; width: number; height: number },
      required: true,
    },
    minScale: {
      type: Number,
      default: 0.2,
    },
    maxScale: {
      type: Number,
      default: 3,
    },
    paddingPx: {
      type: Number,
      default: 0,
    },
    disablePan: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['camera-change', 'zoom-percent-change', 'interacting-change'],
  setup(props, { emit, slots, expose, attrs }) {
    const containerRef = ref<HTMLDivElement | null>(null)
    const size = reactive<ViewportContainerSize>({ width: 1, height: 1 })
    const camera = reactive<Camera2D>({ scale: 1, pan: { x: 0, y: 0 } })
    const isDragging = ref(false)

    let resizeObserver: ResizeObserver | null = null
    let dragPointerId: number | null = null
    let lastPointer = { x: 0, y: 0 }

    const cameraTransform = computed(() => `matrix(${camera.scale} 0 0 ${camera.scale} ${camera.pan.x} ${camera.pan.y})`)

    function updateSize(): void {
      const container = containerRef.value
      if (!container) {
        return
      }

      size.width = Math.max(Math.floor(container.clientWidth), 1)
      size.height = Math.max(Math.floor(container.clientHeight), 1)
    }

    function notifyCameraChanged(): void {
      emit('camera-change', { scale: camera.scale, pan: { ...camera.pan } }, { ...size })
      emit('zoom-percent-change', Math.round(camera.scale * 100))
    }

    function applyCamera(nextCamera: Camera2D): void {
      camera.scale = clamp(nextCamera.scale, props.minScale, props.maxScale)
      camera.pan.x = nextCamera.pan.x
      camera.pan.y = nextCamera.pan.y
      notifyCameraChanged()
    }

    function fitToBounds(): void {
      const paddedWidth = Math.max(props.viewBox.width + props.paddingPx * 2, 1)
      const paddedHeight = Math.max(props.viewBox.height + props.paddingPx * 2, 1)
      const fitScale = clamp(
        Math.min(size.width / paddedWidth, size.height / paddedHeight),
        props.minScale,
        props.maxScale,
      )

      const worldCenterX = props.viewBox.x + props.viewBox.width / 2
      const worldCenterY = props.viewBox.y + props.viewBox.height / 2

      applyCamera({
        scale: fitScale,
        pan: {
          x: size.width / 2 - worldCenterX * fitScale,
          y: size.height / 2 - worldCenterY * fitScale,
        },
      })
    }

    function screenToWorld(point: ViewportWorldPoint): ViewportWorldPoint {
      return {
        x: (point.x - camera.pan.x) / camera.scale,
        y: (point.y - camera.pan.y) / camera.scale,
      }
    }

    function zoomAt(point: ViewportWorldPoint, factor: number): void {
      const nextScale = clamp(camera.scale * factor, props.minScale, props.maxScale)
      if (nextScale === camera.scale) {
        return
      }

      const scaleRatio = nextScale / camera.scale
      applyCamera({
        scale: nextScale,
        pan: {
          x: point.x - (point.x - camera.pan.x) * scaleRatio,
          y: point.y - (point.y - camera.pan.y) * scaleRatio,
        },
      })
    }

    function zoomIn(): void {
      zoomAt({ x: size.width / 2, y: size.height / 2 }, 1.12)
    }

    function zoomOut(): void {
      zoomAt({ x: size.width / 2, y: size.height / 2 }, 1 / 1.12)
    }

    function handleWheel(event: WheelEvent): void {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        const factor = event.deltaY > 0 ? 1 / 1.08 : 1.08
        zoomAt({ x: event.offsetX, y: event.offsetY }, factor)
        return
      }

      applyCamera({
        scale: camera.scale,
        pan: {
          x: camera.pan.x - event.deltaX,
          y: camera.pan.y - event.deltaY,
        },
      })
    }

    function handlePointerDown(event: PointerEvent): void {
      if (props.disablePan || event.button !== 0 || !containerRef.value) {
        return
      }

      isDragging.value = true
      dragPointerId = event.pointerId
      lastPointer = { x: event.clientX, y: event.clientY }
      containerRef.value.setPointerCapture(event.pointerId)
      emit('interacting-change', true)
    }

    function handlePointerMove(event: PointerEvent): void {
      if (!isDragging.value || dragPointerId !== event.pointerId) {
        return
      }

      const deltaX = event.clientX - lastPointer.x
      const deltaY = event.clientY - lastPointer.y
      lastPointer = { x: event.clientX, y: event.clientY }

      applyCamera({
        scale: camera.scale,
        pan: {
          x: camera.pan.x + deltaX,
          y: camera.pan.y + deltaY,
        },
      })
    }

    function endDragging(event?: PointerEvent): void {
      if (!isDragging.value) {
        return
      }

      if (event && dragPointerId === event.pointerId && containerRef.value?.hasPointerCapture(event.pointerId)) {
        containerRef.value.releasePointerCapture(event.pointerId)
      }

      isDragging.value = false
      dragPointerId = null
      emit('interacting-change', false)
    }

    expose({
      fitToBounds,
      zoomIn,
      zoomOut,
      screenToWorld,
    } satisfies Viewport2DCanvasExpose)

    watch(
      () => [props.viewBox.x, props.viewBox.y, props.viewBox.width, props.viewBox.height, props.minScale, props.maxScale, props.paddingPx],
      () => {
        nextTick(() => {
          updateSize()
          fitToBounds()
        })
      },
      { immediate: true },
    )

    onMounted(() => {
      updateSize()
      notifyCameraChanged()

      if (containerRef.value) {
        resizeObserver = new ResizeObserver(() => {
          updateSize()
          notifyCameraChanged()
        })
        resizeObserver.observe(containerRef.value)
      }
    })

    onUnmounted(() => {
      resizeObserver?.disconnect()
      resizeObserver = null
    })

    return () =>
      h(
        'div',
        {
          ...attrs,
          ref: containerRef,
          class: ['viewport-2d-canvas', attrs.class],
          style: [
            {
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              position: 'relative',
              touchAction: 'none',
              cursor: isDragging.value ? 'grabbing' : 'grab',
            },
            attrs.style,
          ],
          onWheel: handleWheel,
          onPointerdown: handlePointerDown,
          onPointermove: handlePointerMove,
          onPointerup: endDragging,
          onPointercancel: endDragging,
          onPointerleave: endDragging,
        },
        slots.default?.({
          width: size.width,
          height: size.height,
          cameraTransform: cameraTransform.value,
        }),
      )
  },
})

export default Viewport2DCanvas

