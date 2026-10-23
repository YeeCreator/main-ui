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
import {
  PixiViewport,
  classifyWheelIntent,
  rotateAtScreenPoint,
  wheelPanDelta,
  type Camera2D,
  type Vec2,
  type ViewBox,
  type WheelMode,
} from '@main-ui/core/rendering';
import { detectEnvironment, resolveShellPolicy } from '@main-ui/core/environment';
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
  type WorldClickButtonPolicy,
  type WorldPointerModifiers,
  type WorldPointerPayload,
  type WorldReadyApi,
  type WorldWheelMode,
} from './types';
import { buildWorldViewState, parseCssColorToNumber, sanitizeCameraState, toCamera2D } from './world-state';

const CLICK_MOVE_TOLERANCE_PX = 4;
const DEFAULT_ROTATE_STEP_RAD = Math.PI / 12;

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
    /** 滚轮是否缩放（保留兼容；优先看 wheelMode）。默认 true。 */
    zoomOnWheel: { type: Boolean, default: true },
    /**
     * 滚轮/触控板分流策略：`auto`（默认）= 捏合缩放·双指平移；`zoom` = 一律缩放；`pan` = 一律平移。
     * 未指定的旧宿主仍受 `zoomOnWheel` 控制（true 等价 zoom，false 等价 pan）。
     */
    wheelMode: { type: String as PropType<WorldWheelMode>, default: 'auto' },
    /** `world-click` 抛出策略：left（默认，仅左键）/ any（旧行为）。 */
    clickButtonPolicy: { type: String as PropType<WorldClickButtonPolicy>, default: 'left' },
    /** 是否启用内置原生手势隔离（user-select / preventDefault / contextmenu 抑制）。缺省取环境 ShellPolicy。 */
    nativeGestureGuard: { type: Boolean as PropType<boolean | null>, default: null },
    /** 是否启用双指旋转手势（“单指按住 + 另一指拖动”）。默认 false（相机模型已支持 rotation）。 */
    rotateOnGesture: { type: Boolean, default: false },
    /** 键盘旋转步长（弧度）：供宿主自行绑定快捷键时复用默认步长。 */
    rotateStep: { type: Number, default: DEFAULT_ROTATE_STEP_RAD },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    editorInstanceId: { type: String, default: null },
  },
  emits: [
    'ready', 'camera-change',
    'world-pointerdown', 'world-pointerup', 'world-click', 'world-contextmenu',
    'cell-pointerdown', 'cell-click', 'cell-contextmenu',
  ],
  setup(props, { emit }) {
    const containerRef = ref<HTMLElement | null>(null);
    const overlayRef = ref<HTMLElement | null>(null);
    const pendingCamera = ref<WorldCameraState | null>(null);
    let viewport: PixiViewport | null = null;
    let sceneLayer: Container | null = null;
    let destroyed = false;

    /** 内置手势隔离开关：显式 prop 优先，缺省取自环境 ShellPolicy（浏览器/Electron 统一口径）。 */
    const gestureGuard = computed(() => props.nativeGestureGuard ?? resolveShellPolicy(detectEnvironment()).canvasGestureGuard);

    // 拖拽状态
    const drag = { pointerId: -1, active: false, button: 0, startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false };
    // 双指旋转状态（rotateOnGesture）：两个指针的实时位置与上次夹角。
    const rotate = { active: false, aId: -1, bId: -1, ax: 0, ay: 0, bx: 0, by: 0, lastAngle: 0 };

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
      const payload: WorldCameraState = { scale: camera.scale, pan: { x: camera.pan.x, y: camera.pan.y } };
      if (typeof camera.rotation === 'number' && camera.rotation !== 0) payload.rotation = camera.rotation;
      emit('camera-change', payload);
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

    const worldPayload = (screen: Vec2, event?: PointerEvent | WheelEvent | MouseEvent): WorldPointerPayload | null => {
      if (!viewport) return null;
      const world = viewport.screenToWorld(screen);
      const payload: WorldPointerPayload = { world, screen };
      if (event) {
        payload.button = (event as PointerEvent).button;
        payload.modifiers = modifiersFromEvent(event);
      }
      return payload;
    };

    const modifiersFromEvent = (event: PointerEvent | WheelEvent | MouseEvent): WorldPointerModifiers => ({
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
      meta: event.metaKey,
    });

    /** 是否允许该事件触发拖拽平移（仅左键）。 */
    const canStartDrag = (event: PointerEvent): boolean => event.button === 0;

    /** 双指旋转：记录/更新参与旋转的两个指针。 */
    const trackRotatePointer = (event: PointerEvent, local: Vec2): void => {
      if (!rotate.active) {
        rotate.active = true;
        rotate.aId = event.pointerId;
        rotate.ax = local.x;
        rotate.ay = local.y;
        rotate.bId = -1;
        return;
      }
      if (event.pointerId === rotate.aId) {
        rotate.ax = local.x;
        rotate.ay = local.y;
      } else if (event.pointerId === rotate.bId) {
        rotate.bx = local.x;
        rotate.by = local.y;
      } else if (rotate.bId === -1) {
        rotate.bId = event.pointerId;
        rotate.bx = local.x;
        rotate.by = local.y;
        rotate.lastAngle = Math.atan2(rotate.by - rotate.ay, rotate.bx - rotate.ax);
      }
    };

    const releaseRotatePointer = (pointerId: number): void => {
      if (!rotate.active) return;
      if (pointerId === rotate.aId) {
        rotate.active = false;
      } else if (pointerId === rotate.bId) {
        rotate.bId = -1;
      }
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (!props.interactive || !viewport) return;
      const local = toLocal(event);
      if (!local) return;

      if (gestureGuard.value) {
        // 抑制原生文本选区 / 图片拖拽（拖拽期间浏览器默认行为会抢焦点）。
        event.preventDefault();
      }

      drag.pointerId = event.pointerId;
      drag.active = true;
      drag.button = event.button;
      drag.moved = false;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      if (props.panOnDrag && canStartDrag(event)) overlayRef.value?.setPointerCapture(event.pointerId);
      if (props.rotateOnGesture && canStartDrag(event)) trackRotatePointer(event, local);

      const wp = worldPayload(local, event);
      if (wp) emit('world-pointerdown', wp);
      const cp = cellPayload(local);
      if (cp) emit('cell-pointerdown', { ...cp, button: wp?.button, modifiers: wp?.modifiers });
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!viewport) return;

      // 双指旋转优先（rotateOnGesture）：两指都存在时仅做旋转，不触发平移。
      if (props.rotateOnGesture && rotate.active && rotate.bId !== -1 && (event.pointerId === rotate.aId || event.pointerId === rotate.bId)) {
        const local = toLocal(event);
        if (local) {
          trackRotatePointer(event, local);
          const angle = Math.atan2(rotate.by - rotate.ay, rotate.bx - rotate.ax);
          let delta = angle - rotate.lastAngle;
          if (delta > Math.PI) delta -= 2 * Math.PI;
          if (delta < -Math.PI) delta += 2 * Math.PI;
          rotate.lastAngle = angle;
          if (delta !== 0) {
            const anchor = { x: (rotate.ax + rotate.bx) / 2, y: (rotate.ay + rotate.by) / 2 };
            viewport.setCamera(rotateAtScreenPoint(viewport.getCamera(), { deltaAngle: delta, anchorScreen: anchor }));
          }
        }
        return;
      }

      if (!drag.active || drag.pointerId !== event.pointerId) return;
      if (!props.panOnDrag || drag.button !== 0) return;
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
      releaseRotatePointer(event.pointerId);
      if (drag.pointerId !== event.pointerId || !viewport) return;
      const wasClick = !drag.moved;
      drag.active = false;
      drag.pointerId = -1;

      const local = toLocal(event);
      if (!local) return;
      const wp = worldPayload(local, event);
      if (wp) emit('world-pointerup', wp);
      if (wasClick && wp) {
        const isRight = wp.button === 2;
        if (isRight && props.clickButtonPolicy !== 'any') {
          // 右键：不走 world-click，交专用 contextmenu 语义。
          emit('world-contextmenu', wp);
          const cp = cellPayload(local);
          if (cp) emit('cell-contextmenu', { ...cp, button: wp.button, modifiers: wp.modifiers });
        } else if (!isRight && props.clickButtonPolicy === 'left') {
          // 默认策略：仅左键抛 world-click。
          emit('world-click', wp);
          const cp = cellPayload(local);
          if (cp) emit('cell-click', { ...cp, button: wp.button, modifiers: wp.modifiers });
        } else {
          // policy='any'（旧行为）：任意键都抛 world-click。
          emit('world-click', wp);
          const cp = cellPayload(local);
          if (cp) emit('cell-click', { ...cp, button: wp.button, modifiers: wp.modifiers });
        }
      }
    };

    const onPointerCancel = (event: PointerEvent): void => {
      releaseRotatePointer(event.pointerId);
      if (drag.pointerId !== event.pointerId) return;
      drag.active = false;
      drag.pointerId = -1;
    };

    const onWheel = (event: WheelEvent): void => {
      if (!props.interactive || !viewport) return;
      const local = toLocal(event);
      if (!local) return;
      event.preventDefault();

      const mode: WheelMode = props.wheelMode === 'auto'
        ? (props.zoomOnWheel ? 'auto' : 'pan')
        : (props.wheelMode as WheelMode);
      const intent = classifyWheelIntent(event, mode);
      if (intent === 'zoom') {
        const factor = Math.exp(-event.deltaY * 0.0016);
        viewport.zoomAtScreenPoint(factor, local);
      } else {
        const delta = wheelPanDelta(event, 1);
        if (delta.x !== 0 || delta.y !== 0) viewport.panBy(delta);
      }
    };

    /** 右键原生菜单：缺省（gestureGuard 开）在交互层内抑制，宿主无需再兜底。 */
    const onContextMenu = (event: MouseEvent): void => {
      if (gestureGuard.value) event.preventDefault();
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
        rotateAtScreenPoint: (deltaAngle: number, anchorScreen: Vec2) => {
          if (!viewport) return;
          viewport.setCamera(rotateAtScreenPoint(viewport.getCamera(), { deltaAngle, anchorScreen }));
        },
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
      touchAction: gestureGuard.value ? 'none' : 'auto',
      userSelect: gestureGuard.value ? 'none' : 'auto',
      WebkitUserSelect: gestureGuard.value ? 'none' : 'auto',
      WebkitTouchCallout: gestureGuard.value ? 'none' : 'auto',
      WebkitTapHighlightColor: 'transparent',
    } as CSSProperties;

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
          onContextmenu: onContextMenu,
        }),
      ]);
    };
  },
});
