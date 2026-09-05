/**
 * WorldView —— MUI 的 L1 中级游戏引擎层视图模板（2D 世界可视化）。
 *
 * 双模式：
 * 1. 自动渲染：给 `snapshot`（EntitySnapshot）+ 可选 `grid`，自动渲染图元（Grid/Sprite/Text/Polygon）。
 * 2. 手动模式：`@ready` 逃生舱，宿主拿到 world 容器后自行 addChild 任意 PixiJS 对象（取代旧 view-2d）。
 *
 * InteractionLayer：覆盖层捕获指针/滚轮，经相机换算 screen→world，抛出 world/cell 命中意图。
 * 内核用 @main-ui/core/rendering 的 PixiViewport（PixiJS WebGL，唯一 2D 渲染核心）。
 *
 * 视图状态纪律（对齐 F-3 教训）：getViewState 只返回普通值（全新对象），绝不返回响应式 Proxy。
 */
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type CSSProperties, type PropType } from 'vue';
import { Container } from 'pixi.js';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import { PixiViewport, type Camera2D, type Vec2, type ViewBox } from '@main-ui/core/rendering';
import {
  createGrid,
  createPolygonLayer,
  createSpriteLayer,
  createTextLayer,
  hitTestGrid,
  snapshotToItems,
  type EntitySnapshot,
  type GridSpec,
  type TextureResolver,
} from '@main-ui/core/primitives';
import {
  DEFAULT_WORLD_VIEWBOX,
  type WorldCameraState,
  type WorldCellPayload,
  type WorldPointerPayload,
  type WorldReadyApi,
} from './types';
import { buildWorldViewState, parseCssColorToNumber, sanitizeCameraState, toCamera2D } from './world-state';

const CLICK_MOVE_TOLERANCE_PX = 4;

