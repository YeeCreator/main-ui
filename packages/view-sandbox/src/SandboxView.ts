import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type CSSProperties, type PropType, type VNode } from 'vue';
import { useViewLifecycle } from 'main-ui/vue';
import type { MainUiViewLifecycle } from 'main-ui/core';
import { cameraToCssTransform, panBy, screenToWorld, zoomAtScreenPoint } from '@main-ui/core/rendering';
import { readWheel, isTypingTarget, wheelPanDelta, zoomFactorOf } from '@main-ui/core/input';
import { createSandboxKernel, type SandboxKernelInstance } from './sandbox-kernel';
import type {
  SandboxCamera,
  SandboxConnection,
  SandboxDocument,
  SandboxElement,
  SandboxMoveElementIntent,
  SandboxRemoveElementIntent,
  SandboxViewState,
  SandboxAddElementIntent,
  SandboxConnectIntent,
  SandboxSelectionIntent,
} from './types';
import { DEFAULT_SANDBOX_CAMERA } from './types';

/** 相机缩放上下限（防止缩到不可见或无限放大）。 */
const MIN_SCALE = 0.05;
const MAX_SCALE = 8;

/** 元素最小尺寸（世界单位）：防止缩放到不可见后无法再选中。 */
const MIN_ELEMENT_SIZE = 8;

/** 连线端口半径（屏幕像素，渲染用）。 */
const PORT_RADIUS = 5;

/**
 * SandboxView —— L3 旗舰复合视图（实现 MainUiViewLifecycle 四成员契约）。
 *
 * 整合 shape / image / embed-view 异构元素 + 连线，
 * 嵌入子 View 一律经 EmbeddedViewHost 托管。
 */
