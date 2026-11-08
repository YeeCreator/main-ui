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
  cameraRotation,
  createPointerGestureTracker,
  defaultBackendRegistry,
  defaultDpr,
  panBy,
  projectWorldAxes,
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
  altMouseGesture,
  pinchRotateDelta,
  rotateDeltaFromDrag,
  zoomFactorFromDrag,
  type CameraGestureIntent,
} from '@main-ui/core/input';
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
    /**
     * 是否启用双指旋转手势（“单指按住 + 另一指拖动”）。默认 false（相机模型已支持 rotation）。
     */
    rotateOnGesture: { type: Boolean, default: false },
    /**
     * 是否启用「Alt + 鼠标三键」视图操作体系。默认 `true`。
     *
     * | 组合 | 操作 |
     * | --- | --- |
     * | `Alt + 左键拖拽` | 旋转 |
     * | `Alt + 中键拖拽` | 平移 |
     * | `Alt + 右键拖拽` | 缩放 |
     *
     * **未按 Alt 时三键语义完全不变** —— 左键仍是选择、右键仍弹上下文菜单。
     * 按住 Alt 等于「临时进入视图操作模式」，松开即回到普通语义。
     *
     * 为什么是「修饰键 + 三键」而非「中键 + 三个修饰键」：三个鼠标键物理并排，
     * 左中右 ↔ 旋转/平移/缩放 是连续的空间映射，靠本体感觉即可操作，
     * 不必低头确认按对了哪个键。这是 DCC 类软件的通用范式。
     */
    altViewGestures: { type: Boolean, default: true },
    /**
     * 三维档的旋转模型。
     *
     * - `'turntable'`（缺省）：转盘。地平线永远水平、不累积 roll、有极点。
     *   等效于 Blender / Maya 的默认轨道旋转。
     * - `'trackball'`：虚拟轨迹球（使用者说的「棱角球」）。转轴垂直于拖拽方向，
     *   **轨迹转弯时整个坐标系跟着转**，无极点，但会累积 roll。
     *
     * 为什么缺省 turntable：trackball 会累积 roll，转久了画面会歪，需配合复位。
     * 它适合被显式选用，不适合作为无意识的默认值。
     */
    rotationModel: { type: String as PropType<'turntable' | 'trackball'>, default: 'turntable' },
    /**
     * 触控板双指扭转是否映射为 **roll 自转**（绕视线轴）。缺省 `true`。
     *
     * 详见 `alt-view-gestures.ts` 的两套操作体系说明。仅在三维档（有 `orbit` 能力的
     * 后端）生效；二维档下双指扭转仍走画面旋转（`Camera2D.rotation`）。
     */
    trackpadRoll: { type: Boolean, default: true },
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

    /**
     * 安全地捕获指针。
     *
     * `setPointerCapture` 在两类情形下会抛 `NotFoundError`：
     * ① 合成事件（测试注入）没有真实活跃指针；② 指针在调用前已释放。
     * 不拦会让 **整个 pointerdown 处理中断**，后续所有视图操作失效 ——
     * 表现为「按了没反应」，且控制台只有一条与视图操作看似无关的错误。
     */
    const capturePointer = (pointerId: number): void => {
      try {
        overlayRef.value?.setPointerCapture(pointerId);
      } catch {
        // 捕获失败不影响操作本身：只是拖出画布后会丢事件，不做兜底重定向。
      }
    };

    /**
     * 本次拖拽处于哪个视图操作模式（`Alt + 三键`）。
     *
     * 按下时判定一次、拖拽全程沿用：中途松开 Alt 不该把「旋转」突变
     * 成「选择」，否则一次操作会被切成两段。
     */
    let altMode: CameraGestureIntent = 'none';
    /** 上一次旋转的屏幕 X（`applyRotate` 是增量式，需记账）。 */
    let lastRotateX = 0;
    /**
     * 本次旋转的枢轴（**按下时锁定**，世界平面坐标）。
     *
     * 为什么锁定而不是每帧重算：`screenToWorld` 依赖相机姿态，旋转过程中姿态在变，
     * 每帧重算会让枢轴跟着漂 —— 表现为「转到一半中心跑掉了」。
     * Blender 也是按下定枢轴、拖拽绕它转。
     *
     * `null` 表示光标射线与地面平行、交点不存在（视线水平时的退化情形）。
     * 那时退回视口中心，并如实记录（不假装有枢轴）。
     */
    let rotateAnchorWorld: Vec2 | null = null;

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

      /**
       * 点击即取得键盘焦点。
       *
       * 没有这一步，宿主页面里「点一下视图再按 F」会没反应 ——
       * 键盘事件只在焦点位于视图内时才派发。用 `preventScroll` 避免
       * 移动端聚焦时把页面滚到视图顶部。
       */
      const overlay = overlayRef.value;
      if (overlay && typeof overlay.focus === 'function') {
        try {
          overlay.focus({ preventScroll: true });
        } catch {
          /* 某些环境不支持 options 参数；失败不影响交互 */
        }
      }

      if (gestureGuard.value) {
        // 抑制原生文本选区 / 图片拖拽（拖拽期间浏览器默认行为会抢焦点）。
        event.preventDefault();
      }

      // Alt + 三键：进入视图操作模式（旋转/平移/缩放）。
      // 判定只在按下时做一次，拖拽全程沿用 —— 中途松开 Alt 不该把一次旋转
      // 突变成选择操作。
      const altIntent: CameraGestureIntent = props.altViewGestures
        ? altMouseGesture({ button: event.button, altKey: event.altKey })
        : 'none';
      if (altIntent !== 'none') {
        altMode = altIntent;
        lastRotateX = event.clientX;
        drag.pointerId = event.pointerId;
        drag.active = true;
        drag.button = event.button;
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;
        /**
         * 旋转枢轴：**在按下时锁定光标下的地面点**（见 `rotateAnchorWorld` 的说明）。
         *
         * 只在旋转模式下取，且只在三维档（有 orbit 能力）下有意义 ——
         * 二维档的旋转始终绕视口中心（那是它唯一的合理解释）。
         */
        rotateAnchorWorld = null;
        if (altIntent === 'rotate' && backend.orbit) {
          const w = backend.screenToWorld(local);
          if (Number.isFinite(w.x) && Number.isFinite(w.y)) rotateAnchorWorld = { x: w.x, y: w.y };
        }
        // 捕获指针：拖出画布仍能收到 move/up，否则旋转到一半断掉。
        // 必须包 try：某些环境下（合成事件、指针已释放）会抛
        // `NotFoundError: No active pointer with the given id`，
        // 不拦会让整个 onPointerDown 中断，视图操作彻底失效。
        capturePointer(event.pointerId);
        return;
      }
      altMode = 'none';

      drag.pointerId = event.pointerId;
      drag.active = true;
      drag.button = event.button;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      gesture.down({ x: event.clientX, y: event.clientY });
      // 平移相机时捕获指针，保证拖出画布仍能收到 pointerup。
      // 本层没有 DOM 子元素，捕获导致的 click 重定向无副作用（宿主一律走 Emits）。
      if (props.panOnDrag && canStartDrag(event)) capturePointer(event.pointerId);
      if (props.rotateOnGesture && canStartDrag(event)) trackRotatePointer(event, local);

      const wp = worldPayload(local, event);
      if (wp) emit('world-pointerdown', wp);
      const cp = cellPayload(local);
      if (cp) emit('cell-pointerdown', { ...cp, button: wp?.button, modifiers: wp?.modifiers });
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!backend) return;

      // Alt 视图操作模式：旋转 / 平移 / 缩放，按按下时的判定分派。
      if (altMode !== 'none' && drag.pointerId === event.pointerId) {
        const dx = event.clientX - drag.lastX;
        const dy = event.clientY - drag.lastY;
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;
        const anchor = { x: event.clientX, y: event.clientY };

        if (altMode === 'rotate') {
          /**
           * 轨道档旋转：围绕**按下时光标下的地面点**转（不是视口中心）。
           *
           * 使用者 2026-11-08 的诉求「旋转中心点改为以光标映射的方向为旋转中心」，
           * 以及他同时提出的困惑「映射方向的距离多远才是旋转中心点」——
           * 这个困惑问到点子上了：**屏幕上的一个像素对应一条射线**，
           * 射线上有无穷多个点，所以「方向」本身定不出中心。
           *
           * 但只要视线不水平，**射线与地面平面（y = 0）的交点唯一确定**。
           * 故「旋转中心 = 光标下的地面点」在几何上成立，且与 Blender 的
           * 3D Cursor 是同一思想（后者把它显式化为一个可放置的「点」，
           * 从而连「视线水平」这种退化情形也能表达）。
           *
           * **中心在按下时锁定一次**（`rotateAnchorWorld`），而不是每帧重算：
           * - 每帧重算会让 center 随旋转漂移（`screenToWorld` 本身依赖相机姿态），
           *   表现为「转到一半中心跑了」；
           * - 锁定后手感与 Blender 一致：按下定枢轴，拖拽绕它转。
           */
          const orbitApi = backend.orbit;
          lastRotateX = event.clientX;
          if (orbitApi) {
            if (dx !== 0 || dy !== 0) {
              /**
               * 交给后端按自己的旋转模型分派 —— **传原始像素 + 枢轴**。
               *
               * 两处关键：
               *
               * 1. **传像素而非角度**。两种模型的原生单位不同：转盘按角度理解拖拽，
               *    轨迹球按「拖拽方向」定转轴（轴 = 屏幕法线 × 位移），像素才是它的
               *    原生单位。早期统一传角度、后端再折算回像素，两个灵敏度系数极易
               *    错配，导致「轨迹球方向与光标相反」。
               *
               * 2. **枢轴只传不改 target**。早期实现先把 target 挪到枢轴再旋转，
               *    那一步会让画面在按下瞬间跳一下（target 是视口中心对应的世界点）。
               *    现在后端做「绕枢轴旋转 + 补偿 target」的等价变换，枢轴点屏幕位置
               *    保持不变，其余点绕它转 —— 这才是「绕光标转」的观感。
               */
              if (orbitApi.rotateByPixels) {
                orbitApi.rotateByPixels(dx, dy, rotateAnchorWorld ?? undefined);
              } else {
                orbitApi.rotateBy(rotateDeltaFromDrag(dx), rotateDeltaFromDrag(dy, 0.006));
              }
            }
          } else if (dx !== 0) {
            // 无轨道能力（二维档）：退回画面旋转
            backend.setCamera(
              rotateAtScreenPoint(backend.getCamera(), { deltaAngle: rotateDeltaFromDrag(dx), anchorScreen: anchor }),
            );
          }
          return;
        }
        if (altMode === 'pan') {
          const orbitApi = backend.orbit;
          if (orbitApi) {
            /**
             * 轨道档平移：把「屏幕位移」换算成「地面位移」，直接问后端。
             *
             * **不要手推 `dx/scale`** —— 那套公式只对俯视成立。相机一倾斜，
             * 屏幕纵向位移对应的地面距离要再除以 `cos(polar)`。
             * 手推过一次就是这个漏项导致「平移比手指移动的少」。
             *
             * 换成「起止两点的世界坐标之差」，则天然包含极角、方位角、
             * 缩放的全部影响，且与 `screenToWorld` 永不失配。
             *
             * **符号必须是 `fromWorld - toWorld`，并且不再取反。**
             * 鼠标向右下拖时 `toWorld` 更大，差值本身已为负；把负值直接交给
             * `panBy`，target 向负方向移动 ⇒ 画面内容朝拖拽方向走（跟手）。
             * 若再取一次反（早期实现），画面会朝拖拽的**反方向**跑 ——
             * 2026-11-07 实机表现为「拖右下、盘面往左上逃」。
             */
            const size = backend.getHandle().getSize();
            const mid = { x: drag.lastX, y: drag.lastY };
            const fromWorld = backend.screenToWorld({ x: mid.x - dx, y: mid.y - dy });
            const toWorld = backend.screenToWorld(mid);
            void size;
            const wx = fromWorld.x - toWorld.x;
            const wy = fromWorld.y - toWorld.y;
            if (wx !== 0 || wy !== 0) orbitApi.panBy({ x: wx, y: wy });
          } else if (dx !== 0 || dy !== 0) {
            backend.setCamera(panBy(backend.getCamera(), { x: dx, y: dy }));
          }
          return;
        }
        if (altMode === 'zoom') {
          const factor = zoomFactorFromDrag(dy);
          const orbitApi = backend.orbit;
          if (orbitApi) {
            if (factor !== 1) {
              /**
               * 三维档：**以光标下的世界点为锤**缩放。
               *
               * 使用者 2026-11-08 的诉求「缩放中心点改为以光标映射的方向为中心点」。
               *
               * 锤点由后端 `screenToWorld` 给出（它已含极角/方位角/缩放的全部影响），
               * 本层**不自己反推 target 位移** —— 那样必然漏掉 `cos(polar)` 一类的项。
               */
              const anchorWorld = backend.screenToWorld({ x: event.clientX, y: event.clientY });
              if (orbitApi.zoomAt) orbitApi.zoomAt(factor, anchorWorld);
              else orbitApi.zoomBy(factor);
            }
          } else if (factor !== 1) {
            backend.setCamera(zoomAtScreenPoint(backend.getCamera(), { factor, anchorScreen: anchor }));
          }
          return;
        }
      }

      // 双指旋转优先（rotateOnGesture）：两指都存在时仅做旋转，不触发平移。
      if (props.rotateOnGesture && rotate.active && rotate.bId !== -1 && (event.pointerId === rotate.aId || event.pointerId === rotate.bId)) {
        const local = toLocal(event);
        if (local) {
          trackRotatePointer(event, local);
          const angle = Math.atan2(rotate.by - rotate.ay, rotate.bx - rotate.ax);
          const delta = pinchRotateDelta(rotate.lastAngle, angle);
          rotate.lastAngle = angle;
          if (delta !== 0) {
            const orbitApi = backend.orbit;
            /**
             * 三维档：双指扭转 → **roll 自转**（绕视线轴）。
             *
             * 为什么三维档不适合用它做「水平转动」：双指扭转是**绕屏幕法线**的转动，
             * 而水平转动是绕世界竖直轴 —— 相机一旦倾斜，两者就不再是同一回事，
             * 强行映射会让手感随着视角变化而漂移。
             * roll 恰好就是「绕屏幕法线」的自由度，语义严丝合缝。
             *
             * 这正是使用者 2026-11-08 提的对照：iPadOS 地图里把地球拉出来后，
             * 双指扭转就是让地球自转（roll）。
             */
            if (orbitApi?.rollBy && props.trackpadRoll) {
              orbitApi.rollBy(delta);
            } else {
              const anchor = { x: (rotate.ax + rotate.bx) / 2, y: (rotate.ay + rotate.by) / 2 };
              backend.setCamera(rotateAtScreenPoint(backend.getCamera(), { deltaAngle: delta, anchorScreen: anchor }));
            }
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

      // Alt 视图操作不产出点击语义：旋转/平移/缩放结束后不该顺带触发点选或菜单。
      if (altMode !== 'none') {
        altMode = 'none';
        drag.active = false;
        drag.pointerId = -1;
        return;
      }

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
      // Alt 视图操作中断：同样要清掉模式，否则下一次拖拽会沿用旧意图
      altMode = 'none';
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
        /**
         * 以锚点为中心缩放（锚点 = 光标下的世界点，锚点屏幕坐标保持不动）。
         *
         * 三维档走 `zoomAt`：它是唯一能同时处理「正交档改 viewHeight」与
         * 「锚点相对 target 的偏移」两件事的地方。模板在外反推 target 位移
         * 必然漏项（例如 `cos(polar)`）。
         */
        const factor = zoomFactorOf(reading, event.deltaY);
        const orbitApi = backend.orbit;
        if (orbitApi?.zoomAt) {
          if (factor !== 1) orbitApi.zoomAt(factor, backend.screenToWorld(local));
        } else {
          backend.setCamera(zoomAtScreenPoint(backend.getCamera(), { factor, anchorScreen: local }));
        }
      } else {
        const delta = wheelPanDelta(event);
        if (delta.x !== 0 || delta.y !== 0) backend.setCamera(panBy(backend.getCamera(), delta));
      }
    };

    /** 右键原生菜单：缺省（gestureGuard 开）在交互层内抑制，宿主无需再兜底。 */
    const onContextMenu = (event: MouseEvent): void => {
      // Alt + 右键是「缩放」，此时必须抑制原生菜单，否则一拖就弹菜单
      if (gestureGuard.value || (props.altViewGestures && event.altKey)) event.preventDefault();
    };

    /**
     * 视图键盘快捷键。
     *
     * | 键 | 操作 | 说明 |
     * | --- | --- | --- |
     * | `F` | 聚焦 | 保持视角，把世界框满画面（DCC 的 View Selected） |
     * | `Home` | 复位 | 朝向 / 平移 / 缩放全部回到默认 |
     *
     * ## 三条纪律
     *
     * 1. **只在焦点落于视图内时生效** —— 交互层带 `tabindex`，否则会抢走
     *    页面上输入框的按键（`F` 是很常见的打字字母）。
     * 2. **带修饰键一律放过** —— `Cmd+F` / `Ctrl+F` 是浏览器查找，不能劫持。
     * 3. **不 preventDefault 无关键** —— 只处理自己认的键，其余原样放行。
     */
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!props.interactive) return;
      // 带修饰键的组合交给浏览器 / 宿主（⌘F、Ctrl+F 是查找）
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const key = event.key;
      if (key === 'f' || key === 'F') {
        /**
         * F 聚焦。
         *
         * 现在还没有「选中」概念，故默认聚焦整个世界范围（`viewBox`）。
         * 将来接入选择后，宿主应在 `selection-change` 时把选中范围记下来，
         * 这里改为优先取选中范围。
         */
        event.preventDefault();
        backend?.orbit?.focusOn?.();
        return;
      }
      if (key === 'Home') {
        event.preventDefault();
        backend?.orbit?.resetView?.();
      }
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
      /** 三维档专属：绕视线轴自转（roll）。二维档为无副作用的空操作。 */
      roll: (angle: number) => backend?.orbit?.rollBy?.(angle),
      /** 三维档专属：清掉累积 roll，把地平线摆正（视线方向不变）。 */
      resetRoll: () => backend?.orbit?.resetRoll?.(),
      /** 三维档专属：切换旋转模型（转盘 / 轨迹球）。 */
      setRotationModel: (model: 'turntable' | 'trackball') => backend?.orbit?.setRotationModel?.(model),
      /** 三维档专属：世界三轴在屏幕平面的投影（供缩略导航画 gizmo）。 */
      getOrbitAxes: () => {
        const orbit = backend?.orbit?.getOrbit();
        return orbit ? projectWorldAxes(orbit) : null;
      },
      /** 三维档专属：完整复位（朝向 / 平移 / 缩放全部回到默认）。 */
      resetView: () => backend?.orbit?.resetView?.(),
      /** 三维档专属：聚焦到世界范围（只改平移与缩放，保留朝向）。 */
      focusOn: (world?: ViewBox) => backend?.orbit?.focusOn?.(world),
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
      /**
       * 旋转模型必须在喂快照/相機之前同步：三维后端按它分派 `rotateBy`，
       * 若等用户第一次拖拽才设置，首次旋转会按错误模型算。
       */
      next.orbit?.setRotationModel?.(props.rotationModel);
      next.applySnapshot({ snapshot: props.snapshot, grid: props.grid });

      // 后端挂载时用的容器尺寸可能与真实尺寸不符（三维档尤其如此：
      // 它没有 Pixi 那种自动跟随容器的机制）。必须显式对齐一次再 fit，
      // 否则视锥按错的尺寸算，画面会被裁切或放大。
      const host = contentRendererRef.value;
      if (host && host.clientWidth > 0 && host.clientHeight > 0) {
        next.resize(host.clientWidth, host.clientHeight);
        next.fitToBounds(resolvedViewBox.value);
      }

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
     * 同步容器尺寸给**内容层**与**后端**。
     *
     * 内容层用容器尺寸做投影与裁剪，必须与实际渲染面积一致；否则裁剪边界会偏移，
     * 表现为「视野内的内容不显示」。
     *
     * **后端也必须收到 `resize`**：二维档（Pixi）自带 `resizeTo` 会自动跟随容器，
     * 掩盖了这个缺口；三维档没有该机制 —— 不显式通知，它的 `size` 永远停在
     * 挂载时的初始值，视锥随之算错，表现为「三维画面只显示左上角且放大约 2 倍」
     * （初始 1×1 或旧尺寸被 dpr 放大后与真实容器不匹配）。
     */
    const syncContentSize = (): void => {
      const el = contentRendererRef.value;
      if (!el) return;
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width > 0 && height > 0) {
        // 后端尺寸：每次尺寸变化都要通知，三维档靠它算视锥
        backend?.resize(width, height);
      }
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

    watch(() => props.rotationModel, (model) => {
      backend?.orbit?.setRotationModel?.(model);
    });

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
      /**
       * 键盘焦点环：只在 `:focus-visible`（键盘导航）时显示。
       *
       * 鼠标点击也会让视图获得焦点（为了接收 F / Home），但那时不该画焦点环
       * —— 否则每次点一下画面就多一个蓝框。`outline: none` 配合
       * `focus-visible` 的 CSS 规则由宿主主题决定，这里只清掉默认轮廓。
       */
      outline: 'none',
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
          /**
           * `tabindex="0"`：让视图能接收键盘事件。
           *
           * 键盘快捷键（F 聚焦 / Home 复位）是**视图自身的操作**，不该由每个宿主
           * 各绑一遍 —— 那样「同一手势在不同宿主行为不同」的故障会重演。
           * 但键盘事件只在**焦点落在视图内**时才该生效，否则会抢走输入框的按键，
           * 所以必须配合 `tabindex` + `:focus-visible` 的可见焦点环。
           */
          tabindex: '0',
          onPointerdown: onPointerDown,
          onPointermove: onPointerMove,
          onPointerup: onPointerUp,
          onPointercancel: onPointerCancel,
          onWheel: onWheel,
          onContextmenu: onContextMenu,
          onKeydown: onKeyDown,
        }),
        contentLayer,
      ]);
    };
  },
});