export const WorldView = defineComponent({
  name: 'WorldView',
  props: {
    /** 自动渲染模式：通用实体快照（不绑定 scene-kit）。 */
    snapshot: { type: Object as PropType<EntitySnapshot | null>, default: null },
    /** 自动渲染模式：网格/棋盘图元规格。 */
    grid: { type: Object as PropType<GridSpec | null>, default: null },
    /** 精灵纹理键解析器（可选）。 */
    textureResolver: { type: Function as PropType<TextureResolver>, default: null },
    /** 世界范围（相机 fit 目标）；缺省时从 grid/snapshot 推导，再兜底默认值。 */
    viewBox: { type: Object as PropType<ViewBox | null>, default: null },
    minScale: { type: Number, default: 0.2 },
    maxScale: { type: Number, default: 8 },
    paddingPx: { type: Number, default: 40 },
    /** pixi 数值色；省略时读取 --mui-color-panel 计算（保持主题跟随）。 */
    background: { type: Number, default: null },
    antialias: { type: Boolean, default: false },
    /** 是否启用 InteractionLayer（点击/拖拽命中）。默认 true。 */
    interactive: { type: Boolean, default: true },
    /** 左键拖拽是否平移相机；棋类通常为 false（左键用于选子/落子）。默认 false。 */
    panOnDrag: { type: Boolean, default: false },
    /** 滚轮是否缩放。默认 true。 */
    zoomOnWheel: { type: Boolean, default: true },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    editorInstanceId: { type: String, default: null },
  },
  emits: [
    'ready', 'camera-change',
    'world-pointerdown', 'world-pointerup', 'world-click',
    'cell-pointerdown', 'cell-click',
  ],
  setup(props, { emit }) {
    const containerRef = ref<HTMLElement | null>(null);
    const overlayRef = ref<HTMLElement | null>(null);
    const pendingCamera = ref<WorldCameraState | null>(null);
    let viewport: PixiViewport | null = null;
    let sceneLayer: Container | null = null;
    let destroyed = false;

    // 拖拽状态
    const drag = { pointerId: -1, active: false, startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false };

    // ---------- 世界范围推导 ----------
    const resolvedViewBox = computed<ViewBox>(() => {
      if (props.viewBox) return props.viewBox;
      if (props.grid) {
        const g = props.grid;
        return { x: g.x, y: g.y, width: g.cols * g.cellWidth, height: g.rows * g.cellHeight };
      }
      if (props.snapshot) {
        const b = props.snapshot.bounds;
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      }
      return DEFAULT_WORLD_VIEWBOX;
    });

    // ---------- 背景色：未显式指定时消费主题变量 ----------
    const resolvedBackground = computed(() => {
      if (typeof props.background === 'number') return props.background;
      if (typeof document !== 'undefined') {
        const css = getComputedStyle(document.documentElement).getPropertyValue('--mui-color-panel');
        return parseCssColorToNumber(css) ?? 0xffffff;
      }
      return 0xffffff;
    });

    // ---------- 自动渲染 ----------
    const destroySceneChildren = (): void => {
      if (!sceneLayer) return;
      const removed = sceneLayer.removeChildren();
      for (const child of removed) child.destroy({ children: true });
    };

    const renderScene = (): void => {
      if (!sceneLayer) return;
      destroySceneChildren();

      if (props.grid) {
        sceneLayer.addChild(createGrid(props.grid));
      }
      if (props.snapshot) {
        const items = snapshotToItems(props.snapshot);
        // 层序：多边形（底）→ 精灵 → 文字（顶）
        if (items.polygons.length) sceneLayer.addChild(createPolygonLayer(items.polygons));
        if (items.sprites.length) sceneLayer.addChild(createSpriteLayer(items.sprites, props.textureResolver ?? undefined));
        if (items.texts.length) sceneLayer.addChild(createTextLayer(items.texts));
      }
    };

    // ---------- 相机同步 ----------
    const emitCamera = (camera: Camera2D): void => {
      emit('camera-change', { scale: camera.scale, pan: { x: camera.pan.x, y: camera.pan.y } } satisfies WorldCameraState);
    };

    // ---------- InteractionLayer ----------
    const toLocal = (event: PointerEvent | WheelEvent): Vec2 | null => {
      const el = overlayRef.value;
      if (!el || !viewport) return null;
      const rect = el.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const cellPayload = (screen: Vec2): WorldCellPayload | null => {
      if (!viewport || !props.grid) return null;
      const world = viewport.screenToWorld(screen);
      const hit = hitTestGrid(world.x, world.y, props.grid);
      if (!hit) return null;
      return { world, screen, col: hit.col, row: hit.row };
    };

    const worldPayload = (screen: Vec2): WorldPointerPayload | null => {
      if (!viewport) return null;
      const world = viewport.screenToWorld(screen);
      return { world, screen };
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (!props.interactive || !viewport) return;
      const local = toLocal(event);
      if (!local) return;

      drag.pointerId = event.pointerId;
      drag.active = true;
      drag.moved = false;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      if (props.panOnDrag) overlayRef.value?.setPointerCapture(event.pointerId);

      const wp = worldPayload(local);
      if (wp) emit('world-pointerdown', wp);
      const cp = cellPayload(local);
      if (cp) emit('cell-pointerdown', cp);
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!drag.active || drag.pointerId !== event.pointerId || !viewport) return;
      if (!props.panOnDrag) return;
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      if (Math.abs(event.clientX - drag.startX) > CLICK_MOVE_TOLERANCE_PX || Math.abs(event.clientY - drag.startY) > CLICK_MOVE_TOLERANCE_PX) {
        drag.moved = true;
      }
      if (dx !== 0 || dy !== 0) viewport.panBy({ x: dx, y: dy });
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (drag.pointerId !== event.pointerId || !viewport) return;
      const wasClick = !drag.moved;
      drag.active = false;
      drag.pointerId = -1;

      const local = toLocal(event);
      if (!local) return;
      const wp = worldPayload(local);
      if (wp) emit('world-pointerup', wp);
      if (wasClick) {
        if (wp) emit('world-click', wp);
        const cp = cellPayload(local);
        if (cp) emit('cell-click', cp);
      }
    };

    const onPointerCancel = (event: PointerEvent): void => {
      if (drag.pointerId !== event.pointerId) return;
      drag.active = false;
      drag.pointerId = -1;
    };

    const onWheel = (event: WheelEvent): void => {
      if (!props.interactive || !props.zoomOnWheel || !viewport) return;
      const local = toLocal(event);
      if (!local) return;
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0016);
      viewport.zoomAtScreenPoint(factor, local);
    };

    // ---------- 视图生命周期契约（四成员，onDestroy 幂等；相机进快照，纯值） ----------
    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-world',
      getViewState: () => buildWorldViewState(viewport?.getCamera() ?? (pendingCamera.value ? toCamera2D(pendingCamera.value) : null)),
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<{ camera: unknown }>;
        const camera = sanitizeCameraState(snapshot.camera);
        if (!camera) return;
        if (viewport) viewport.setCamera(toCamera2D(camera));
        else pendingCamera.value = camera; // pixi 异步初始化，就绪后回放
      },
      onDestroy: () => {
        destroyed = true;
        viewport = null;
        sceneLayer = null;
        pendingCamera.value = null;
      },
    };
    if (props.editorInstanceId) {
      useViewLifecycle(props.editorInstanceId, () => lifecycle);
    }

    // ---------- 挂载 ----------
    onMounted(async () => {
      const el = containerRef.value;
      if (!el) return;

      viewport = new PixiViewport(el, {
        viewBox: resolvedViewBox.value,
        minScale: props.minScale,
        maxScale: props.maxScale,
        paddingPx: props.paddingPx,
        background: resolvedBackground.value,
        antialias: props.antialias,
        // 相机由 InteractionLayer 驱动；禁用内核自带的 canvas 拖拽平移，避免双重处理。
        disablePan: true,
      });
      viewport.onCameraChange(emitCamera);
      await viewport.init();
      if (destroyed) {
        viewport.destroy();
        viewport = null;
        return;
      }

      sceneLayer = new Container();
      sceneLayer.label = 'scene';
      viewport.world.addChild(sceneLayer);
      renderScene();

      if (pendingCamera.value) {
        viewport.setCamera(toCamera2D(pendingCamera.value));
        pendingCamera.value = null;
      }

      const api: WorldReadyApi = {
        world: viewport.world,
        screenToWorld: (point: Vec2) => (viewport ? viewport.screenToWorld(point) : point),
        worldToScreen: (point: Vec2) => (viewport ? viewport.worldToScreen(point) : point),
        fitToBounds: (vb?: ViewBox) => viewport?.fitToBounds(vb),
        getCamera: () => viewport?.getCamera() ?? { scale: 1, pan: { x: 0, y: 0 } },
        setCamera: (camera: Camera2D) => viewport?.setCamera(camera),
        getSize: () => viewport?.getSize() ?? { width: 0, height: 0 },
      };
      emit('ready', api);
    });

    // ---------- 响应式 ----------
    watch([() => props.snapshot, () => props.grid, () => props.textureResolver], () => {
      renderScene();
    }, { deep: true });

    watch(resolvedViewBox, (next) => {
      viewport?.setViewBox(next);
    }, { deep: true });

    watch(() => props.background, () => {
      // 背景色在 init 时确定；运行期切换重建内核成本过高，暂不热更（记录意图即可）。
    });

    onBeforeUnmount(() => {
      destroyed = true;
      viewport?.destroy();
      viewport = null;
      sceneLayer = null;
    });

    // ---------- 渲染 ----------
    const rootStyle: CSSProperties = {
      width: '100%', height: '100%', overflow: 'hidden', position: 'relative',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
    };
    const layerStyle: CSSProperties = { position: 'absolute', inset: '0' };
    const overlayStyle: CSSProperties = {
      position: 'absolute', inset: '0',
      pointerEvents: props.interactive ? 'auto' : 'none',
      touchAction: 'none',
    };

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-world', style: { ...rootStyle, display: 'grid', placeItems: 'center' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-world', style: { ...rootStyle, display: 'grid', placeItems: 'center', color: 'var(--mui-color-danger)' } }, props.error);
      }
      return h('div', { class: 'main-ui-view-world', style: rootStyle }, [
        h('div', { ref: containerRef, class: 'main-ui-view-world__canvas', style: layerStyle }),
        h('div', {
          ref: overlayRef,
          class: 'main-ui-view-world__interaction',
          style: overlayStyle,
          onPointerdown: onPointerDown,
          onPointermove: onPointerMove,
          onPointerup: onPointerUp,
          onPointercancel: onPointerCancel,
          onWheel: onWheel,
        }),
      ]);
    };
  },
});