export const SandboxView = defineComponent({
  name: 'SandboxView',
  props: {
    document: { type: Object as PropType<SandboxDocument>, required: true },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    editable: { type: Boolean, default: true },
    maxNestingDepth: { type: Number, default: 8 },
    editorInstanceId: { type: String, default: null },
  },
  emits: [
    'element-move-intent', 'element-remove-intent', 'element-add-intent',
    'connect-intent', 'selection',
    /** 进入内联编辑（供宿主接管为富文本编辑器或公式编辑器）。 */
    'element-edit-intent',
    /** 请求打开另一个内容（白板互链）。**跳转由宿主执行**，MUI 只抛意图。 */
    'open-ref-intent',
  ],
  setup(props, { emit, slots }) {
    const kernel = ref<SandboxKernelInstance | null>(null);
    const selectedIds = ref<string[]>([]);
    const cameraState = ref<SandboxCamera>(DEFAULT_SANDBOX_CAMERA);
    let destroyed = false;

    // 初始化内核
    onMounted(() => {
      const k = createSandboxKernel(props.document, undefined, { maxNestingDepth: props.maxNestingDepth });
      k.onChange((event) => {
        if (event.type === 'camera' || event.type === 'full') {
          cameraState.value = k.camera;
        }
        // 文档变更后刷新文档引用，触发重新渲染
        if (event.type !== 'camera') {
          docVersion.value += 1;
        }
      });
      kernel.value = k;
      window.addEventListener('keydown', onKeyDown);
    });

    // 文档变更同步
    watch(() => props.document, (newDoc) => {
      kernel.value?.fromJSON({ document: newDoc });
    }, { deep: true });

    // ---------- 视图生命周期契约 ----------
    const lifecycle: MainUiViewLifecycle = {
      viewType: 'view-sandbox',
      getViewState: (): SandboxViewState => {
        // F-3 fix：cameraState.value 是 Vue 响应式 Proxy，structuredClone 会抛 DataCloneError；
        // 用 {...} 展开为普通对象，规避内核 captureViewStates → cloneDocument 崩溃。
        const cam = cameraState.value;
        return {
          // 纯值复制：内核会把快照喂给 structuredClone，绝不能带响应式 Proxy。
          camera: { scale: cam.scale, pan: { x: cam.pan.x, y: cam.pan.y } },
          selectedElementIds: [...selectedIds.value],
          embeddedRefs: kernel.value?.document.elements
            .filter((e) => e.type === 'embed-view')
            .map((e) => e.id) ?? [],
        };
      },
      restoreViewState: (state) => {
        if (destroyed) return;
        const snapshot = state as Partial<SandboxViewState>;
        if (snapshot.camera) kernel.value?.setCamera(snapshot.camera);
        if (Array.isArray(snapshot.selectedElementIds)) selectedIds.value = snapshot.selectedElementIds;
      },
      onDestroy: () => {
        destroyed = true;
        kernel.value?.destroy();
        kernel.value = null;
      },
    };
    if (props.editorInstanceId) {
      useViewLifecycle(props.editorInstanceId, () => lifecycle);
    }

    onBeforeUnmount(() => {
      // 键盘监听挂在 window 上，必须显式移除 —— 否则多个白板实例叠加时
      // 一次撤销会触发 N 次（每个残留监听各算一遍）。
      window.removeEventListener('keydown', onKeyDown);
      kernel.value?.destroy();
      kernel.value = null;
    });

    // ---------- 交互 ----------
    const rootRef = ref<HTMLElement | null>(null);
    const panState = { pointerId: -1, lastX: 0, lastY: 0, active: false };

    /**
     * 文档版本号。
     *
     * 内核的 `document` 是 getter（每次返回新对象），不是 Vue 响应式源；
     * 没有这个计数器时，内核内部变更（拖拽/撤销）不会触发重渲染 ——
     * 表现为「数据变了画面不动」，正是本项目反复出现的失败形态。
     */
    const docVersion = ref(0);

    /** 屏幕坐标（相对容器左上角）。 */
    const toLocal = (clientX: number, clientY: number): { x: number; y: number } | null => {
      const el = rootRef.value;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    /** 约束缩放区间（相机其余字段原样保留）。 */
    const constrain = (camera: SandboxCamera): SandboxCamera => ({
      scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, camera.scale)),
      pan: { x: camera.pan.x, y: camera.pan.y },
      ...(camera.rotation === undefined ? {} : { rotation: camera.rotation }),
    });

    const applyCamera = (next: SandboxCamera): void => {
      kernel.value?.setCamera(constrain(next));
    };

    /** 空白处左键拖拽平移（元素自身的 mousedown 会 stopPropagation）。 */
    const onRootPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      panState.pointerId = event.pointerId;
      panState.lastX = event.clientX;
      panState.lastY = event.clientY;
      panState.active = true;
      rootRef.value?.setPointerCapture?.(event.pointerId);
    };

    const onElementMouseDown = (elementId: string, event: MouseEvent) => {
      // 元素上的按下不得冒泡成画布平移。
      event.stopPropagation();
      if (!props.editable) return;
      if (event.shiftKey) {
        // Shift 点选：切换该元素的选中状态（多选）
        const set = new Set(selectedIds.value);
        if (set.has(elementId)) set.delete(elementId);
        else set.add(elementId);
        selectedIds.value = [...set];
      } else {
        selectedIds.value = [elementId];
      }
      emit('selection', { elementIds: [...selectedIds.value] } satisfies SandboxSelectionIntent);
    };

    // ---------- 元素拖拽 / 缩放 / 旋转（消费内核能力） ----------
    /**
     * 元素变换的设备状态。
     *
     * 三种手势共用一个结构：`kind` 决定走内核的哪个方法。
     * 指针坐标换算**必须经相机**（`screenToWorld`），否则在高缩放下
     * 位移会被放大 `1/scale` 倍（本库已踩过一次）。
     */
    const transform = {
      active: false,
      kind: '' as '' | 'move' | 'resize' | 'rotate',
      elementId: '',
      pointerId: -1,
      startWorld: { x: 0, y: 0 },
      origin: { x: 0, y: 0, width: 0, height: 0, rotation: 0 },
    };

    /** 取元素当前快照（避免闭包读到过期值）。 */
    const findElement = (id: string): SandboxElement | undefined =>
      kernel.value?.document.elements.find((e) => e.id === id);

    /**
     * 开始元素变换。
     *
     * @param kind 变换种类。
     * @param elementId 目标元素。
     * @param event 触发事件（用于取屏幕坐标）。
     */
    const startTransform = (kind: 'move' | 'resize' | 'rotate', elementId: string, event: PointerEvent): void => {
      const el = findElement(elementId);
      const local = toLocal(event.clientX, event.clientY);
      if (!el || !local) return;
      transform.active = true;
      transform.kind = kind;
      transform.elementId = elementId;
      transform.pointerId = event.pointerId;
      transform.startWorld = screenToWorld(cameraState.value, local);
      transform.origin = {
        x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation,
      };
      rootRef.value?.setPointerCapture?.(event.pointerId);
    };

    /** 拖拽移动：增量按世界坐标算，再用内核写回。 */
    const onElementPointerDown = (elementId: string, event: PointerEvent): void => {
      event.stopPropagation();
      if (!props.editable) return;
      onElementMouseDown(elementId, event as unknown as MouseEvent);
      startTransform('move', elementId, event);
    };

    /** 缩放柄：右下角对齐起点，向右下拖放大。 */
    const onResizeHandleDown = (elementId: string, event: PointerEvent): void => {
      event.stopPropagation();
      if (!props.editable) return;
      startTransform('resize', elementId, event);
    };

    /** 旋转柄：按相对元素中心的角度差旋转。 */
    const onRotateHandleDown = (elementId: string, event: PointerEvent): void => {
      event.stopPropagation();
      if (!props.editable) return;
      startTransform('rotate', elementId, event);
    };

    const onRootPointerMove = (event: PointerEvent): void => {
      // 连线拖拽：更新临时终点（世界坐标）
      if (linkDrag.active && linkDrag.pointerId === event.pointerId) {
        const local = toLocal(event.clientX, event.clientY);
        if (!local) return;
        linkDrag.toWorld = screenToWorld(cameraState.value, local);
        return;
      }

      // 元素变换优先于画布平移
      if (transform.active && transform.pointerId === event.pointerId) {
        const local = toLocal(event.clientX, event.clientY);
        if (!local) return;
        const now = screenToWorld(cameraState.value, local);
        const dx = now.x - transform.startWorld.x;
        const dy = now.y - transform.startWorld.y;
        const k = kernel.value;
        if (!k) return;

        if (transform.kind === 'move') {
          k.moveElement(transform.elementId, transform.origin.x + dx, transform.origin.y + dy);
        } else if (transform.kind === 'resize') {
          k.resizeElement(
            transform.elementId,
            Math.max(MIN_ELEMENT_SIZE, transform.origin.width + dx),
            Math.max(MIN_ELEMENT_SIZE, transform.origin.height + dy),
          );
        } else if (transform.kind === 'rotate') {
          // 角度差：以元素中心为原点
          const cx = transform.origin.x + transform.origin.width / 2;
          const cy = transform.origin.y + transform.origin.height / 2;
          const startAngle = Math.atan2(transform.startWorld.y - cy, transform.startWorld.x - cx);
          const nowAngle = Math.atan2(now.y - cy, now.x - cx);
          const delta = (nowAngle - startAngle) * 180 / Math.PI;
          k.rotateElement(transform.elementId, normalizeDegrees(transform.origin.rotation + delta));
        }
        return;
      }

      if (!panState.active || panState.pointerId !== event.pointerId) return;
      const dx = event.clientX - panState.lastX;
      const dy = event.clientY - panState.lastY;
      panState.lastX = event.clientX;
      panState.lastY = event.clientY;
      applyCamera(panBy(cameraState.value, { x: dx, y: dy }));
    };

    /** 把角度归一化到 [0, 360)，避免长期旋转累积出巨大数值。 */
    const normalizeDegrees = (deg: number): number => ((deg % 360) + 360) % 360;

    const endPan = (event: PointerEvent): void => {
      // 连线拖拽结束：命中到另一个元素则建连，否则放弃。
      if (linkDrag.active && linkDrag.pointerId === event.pointerId) {
        linkDrag.active = false;
        const target = hitElementAt(linkDrag.toWorld);
        if (target && target.id !== linkDrag.fromId) {
          kernel.value?.addConnection({
            id: `conn-${linkDrag.fromId}-${target.id}-${Date.now()}`,
            source: { elementId: linkDrag.fromId },
            target: { elementId: target.id },
          });
          emit('connect-intent', {
            source: { elementId: linkDrag.fromId },
            target: { elementId: target.id },
          } satisfies SandboxConnectIntent);
        }
        linkDrag.fromId = '';
        linkDrag.pointerId = -1;
        rootRef.value?.releasePointerCapture?.(event.pointerId);
        return;
      }

      if (transform.active && transform.pointerId === event.pointerId) {
        transform.active = false;
        transform.kind = '';
        transform.elementId = '';
        transform.pointerId = -1;
        rootRef.value?.releasePointerCapture?.(event.pointerId);
        return;
      }
      if (panState.pointerId !== event.pointerId) return;
      rootRef.value?.releasePointerCapture?.(event.pointerId);
      panState.pointerId = -1;
      panState.active = false;
    };

    /**
     * 命中测试：给定世界坐标，返回该点下最上层元素。
     *
     * 用**世界坐标**判定，不依赖 DOM 命中 —— 元素可能被旋转，
     * DOM 命中框与视觉不符；世界坐标判定是唯一稳定口径。
     */
    const hitElementAt = (world: { x: number; y: number }): SandboxElement | undefined => {
      const els = kernel.value?.document.elements ?? [];
      // 后加入的在上层，倒序命中
      for (let i = els.length - 1; i >= 0; i -= 1) {
        const el = els[i];
        if (world.x >= el.x && world.x <= el.x + el.width && world.y >= el.y && world.y <= el.y + el.height) {
          return el;
        }
      }
      return undefined;
    };

    /** 滚轮：判型与灵敏度全部取自 core/input，不在此重算系数。 */
    const onRootWheel = (event: WheelEvent): void => {
      const anchor = toLocal(event.clientX, event.clientY);
      if (!anchor) return;
      event.preventDefault();
      const query = {
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        shiftKey: event.shiftKey,
      };
      const reading = readWheel(query);
      if (reading.intent === 'pan') {
        applyCamera(panBy(cameraState.value, wheelPanDelta(query)));
        return;
      }
      applyCamera(zoomAtScreenPoint(cameraState.value, {
        factor: zoomFactorOf(reading, event.deltaY),
        anchorScreen: anchor,
      }));
    };

    // ---------- 连线（拖端口建连） ----------
    /**
     * 连线中的临时状态。
     *
     * 连线是**世界坐标**画出来的：起点取元素的端口世界坐标，
     * 终点取指针的世界坐标。避免屏幕坐标直算 —— 相机一动就连错位
     * （旧实现正是直算屏幕坐标，本轮一并修正）。
     */
    const linkDrag = { active: false, fromId: '', toWorld: { x: 0, y: 0 }, pointerId: -1 };

    const onPortPointerDown = (elementId: string, event: PointerEvent): void => {
      event.stopPropagation();
      if (!props.editable) return;
      const local = toLocal(event.clientX, event.clientY);
      if (!local) return;
      linkDrag.active = true;
      linkDrag.fromId = elementId;
      linkDrag.pointerId = event.pointerId;
      linkDrag.toWorld = screenToWorld(cameraState.value, local);
      rootRef.value?.setPointerCapture?.(event.pointerId);
    };

    /** 端口世界坐标：元素右侧中点（单一端口，足够表达连接意图）。 */
    const portWorld = (el: SandboxElement): { x: number; y: number } => ({
      x: el.x + el.width,
      y: el.y + el.height / 2,
    });

    // ---------- 内联文本编辑 ----------
    /**
     * 正在编辑的元素 id。
     *
     * 编辑态用**覆盖的输入框**而不是 `contentEditable` 就地改：
     * 后者在相机缩放下会出现光标位置与命中不一致，且难以控制提交时机。
     */
    const editingId = ref<string>('');
    const editingDraft = ref<string>('');

    /** 进入编辑态（仅 text / formula 支持原地编辑）。 */
    const beginEdit = (el: SandboxElement): void => {
      if (!props.editable) return;
      if (el.type === 'text') {
        editingId.value = el.id;
        editingDraft.value = el.text?.content ?? '';
      } else if (el.type === 'formula') {
        editingId.value = el.id;
        editingDraft.value = el.formula?.latex ?? '';
      } else {
        return;
      }
      emit('element-edit-intent', { elementId: el.id, kind: el.type });
    };

    /** 提交编辑：写回内核（走 updateElementContent）。 */
    const commitEdit = (): void => {
      const id = editingId.value;
      if (!id) return;
      const el = findElement(id);
      if (el) {
        if (el.type === 'text') kernel.value?.updateElementContent(id, { text: { ...el.text, content: editingDraft.value } });
        if (el.type === 'formula') kernel.value?.updateElementContent(id, { formula: { ...el.formula, latex: editingDraft.value } });
      }
      editingId.value = '';
      editingDraft.value = '';
    };

    /** 取消编辑（Esc）。 */
    const cancelEdit = (): void => {
      editingId.value = '';
      editingDraft.value = '';
    };

    /**
     * 渲染元素内容。
     *
     * 按类型分派（design-main-ui §二十一 7 的三档）：
     * - 原生轻内容（shape / text / formula / link）：模板直接渲染
     * - 资源（image）：占位（真实图片由宿主经 provider 注入）
     * - 嵌入视图（embed-view）：**交给宿主插槽渲染真实子视图**
     *
     * 最后一档是本轮修的重点：此前只画 `[viewType]` 文字占位，
     * `EmbeddedViewHost` 登记了却无人消费 —— 与「相机只写不读」同源。
     */
    const renderElementBody = (el: SandboxElement, selected: boolean): VNode | VNode[] => {
      const parts: VNode[] = [];

      switch (el.type) {
        case 'text': {
          parts.push(h('div', {
            class: 'main-ui-view-sandbox__text',
            style: {
              width: '100%', padding: '4px',
              fontSize: `${el.text?.fontSize ?? 12}px`,
              color: el.text?.color ?? 'inherit',
              textAlign: el.text?.align ?? 'left',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              pointerEvents: 'none',
            },
          }, el.text?.content ?? ''));
          break;
        }
        case 'formula': {
          // 公式**只存 LaTeX 源**，渲染交给宿主（KaTeX 在宿主侧）。
          // 这里给出可读的源串占位，避免无插槽时空白。
          parts.push(h('div', {
            class: 'main-ui-view-sandbox__formula',
            style: { width: '100%', padding: '4px', textAlign: 'center', fontFamily: 'monospace', fontSize: '11px', pointerEvents: 'none' },
          }, el.formula?.latex ?? ''));
          break;
        }
        case 'link': {
          parts.push(h('a', {
            class: 'main-ui-view-sandbox__link',
            href: '#',
            style: { padding: '4px', color: 'var(--mui-color-accent)', textDecoration: 'underline', cursor: 'pointer' },
            onPointerdown: (event: PointerEvent) => event.stopPropagation(),
            onClick: (event: MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              // **跳转由宿主执行**：MUI 只抛意图，不碰文件系统。
              emit('open-ref-intent', {
                elementId: el.id,
                refId: el.link?.refId ?? '',
                relation: el.link?.relation ?? 'link',
              });
            },
          }, el.link?.label ?? el.link?.refId ?? 'link'));
          break;
        }
        case 'image': {
          parts.push(h('div', { style: { fontSize: '10px', color: 'var(--mui-color-text-muted)' } }, el.image?.alt ?? 'image'));
          break;
        }
        case 'embed-view': {
          // 真实子视图由宿主插槽渲染；无插槽时降级为占位（不静默空白）。
          const embedded = slots['embed-view']?.({
            elementId: el.id,
            viewType: el.embedViewRef?.viewType ?? '',
            payload: el.embedViewRef?.payload,
            width: el.width,
            height: el.height,
          });
          parts.push(h('div', {
            class: 'main-ui-view-sandbox__embed',
            style: { width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'auto' },
            onPointerdown: (event: PointerEvent) => event.stopPropagation(),
          }, embedded ?? [
            h('div', { style: { fontSize: '10px', color: 'var(--mui-color-text-muted)', textAlign: 'center', padding: '4px' } },
              `[${el.embedViewRef?.viewType ?? 'embed'}]`),
          ]));
          break;
        }
        default: {
          parts.push(h('span', { style: { pointerEvents: 'none' } }, el.shape?.label ?? el.id));
        }
      }

      if (selected && props.editable) {
        // 缩放柄（右下角）
        parts.push(h('div', {
          class: 'main-ui-view-sandbox__handle main-ui-view-sandbox__handle--resize',
          style: {
            position: 'absolute', right: '-5px', bottom: '-5px',
            width: '10px', height: '10px',
            background: 'var(--mui-color-accent)',
            border: '1px solid var(--mui-color-panel)',
            borderRadius: '2px', cursor: 'nwse-resize',
          },
          onPointerdown: (event: PointerEvent) => onResizeHandleDown(el.id, event),
        }));
        // 旋转柄（顶部中点）
        parts.push(h('div', {
          class: 'main-ui-view-sandbox__handle main-ui-view-sandbox__handle--rotate',
          style: {
            position: 'absolute', left: '50%', top: '-22px',
            width: '10px', height: '10px', marginLeft: '-5px',
            background: 'var(--mui-color-panel)',
            border: '2px solid var(--mui-color-accent)',
            borderRadius: '50%', cursor: 'grab',
          },
          onPointerdown: (event: PointerEvent) => onRotateHandleDown(el.id, event),
        }));
        // 连线端口（右侧中点）
        parts.push(h('div', {
          class: 'main-ui-view-sandbox__port',
          style: {
            position: 'absolute', right: `${-PORT_RADIUS}px`, top: '50%',
            width: `${PORT_RADIUS * 2}px`, height: `${PORT_RADIUS * 2}px`,
            marginTop: `${-PORT_RADIUS}px`,
            background: 'var(--mui-color-accent)',
            borderRadius: '50%', cursor: 'crosshair',
          },
          onPointerdown: (event: PointerEvent) => onPortPointerDown(el.id, event),
        }));
      }

      return parts;
    };

    /**
     * 键盘快捷键。
     *
     * - `Ctrl/Cmd + Z` 撤销、`Ctrl/Cmd + Shift + Z` 或 `Ctrl/Cmd + Y` 重做
     * - `Delete` / `Backspace` 删除选中元素
     *
     * 焦点在输入控件内时全部跳过 —— 否则在公式/文本编辑时按退格会删掉整个元素。
     */
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return;
      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) kernel.value?.redo();
        else kernel.value?.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        kernel.value?.redo();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIds.value.length > 0) {
        event.preventDefault();
        removeSelected();
      }
    };

    /** 删除选中元素（走内核，可撤销）。 */
    const removeSelected = (): void => {
      if (selectedIds.value.length === 0) return;
      // 先抛意图让宿主决定是否真的删（宿主可能要写审计/回收站）
      emit('element-remove-intent', { elementIds: [...selectedIds.value] } satisfies SandboxRemoveElementIntent);
      kernel.value?.removeElements(selectedIds.value);
      selectedIds.value = [];
    };

    // ---------- 渲染 ----------
    const rootStyle: CSSProperties = {
      width: '100%', height: '100%', overflow: 'hidden', position: 'relative',
      background: 'var(--mui-color-panel)', color: 'var(--mui-color-text)',
      touchAction: 'none',
    };

    /**
     * 世界层样式：**唯一一次相机变换**。
     *
     * 必须用 `cameraToCssTransform`（带 `px`）而非手工拼串 —— 无单位串在
     * CSS 里是非法值，浏览器会静默丢弃整条声明。
     */
    const worldStyle = computed<CSSProperties>(() => ({
      position: 'absolute', top: 0, left: 0,
      transformOrigin: '0 0',
      transform: cameraToCssTransform(cameraState.value),
    }));

    const elementStyle = (el: SandboxElement): CSSProperties => ({
      position: 'absolute',
      left: `${el.x}px`, top: `${el.y}px`,
      width: `${el.width}px`, height: `${el.height}px`,
      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
      border: '1px solid var(--mui-color-border)',
      borderRadius: 'var(--mui-radius)',
      background: el.shape?.fill ?? 'var(--mui-color-panel-raised, var(--mui-color-panel))',
      cursor: props.editable ? 'move' : 'default',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px',
    });

    return () => {
      if (props.loading) {
        return h('div', { class: 'main-ui-view-sandbox', style: { ...rootStyle, display: 'grid', placeItems: 'center' } }, 'Loading…');
      }
      if (props.error) {
        return h('div', { class: 'main-ui-view-sandbox', style: { ...rootStyle, display: 'grid', placeItems: 'center', color: 'var(--mui-color-danger)' } }, props.error);
      }

      // 读一次版本号：内核的 document 是普通 getter（非响应式），
      // 不显式依赖本计数器时，拖拽/撤销引起的内部变更不会触发重渲染。
      void docVersion.value;
      const elements = kernel.value?.document.elements ?? props.document.elements;
      const connections = kernel.value?.document.connections ?? props.document.connections;

      /**
       * 世界层内容：元素**按世界坐标**绝对定位，相机变换由**外层唯一一次**施加。
       *
       * 连线放在世界层内的 SVG 里，其 `viewBox` 用世界范围 —— 与元素同一坐标系，
       * 因此连线不需要单独换算屏幕坐标（旧实现直算屏幕坐标，相机一动就错位）。
       */
      const worldContent = h('div', { class: 'main-ui-view-sandbox__world', style: worldStyle.value }, [
        h('svg', {
          style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' },
        }, connections.map((conn) => {
          const src = elements.find((e) => e.id === conn.source.elementId);
          const tgt = elements.find((e) => e.id === conn.target.elementId);
          if (!src || !tgt) return null;
          return h('line', {
            key: conn.id,
            x1: src.x + src.width / 2, y1: src.y + src.height / 2,
            x2: tgt.x + tgt.width / 2, y2: tgt.y + tgt.height / 2,
            stroke: conn.style?.stroke ?? 'var(--mui-color-border)',
            'stroke-width': 1.5,
            'stroke-dasharray': conn.style?.dash ? '4 4' : undefined,
          });
        })),
        ...elements.map((el) => {
          const selected = selectedIds.value.includes(el.id);
          return h('div', {
            key: el.id,
            class: ['main-ui-view-sandbox__element', selected ? 'is-selected' : ''],
            style: {
              ...elementStyle(el),
              borderColor: selected ? 'var(--mui-color-accent)' : undefined,
              boxShadow: selected ? '0 0 0 1px var(--mui-color-accent)' : undefined,
            },
            onPointerdown: (event: PointerEvent) => onElementPointerDown(el.id, event),
            onDblclick: () => beginEdit(el),
          }, renderElementBody(el, selected));
        }),
        // 连线中的临时连线（世界坐标）
        linkDrag.active && (() => {
          const from = elements.find((e) => e.id === linkDrag.fromId);
          if (!from) return null;
          const p = portWorld(from);
          return h('line', {
            class: 'main-ui-view-sandbox__link-draft',
            x1: p.x, y1: p.y, x2: linkDrag.toWorld.x, y2: linkDrag.toWorld.y,
            stroke: 'var(--mui-color-accent)',
            'stroke-width': 1.5,
            'stroke-dasharray': '6 4',
          });
        })(),
        // 内联编辑框（世界坐标，随相机缩放）
        editingId.value && (() => {
          const el = elements.find((e) => e.id === editingId.value);
          if (!el) return null;
          return h('textarea', {
            class: 'main-ui-view-sandbox__inline-editor',
            value: editingDraft.value,
            style: {
              position: 'absolute',
              left: `${el.x}px`, top: `${el.y}px`,
              width: `${Math.max(el.width, 160)}px`,
              height: `${Math.max(el.height, 72)}px`,
              fontSize: '12px', fontFamily: 'monospace',
              border: '2px solid var(--mui-color-accent)',
              borderRadius: 'var(--mui-radius)',
              background: 'var(--mui-color-panel)',
              color: 'var(--mui-color-text)',
              padding: '4px', boxSizing: 'border-box',
              resize: 'none', zIndex: '10',
            },
            onInput: (event: Event) => { editingDraft.value = (event.target as HTMLTextAreaElement).value; },
            onBlur: () => commitEdit(),
            onKeydown: (event: KeyboardEvent) => {
              if (event.key === 'Escape') { event.preventDefault(); cancelEdit(); }
              // Ctrl/Cmd + Enter 提交（普通 Enter 允许换行）
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); commitEdit(); }
            },
          });
        })(),
      ]);

      return h('div', {
        ref: rootRef,
        class: 'main-ui-view-sandbox',
        style: rootStyle,
        onPointerdown: onRootPointerDown,
        onPointermove: onRootPointerMove,
        onPointerup: endPan,
        onPointercancel: endPan,
        onWheel: onRootWheel,
      }, [worldContent]);
    };
  },
});
