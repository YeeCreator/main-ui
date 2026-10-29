/**
 * WorldView —— MUI 的 L1 中级游戏引擎层视图模板（世界可视化，**后端无关**）。
 *
 * 双模式：
 * 1. 自动渲染：给 `snapshot`（EntitySnapshot）+ 可选 `grid`，交后端渲染图元。
 * 2. 手动模式：`@ready` 逃生舱，宿主拿最小句柄（尺寸 / 根对象 / requestRender）自行绘制。
 *
 * 后端（设计 §十九 2–3）：
 * - 二维档 = Pixi 后端（`@main-ui/core/rendering` 的 `PixiViewportBackend`，缺省）。
 * - 三维档 = `@main-ui/render-3d`（由宿主经 `backends` prop 或全局注册表注入）。
 * 模板本身**不 import 任何渲染库**，只依赖 `ViewportBackend` 接口。
 *
 * 切档纪律（§十九 9）：单模板单实例，`dimension` 变化时只换后端（组件实例不销毁），
 * 相机经统一表示（`camera-bridge`）连续传递，`getViewState` 往返一致。
 *
 * InteractionLayer：覆盖层捕获指针/滚轮，经后端换算 screen→world，抛出 world/cell 命中意图。
 *
 * 视图状态纪律（对齐 F-3 教训）：getViewState 只返回普通值（全新对象），绝不返回响应式 Proxy。
 */
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type CSSProperties, type PropType } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import {
  PixiViewportBackend,
  classifyWheelIntent,
  createPointerGestureTracker,
  defaultBackendRegistry,
  defaultDpr,
  panBy,
  resolveTapTolerance,
  rotateAtScreenPoint,
  zoomAtScreenPoint,
  type BackendDimension,
  type Camera2D,
  type Vec2,
  type ViewBox,
  type ViewportBackend,
  type ViewportBackendFactory,
  type WheelMode,
} from '@main-ui/core/rendering';
import { detectEnvironment, resolveShellPolicy } from '@main-ui/core/environment';
import { readWheel, wheelPanDelta, zoomFactorOf } from '@main-ui/core/input';
import {
  prepareContentLayer,
  visibleWorldRect,
  type ContentLayerItem,
  type ProjectedContentItem,
  type WorldRect,
} from '@main-ui/core/rendering';
import type { EntitySnapshot, GridSpec, TextureResolver } from '@main-ui/core/primitives';
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

const DEFAULT_ROTATE_STEP_RAD = Math.PI / 12;

/** 二维档后端键（设置持久化与诊断的稳定键）。 */
export const PIXI_BACKEND_KEY = 'pixi-2d';
/** 三维档缺省后端键（`@main-ui/render-3d` 注册时使用同一键）。 */
export const THREE_BACKEND_KEY = 'three-3d';

export const WorldView = defineComponent({
  name: 'WorldView',
  props: {
    /** 自动渲染模式：通用实体快照（不绑定 scene-kit）。 */
    snapshot: { type: Object as PropType<EntitySnapshot | null>, default: null },
    /** 自动渲染模式：网格图元规格。 */
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
    /** 左键拖拽是否平移相机；左键用于「点选」的宿主通常为 false。默认 false。 */
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
    /**
     * 内容层（**文字面**）：在 GPU 几何面之上叠加浏览器绘制的内容。
     *
     * 白板必需的能力（原生文本编辑、异构内容、任意倍率锐利的公式）
     * GPU 做不到，只能靠 DOM。两层**共用同一台相机** —— 这不是「两套变换并存」
     * （那条禁令针对的是两个相机）。
     *
     * 层序固定：内容层恒在几何面之上，「几何遮挡内容」不可实现。
     * 需要交错时按带（band）拆分，不得靠 z 序。
     */
    contentItems: { type: Array as PropType<readonly ContentLayerItem[]>, default: () => [] },
    /**
     * 内容层是否启用**视口裁剪**。默认 `true`。
     *
     * **不建议关闭**：不裁剪时宿主会为所有项建 DOM 节点，节点数一多即成为瓶颈
     * （白板的常见卡死形态）。仅当宿主自行裁剪时才关闭。
     */
    cullContent: { type: Boolean, default: true },
    /**
     * 轻点容差（CSS 像素）：松手时位移不超过该值才算 `world-click`。
     *
     * - 缺省（`null`）= **自动**：`panOnDrag=true` 取 4px；`panOnDrag=false` 取「不参与判别」
     *   （「轻点选中」宿主手指微抖不会吞点击）——与原行为逐字节等价。
     * - 显式数值 = 该值参与判别。编辑器「拖拽移动实体」应传 4，触摸端可传 10–12。
     */
    tapTolerancePx: { type: Number as PropType<number | null>, default: null },
    /** 键盘旋转步长（弧度）：供宿主自行绑定快捷键时复用默认步长。 */
    rotateStep: { type: Number, default: DEFAULT_ROTATE_STEP_RAD },
    /**
     * 视图维度：`2`（缺省）= 二维档，`3` = 三维档。
     *
     * 后端由 `backends`（或全局注册表）解析；三维档未装三维后端时**降级走二维后端**
     * 并抛 `backend-change`（`ok:false` / `reason:'backend-missing'`），不抛异常、不空白。
     */
    dimension: { type: Number as PropType<BackendDimension>, default: 2 },
    /** 宿主自定义后端集合（键 → 工厂）；缺省读全局注册表 + 内置 Pixi。 */
    backends: { type: Object as PropType<Record<string, ViewportBackendFactory> | null>, default: null },
    /** 指定后端键（优先级高于 `dimension` 推导）；缺省按 `dimension` 解析。 */
    backendKey: { type: String as PropType<string | null>, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    editorInstanceId: { type: String, default: null },
  },
  emits: [
    'ready', 'camera-change',
    'world-pointerdown', 'world-pointerup', 'world-click', 'world-contextmenu',
    'cell-pointerdown', 'cell-click', 'cell-contextmenu',
    'backend-change',
  ],
  setup(props, { emit, slots }) {
    const containerRef = ref<HTMLElement | null>(null);
    const overlayRef = ref<HTMLElement | null>(null);
    const contentRendererRef = ref<HTMLElement | null>(null);
    const pendingCamera = ref<WorldCameraState | null>(null);
    let backend: ViewportBackend | null = null;
    let activeBackendKey: string | null = null;
    let destroyed = false;

    /** 内置手势隔离开关：显式 prop 优先，缺省取自环境 ShellPolicy（浏览器/Electron 统一口径）。 */
    const gestureGuard = computed(() => props.nativeGestureGuard ?? resolveShellPolicy(detectEnvironment()).canvasGestureGuard);

    // 拖拽状态
    const gesture = createPointerGestureTracker();
    const drag = { pointerId: -1, active: false, button: 0, lastX: 0, lastY: 0 };

    /** 本次手势的轻点容差；默认值映射见 `resolveTapTolerance`（core，含测试）。 */
    const tapTolerance = computed<number | null>(() =>
      resolveTapTolerance({ panOnDrag: props.panOnDrag, tapTolerancePx: props.tapTolerancePx }));
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

    // ---------- 后端解析 ----------
    /**
     * 解析目标后端工厂。
     *
     * 优先级：显式 `backendKey` → `backends`/注册表按 `dimension` 找 → 内置 Pixi（二维）。
     * 三维档找不到三维后端时**降级二维**并抛 `backend-change`（不空白、不抛错）。
     */
    const builtinPixiFactory: ViewportBackendFactory = () =>
      new PixiViewportBackend({ textureResolver: props.textureResolver ?? undefined, antialias: props.antialias });

    const lookupFactory = (key: string): ViewportBackendFactory | null => {
      if (props.backends && props.backends[key]) return props.backends[key];
      const registered = defaultBackendRegistry.get(key);
      if (registered) return registered.factory;
      if (key === PIXI_BACKEND_KEY) return builtinPixiFactory;
      return null;
    };

    /** 收集可用后端条目（props.backends 覆盖注册表；内置 Pixi 始终兜底）。 */
    const collectEntries = (): Array<{
      key: string;
      factory: ViewportBackendFactory;
      dimensions: readonly BackendDimension[];
    }> => {
      const out = new Map<string, { key: string; factory: ViewportBackendFactory; dimensions: readonly BackendDimension[] }>();
      for (const entry of defaultBackendRegistry.list()) {
        out.set(entry.key, { key: entry.key, factory: entry.factory, dimensions: entry.capabilities.dimensions });
      }
      if (props.backends) {
        for (const [key, factory] of Object.entries(props.backends)) {
          const existing = defaultBackendRegistry.get(key);
          out.set(key, {
            key,
            factory,
            // 宿主自建后端未必在注册表里：按键名推断维度（`*3d*` = [2,3]，否则 [2]）
            dimensions: existing?.capabilities.dimensions ?? (key.includes('3d') ? [2, 3] : [2]),
          });
        }
      }
      if (!out.has(PIXI_BACKEND_KEY)) {
        out.set(PIXI_BACKEND_KEY, { key: PIXI_BACKEND_KEY, factory: builtinPixiFactory, dimensions: [2] });
      }
      return Array.from(out.values());
    };

    const resolveBackendFactory = (): { key: string; factory: ViewportBackendFactory } => {
      if (props.backendKey) {
        const factory = lookupFactory(props.backendKey);
        if (factory) return { key: props.backendKey, factory };
        return { key: PIXI_BACKEND_KEY, factory: builtinPixiFactory };
      }

      if (props.dimension === 3) {
        const preferred = lookupFactory(THREE_BACKEND_KEY);
        if (preferred) return { key: THREE_BACKEND_KEY, factory: preferred };
        // 退化：找任一声明支持 3 的已注册后端（宿主可能用别的键注册）
        const candidate = collectEntries().find((entry) => entry.dimensions.includes(3));
        if (candidate) return { key: candidate.key, factory: candidate.factory };
        return { key: PIXI_BACKEND_KEY, factory: builtinPixiFactory };
      }

      const twoD = lookupFactory(PIXI_BACKEND_KEY);
      return twoD ? { key: PIXI_BACKEND_KEY, factory: twoD } : { key: PIXI_BACKEND_KEY, factory: builtinPixiFactory };
    };

    // ---------- 相机同步 ----------
    const emitCamera = (camera: Camera2D): void => {
      const payload: WorldCameraState = { scale: camera.scale, pan: { x: camera.pan.x, y: camera.pan.y } };
      if (typeof camera.rotation === 'number' && camera.rotation !== 0) payload.rotation = camera.rotation;
      // 相机一变，内容层（DOM 面）必须跟着重算 —— 两面共用这一台相机。
      cameraForContent.value = camera;
      emit('camera-change', payload);
    };

    // ---------- 内容层（文字面 / DOM） ----------
    /**
     * 内容层使用的相机快照。
     *
     * 与几何面**同一台相机**：几何面把相机交给后端，内容层用它做投影。
     * 两者若不同源，就会重现「相机在变、画面不动」那类故障
     * （本次已在 view-canvas / view-sandbox 各修过一次）。
     */
    const cameraForContent = ref<Camera2D>({ scale: 1, pan: { x: 0, y: 0 } });

    /** 容器尺寸（内容层投影需要）。 */
    const contentSize = ref<{ width: number; height: number }>({ width: 0, height: 0 });

    /** 可见世界范围（供宿主自行裁剪时使用；不裁剪时也可用于诊断）。 */
    const visibleWorld = computed<WorldRect | null>(() => {
      const size = contentSize.value;
      if (size.width <= 0 || size.height <= 0) return null;
      return visibleWorldRect(cameraForContent.value, size);
    });

    /** 投影后的内容层项（已裁剪）。 */
    const projectedContent = computed<ProjectedContentItem[]>(() => {
      const items = props.contentItems;
      if (!items || items.length === 0) return [];
      const size = contentSize.value;
      if (size.width <= 0 || size.height <= 0) return [];
      if (!props.cullContent) {
        // 宿主自行裁剪：仍然投影，只是不剔除
        return prepareContentLayer(cameraForContent.value, { width: Number.MAX_SAFE_INTEGER, height: Number.MAX_SAFE_INTEGER }, items);
      }
      return prepareContentLayer(cameraForContent.value, size, items);
    });

    /** 内容层插槽回传的上下文（宿主据此渲染自己的内容）。 */
    const contentLayerContext = computed(() => ({
      camera: cameraForContent.value,
      size: { ...contentSize.value },
      visibleWorldRect: visibleWorld.value,
    }));

    // ---------- InteractionLayer ----------
    const toLocal = (event: PointerEvent | WheelEvent): Vec2 | null => {
      const el = overlayRef.value;
      if (!el || !backend) return null;
      const rect = el.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const cellPayload = (screen: Vec2): WorldCellPayload | null => {
      if (!backend || !props.grid) return null;
      const world = backend.screenToWorld(screen);
      const hit = backend.pickCell(screen);
      if (!hit) return null;
      return { world, screen, col: hit.col, row: hit.row };
    };

    const worldPayload = (screen: Vec2, event?: PointerEvent | WheelEvent | MouseEvent): WorldPointerPayload | null => {
      if (!backend) return null;
      const world = backend.screenToWorld(screen);
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
      if (!props.interactive || !backend) return;
      const local = toLocal(event);
      if (!local) return;

      if (gestureGuard.value) {
        // 抑制原生文本选区 / 图片拖拽（拖拽期间浏览器默认行为会抢焦点）。
        event.preventDefault();
      }

      drag.pointerId = event.pointerId;
      drag.active = true;
      drag.button = event.button;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      gesture.down({ x: event.clientX, y: event.clientY });
      // 平移相机时捕获指针，保证拖出画布仍能收到 pointerup。
      // 本层没有 DOM 子元素，捕获导致的 click 重定向无副作用（宿主一律走 Emits）。
      if (props.panOnDrag && canStartDrag(event)) overlayRef.value?.setPointerCapture(event.pointerId);
      if (props.rotateOnGesture && canStartDrag(event)) trackRotatePointer(event, local);

      const wp = worldPayload(local, event);
      if (wp) emit('world-pointerdown', wp);
      const cp = cellPayload(local);
      if (cp) emit('cell-pointerdown', { ...cp, button: wp?.button, modifiers: wp?.modifiers });
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!backend) return;

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
            backend.setCamera(rotateAtScreenPoint(backend.getCamera(), { deltaAngle: delta, anchorScreen: anchor }));
          }
        }
        return;
      }

      if (!drag.active || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;

      // 位移记账独立于 panOnDrag：panOnDrag=false 的宿主（编辑器拖拽实体）同样要能判定「拖拽 ≠ 点击」。
      gesture.move({ x: event.clientX, y: event.clientY }, tapTolerance.value);

      if (!props.panOnDrag || drag.button !== 0) return;
      if (dx !== 0 || dy !== 0) backend.setCamera(panBy(backend.getCamera(), { x: dx, y: dy }));
    };

    const onPointerUp = (event: PointerEvent): void => {
      releaseRotatePointer(event.pointerId);
      if (drag.pointerId !== event.pointerId || !backend) return;
      const wasClick = gesture.up({ x: event.clientX, y: event.clientY }, tapTolerance.value) === 'tap';
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
      if (!props.interactive || !backend) return;
      const local = toLocal(event);
      if (!local) return;
      event.preventDefault();

      const mode: WheelMode = props.wheelMode === 'auto'
        ? (props.zoomOnWheel ? 'auto' : 'pan')
        : (props.wheelMode as WheelMode);
      // 判型与灵敏度取唯一真相源（core/input）：设备维度决定系数，
      // 不得在此硬编码 0.0016 —— 那会让 Ctrl+滚轮套用触控板档而指数爆炸。
      const wheelEvent = {
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        shiftKey: event.shiftKey,
      };
      const reading = readWheel(wheelEvent);
      const intent = classifyWheelIntent(wheelEvent, mode);
      if (intent === 'zoom') {
        // 以锚点为中心缩放：用 core 的纯函数算新相机（喷点世界坐标保持不动）。
        backend.setCamera(zoomAtScreenPoint(backend.getCamera(), { factor: zoomFactorOf(reading, event.deltaY), anchorScreen: local }));
      } else {
        const delta = wheelPanDelta(event);
        if (delta.x !== 0 || delta.y !== 0) backend.setCamera(panBy(backend.getCamera(), delta));
      }
    };

    /** 右键原生菜单：缺省（gestureGuard 开）在交互层内抑制，宿主无需再兜底。 */
    const onContextMenu = (event: MouseEvent): void => {
      if (gestureGuard.value) event.preventDefault();
    };

    // ---------- 后端生命周期 ----------
    /** 最小句柄（后端无关）：尺寸 / 世界根对象 / 请求重绘。 */
    const buildReadyApi = (): WorldReadyApi => ({
      getSize: () => backend?.getHandle().getSize() ?? { width: 0, height: 0 },
      getRootObject: () => backend?.getHandle().getRootObject() ?? null,
      requestRender: () => backend?.requestRender(),
      screenToWorld: (point: Vec2) => backend?.screenToWorld(point) ?? point,
      worldToScreen: (point: Vec2) => backend?.worldToScreen(point) ?? point,
      fitToBounds: (vb?: ViewBox) => backend?.fitToBounds(vb),
      getCamera: () => backend?.getCamera() ?? { scale: 1, pan: { x: 0, y: 0 } },
      setCamera: (camera: Camera2D) => backend?.setCamera(camera),
      rotateAtScreenPoint: (deltaAngle: number, anchorScreen: Vec2) => {
        if (!backend) return;
        backend.setCamera(rotateAtScreenPoint(backend.getCamera(), { deltaAngle, anchorScreen }));
      },
      getBackend: () => backend,
    });

    /** 销毁当前后端（幂等）。 */
    const teardownBackend = (): void => {
      if (!backend) return;
      backend.unmount();
      backend = null;
      activeBackendKey = null;
    };

    /**
     * 装配指定后端：挂载 → 订阅相机 → 喂快照 → 回放相机 → 抛事件。
     *
     * 相机连续：换后端前先取旧后端的相机（`Camera2D` 是统一表示），挂载后写回新后端，
     * 因此二维↔三维切换画面不跳变（设计 §十九 9）。
     */
    const mountBackend = async (key: string, factory: ViewportBackendFactory, emitReadyEvent: boolean): Promise<void> => {
      const el = containerRef.value;
      if (!el) return;

      const previousCamera = backend?.getCamera() ?? null;
      teardownBackend();

      const next = factory();
      backend = next;
      activeBackendKey = key;

      try {
        await next.mount(el, {
          viewBox: resolvedViewBox.value,
          minScale: props.minScale,
          maxScale: props.maxScale,
          paddingPx: props.paddingPx,
          background: resolvedBackground.value,
          devicePixelRatio: defaultDpr(),
        });
      } catch (error) {
        // 初始化失败：不留半挂载状态，交上层兜底（模板不抛异常，避免整屏崩）。
        backend = null;
        activeBackendKey = null;
        emit('backend-change', {
          key, ok: false, error: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      if (destroyed) {
        next.unmount();
        backend = null;
        return;
      }

      next.onCameraChange(emitCamera);
      next.applySnapshot({ snapshot: props.snapshot, grid: props.grid });

      const restore = previousCamera ?? (pendingCamera.value ? toCamera2D(pendingCamera.value) : null);
      if (restore) next.setCamera(restore);
      pendingCamera.value = null;

      emit('backend-change', { key, ok: true, capabilities: next.capabilities });
      if (emitReadyEvent) emit('ready', buildReadyApi());
    };

    /** 按当前 props 解析并（重新）装配后端。 */
    const syncBackend = async (emitReadyEvent: boolean): Promise<void> => {
      const { key, factory } = resolveBackendFactory();

      if (props.dimension === 3 && key === PIXI_BACKEND_KEY) {
        // 三维档但无三维后端：降级二维并如实告知（不空白、不报错）
        emit('backend-change', { key, ok: false, reason: 'backend-missing', requestedDimension: 3 });
      }

      if (backend && activeBackendKey === key && !emitReadyEvent) {
        // 同键已挂载：只重喂快照（避免切换时无谓重建渲染器）
        backend.applySnapshot({ snapshot: props.snapshot, grid: props.grid });
        return;
      }
      await mountBackend(key, factory, emitReadyEvent);
    };

    // ---------- 视图生命周期契约（四成员，onDestroy 幂等；相机进快照，纯值） ----------
    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-world',
      getViewState: () => buildWorldViewState(backend?.getCamera() ?? (pendingCamera.value ? toCamera2D(pendingCamera.value) : null)),
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<{ camera: unknown }>;
        const camera = sanitizeCameraState(snapshot.camera);
        if (!camera) return;
        if (backend) backend.setCamera(toCamera2D(camera));
        else pendingCamera.value = camera; // 后端异步初始化，就绪后回放
      },
      onDestroy: () => {
        destroyed = true;
        teardownBackend();
        pendingCamera.value = null;
      },
    };
    if (props.editorInstanceId) {
      useViewLifecycle(props.editorInstanceId, () => lifecycle);
    }

    // ---------- 挂载 ----------
    let contentResizeObserver: ResizeObserver | null = null;

    /**
     * 同步内容层尺寸。
     *
     * 内容层用**容器**尺寸做投影与裁剪，必须与实际渲染面积一致；
     * 否则裁剪边界会偏移，表现为「视野内的公式不显示」。
     */
    const syncContentSize = (): void => {
      const el = contentRendererRef.value;
      if (!el) return;
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width === contentSize.value.width && height === contentSize.value.height) return;
      contentSize.value = { width, height };
    };

    onMounted(async () => {
      if (!containerRef.value) return;
      syncContentSize();
      // 相机初值：把当前后端相机喂给内容层，避免首帧内容层停在恒等变换。
      const initial = backend?.getCamera();
      if (initial) cameraForContent.value = initial;
      const el = contentRendererRef.value;
      if (el && typeof ResizeObserver !== 'undefined') {
        contentResizeObserver = new ResizeObserver(() => {
          syncContentSize();
          // 尺寸变化后后端会重算相机，重新取一次
          const next = backend?.getCamera();
          if (next) cameraForContent.value = next;
        });
        contentResizeObserver.observe(el);
      }
      await syncBackend(true);
    });

    // ---------- 响应式 ----------
    watch([() => props.snapshot, () => props.grid], () => {
      backend?.applySnapshot({ snapshot: props.snapshot, grid: props.grid });
    }, { deep: true });

    watch(resolvedViewBox, (next) => {
      backend?.setViewBox(next);
    }, { deep: true });

    // 维度 / 后端键变化：换后端（组件实例不销毁，相机经统一表示连续传递）
    watch(
      [() => props.dimension, () => props.backendKey],
      () => {
        if (destroyed) return;
        void syncBackend(false);
      },
    );

    watch(() => props.background, () => {
      // 背景色在 mount 时确定；运行期切换重建渲染器成本过高，暂不热更。
    });

    onBeforeUnmount(() => {
      destroyed = true;
      contentResizeObserver?.disconnect();
      contentResizeObserver = null;
      teardownBackend();
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

    /**
     * 内容层样式。
     *
     * `pointerEvents: 'none'` 是**硬约束**：内容层只显示、不命中。
     * 否则会出现「两套命中」（覆盖层 + DOM 子元素），表现为点击穿透与双重触发。
     * 需要内容可交互时，宿主在插槽内自行对**具体子元素**开启 `pointerEvents: 'auto'`。
     */
    const contentLayerStyle: CSSProperties = {
      position: 'absolute', inset: '0',
      pointerEvents: 'none',
      overflow: 'hidden',
    } as CSSProperties;

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-world', style: { ...rootStyle, display: 'grid', placeItems: 'center' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-world', style: { ...rootStyle, display: 'grid', placeItems: 'center', color: 'var(--mui-color-danger)' } }, props.error);
      }

      /**
       * 内容层（文字面）。
       *
       * 三条纪律：
       * 1. **不接收指针**（`pointerEvents: 'none'`）—— 命中统一走交互覆盖层，
       *    否则会出现「两套命中」，表现为点击穿透/双重触发。
       * 2. **不施加 CSS 相机变换** —— 每一项已由 `projectContentLayer` 算成
       *    屏幕坐标；对整个层再变换一次等于把相机应用两遍。
       * 3. **层序在几何面之上** —— 「几何遮挡内容」不可实现，这是契约明写的局限。
       *
       * 有 `content-layer` 插槽时把投影结果交给宿主自绘；否则用默认渲染
       * （绝对定位 + translate），宿主可直接用 `kind` 决定内容。
       */
      const contentLayer = h('div', {
        ref: contentRendererRef,
        class: 'main-ui-view-world__content-layer',
        style: contentLayerStyle,
        'data-content-count': String(projectedContent.value.length),
      }, slots['content-layer']
        ? slots['content-layer']({ ...contentLayerContext.value, items: projectedContent.value })
        : projectedContent.value.map((item) => h('div', {
          key: item.id,
          class: 'main-ui-view-world__content-item',
          'data-content-kind': item.kind,
          'data-content-id': item.id,
          style: {
            position: 'absolute',
            left: '0',
            top: '0',
            transform: `translate(${item.screen.x + item.offset.x}px, ${item.screen.y + item.offset.y}px)`,
            width: item.screenSize.width > 0 ? `${item.screenSize.width}px` : undefined,
            height: item.screenSize.height > 0 ? `${item.screenSize.height}px` : undefined,
          },
        }, String(item.data?.text ?? item.kind))));

      return h('div', { class: 'main-ui-view-world', style: rootStyle, 'data-world-dimension': String(props.dimension) }, [
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
        contentLayer,
      ]);
    };
  },
});
