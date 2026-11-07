import {
  defineComponent,
  h,
  computed,
  type PropType,
  type VNode,
} from 'vue';
import {
  contentWorldBounds,
  minimapTransform,
  minimapViewportRect,
  panToMinimapPoint,
  type MinimapSize,
  type MinimapTransform,
  type Vec2,
  type WorldRect,
} from '@main-ui/core/rendering';
import type { MinimapCompass, MinimapItem, MinimapItemKind, MinimapShape, MinimapViewportFrame } from './types';

/**
 * 实例级序号：`clipPath` 的 id 必须在整页唯一。
 *
 * 同一页可能同时存在多个缩略图（对比布局、多窗格），写死 id 会让它们
 * 共用第一个实例的裁切区域。
 */
let clipSeq = 0;

/**
 * Minimap —— 缩略导航视图（游戏小地图 / 画布缩略图共用）。
 *
 * ## 不重绘场景
 *
 * 组件**不复制**原场景：不复用 GPU 后端、不复制 DOM 节点，只按简化画法
 * 画少量图元。主流画布软件的缩略图同样如此 —— 把文字与节点缩小重画一遍
 * 会带来双份显存与双份 DOM，是白板类应用最常见的性能事故形态。
 *
 * ## 内容与视口
 *
 * - 内容由 `items` 给入（世界坐标），组件按 `kind` 画点 / 框 / 折线。
 * - 视口矩形由 `viewport` 给入（世界坐标）；缺省时若给了 `camera` 与容器尺寸，
 *   则由相机反算。
 * - 两者都参与「内容范围」，故视口移出内容区时仍能在缩略图内被看到。
 *
 * ## 交互
 *
 * - `pan-on-click`（默认 true）：点击缩略图任意点，抛出 `navigate` 事件，
 *   载荷为**该点应落到视口中心所需的 `pan`**（配合原 `scale` 即为新相机）。
 *   `pan` 的符号方向极易写反，故由 core 的纯函数算好，组件不重复推公式。
 * - 拖动仅抛出 `navigate`，不自行改相机 —— 相机归宿主所有（单一真相源）。
 */
export const Minimap = defineComponent({
  name: 'Minimap',
  props: {
    /** 内容项（世界坐标）。 */
    items: { type: Array as PropType<readonly MinimapItem[]>, default: () => [] },
    /**
     * 世界的固定范围（世界坐标）。
     *
     * **强烈建议提供**：不给时范围退化为「内容包围盒 ∪ 视口矩形」，
     * 而在内容为空（开局无实体、画布无单元）的场合，范围会完全由视口决定 ——
     * 视口框恒等于整块小图，缩放平移时看起来「框不动」。
     * 世界范围是世界的固有边界，不该随相机变化。
     */
    world: { type: Object as PropType<WorldRect | null>, default: null },
    /** 当前视口矩形（世界坐标）。与 `camera` 二选一，前者优先。 */
    viewport: { type: Object as PropType<WorldRect | null>, default: null },
    /** 当前相机；给了它且没给 `viewport` 时用于反算可见范围。 */
    camera: { type: Object as PropType<{ scale: number; pan: Vec2 } | null>, default: null },
    /** 主视口容器尺寸（相机反算可见范围时需要）。 */
    viewportSize: { type: Object as PropType<MinimapSize | null>, default: null },
    /** 缩略图像素宽。 */
    width: { type: Number, default: 180 },
    /** 缩略图像素高。 */
    height: { type: Number, default: 120 },
    /** 缩略图内留白（像素）。 */
    padding: { type: Number, default: 6 },
    /** 点击是否抛出 `navigate`。 */
    panOnClick: { type: Boolean, default: true },
    /**
     * 外框形状：`rect`（缺省，方形）或 `circle`（圆形）。
     *
     * 世界是圆盘时用 `circle`：内容按 `clipPath` 裁成圆，四角不再显示
     * 「实际不存在的区域」。坐标映射不受影响（恒按世界范围等比适配）。
     */
    shape: { type: String as PropType<MinimapShape>, default: 'rect' },
    /**
     * 方位指示（指北线 / 坐标轴）。缺省不画。
     *
     * 三维档强烈建议提供：相机一转画面全变，缩略图若没有任何方位参考，
     * 使用者无法判断「现在朝哪」。
     */
    compass: { type: Object as PropType<MinimapCompass | null>, default: null },
    /** 自定义内容绘制（用于需要更精细画法的宿主）。 */
    renderContent: { type: Function as unknown as PropType<MinimapContentSlot | null>, default: null },
  },
  emits: {
    /** 请求把相机移到该处（载荷为新的 `pan`；`scale` 沿用宿主当前值）。 */
    navigate: (_payload: { pan: Vec2; world: Vec2 }) => true,
  },
  setup(props, { emit, slots }) {
    // 每个实例一个唯一 clip 序号（见文件头 `clipSeq` 注释）
    const instanceClipSeq = ++clipSeq;
    const size = computed<MinimapSize>(() => ({ width: props.width, height: props.height }));

    /**
     * 参与「内容范围」的矩形。
     *
     * **世界范围优先**：宿主给了 `world` 就用它，否则用「内容包围盒 ∪ 视口矩形」。
     *
     * 为什么必须让宿主能给 `world`：只用「内容 ∪ 视口」时，内容还没出现
     * （开局空场景、新建画布）的场合，范围完全由视口决定 —— 于是视口框
     * **恒等于整块小图**，缩放/平移时看起来「框不动」。那不是相机没连上，
     * 是小图本身跟着相机一起缩放了，两个比例同步抵消。
     *
     * 世界范围是**世界的固有边界**，不该随相机变化。
     */
    const worldBounds = computed<WorldRect | null>(() => {
      if (props.world) return props.world;
      const rects: WorldRect[] = props.items.map((item) => item.world);
      const vp = currentViewport.value;
      if (vp) rects.push(vp);
      return contentWorldBounds(rects);
    });

    /** 当前视口矩形（世界坐标）。 */
    const currentViewport = computed<WorldRect | null>(() => {
      if (props.viewport) return props.viewport;
      if (props.camera && props.viewportSize) {
        const { scale, pan } = props.camera;
        const safeScale = scale === 0 ? 1 : scale;
        return {
          x: -pan.x / safeScale + 0,
          y: -pan.y / safeScale + 0,
          width: Math.max(props.viewportSize.width / safeScale, 1),
          height: Math.max(props.viewportSize.height / safeScale, 1),
        };
      }
      return null;
    });

    /** 坐标映射（世界 ↔ 缩略图）。 */
    const transform = computed<MinimapTransform | null>(() => {
      const bounds = worldBounds.value;
      if (!bounds) return null;
      return minimapTransform(bounds, size.value, props.padding);
    });

    /** 视口框的绘制结果。 */
    const viewportFrame = computed<MinimapViewportFrame | null>(() => {
      const vp = currentViewport.value;
      const t = transform.value;
      if (!vp || !t) return null;
      return {
        frame: minimapViewportRect(t, vp),
        raw: t.worldRectToMinimap(vp),
      };
    });

    /** 把指定 `kind` 的项画成一个图元。 */
    const renderItem = (item: MinimapItem, t: MinimapTransform): VNode => {
      const kind: MinimapItemKind = item.kind
        ?? (item.world.width === 0 && item.world.height === 0 ? 'point' : 'rect');
      const classes = [
        'main-ui-minimap__item',
        `main-ui-minimap__item--${kind}`,
        item.highlighted ? 'is-highlighted' : '',
      ];

      if (kind === 'path' && item.points && item.points.length > 1) {
        const points = item.points
          .map((point) => {
            const mini = t.worldToMinimap(point);
            return `${mini.x.toFixed(2)},${mini.y.toFixed(2)}`;
          })
          .join(' ');
        return h('polyline', {
          key: item.id,
          class: classes,
          points,
          'data-group': item.group,
        });
      }

      if (kind === 'point') {
        // 点：以世界坐标为圆心画一个小圆。
        // 半径固定为像素值 —— 缩放缩略图尺寸时点不应跟着变大变小。
        const center = t.worldToMinimap({
          x: item.world.x + item.world.width / 2,
          y: item.world.y + item.world.height / 2,
        });
        return h('circle', {
          key: item.id,
          class: classes,
          cx: center.x,
          cy: center.y,
          r: item.highlighted ? 2.5 : 1.8,
          'data-group': item.group,
        });
      }

      const rect = t.worldRectToMinimap(item.world);
      return h('rect', {
        key: item.id,
        class: classes,
        x: rect.x,
        y: rect.y,
        width: Math.max(rect.width, 1),
        height: Math.max(rect.height, 1),
        'data-group': item.group,
      });
    };

    /** 把指针事件位置换算为缩略图内坐标。 */
    const toLocal = (event: PointerEvent, host: HTMLElement): Vec2 | null => {
      const rect = host.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      // 容器尺寸可能与 props 声明的尺寸不同（被 CSS 拉伸），按比例折算，
      // 否则点击位置会与图元错位。
      const sx = props.width / rect.width;
      const sy = props.height / rect.height;
      return { x: (event.clientX - rect.left) * sx, y: (event.clientY - rect.top) * sy };
    };

    const handlePointer = (event: PointerEvent): void => {
      if (!props.panOnClick) return;
      const t = transform.value;
      const host = event.currentTarget as HTMLElement | null;
      if (!t || !host) return;
      const local = toLocal(event, host);
      if (!local) return;
      const world = t.minimapToWorld(local);
      const vpSize = props.viewportSize;
      // 没有主视口尺寸就无法算「居中」，此时只抛世界坐标，由宿主自行决定。
      const pan = vpSize
        ? panToMinimapPoint(t, local, vpSize, props.camera?.scale ?? 1)
        : { x: 0, y: 0 };
      emit('navigate', { pan, world });
    };

    return () => {
      const t = transform.value;
      const children: VNode[] = [];
      const isCircle = props.shape === 'circle';
      const clipId = `main-ui-minimap-clip-${instanceClipSeq}`;

      if (isCircle) {
        // 圆形外框：内容按世界轮廓裁切，四角不再显示「实际不存在的区域」
        children.push(h('defs', null, [
          h('clipPath', { id: clipId }, [
            h('circle', {
              cx: props.width / 2,
              cy: props.height / 2,
              r: Math.min(props.width, props.height) / 2,
            }),
          ]),
        ]));
      }

      // 内容与视口框都要被裁（视口框同样不该越出圆外）
      const contentChildren: VNode[] = [];

      if (t) {
        if (props.renderContent) {
          const custom = props.renderContent({
            transform: t,
            items: props.items,
            viewport: viewportFrame.value,
          });
          contentChildren.push(...(Array.isArray(custom) ? custom : [custom]));
        } else {
          contentChildren.push(...props.items.map((item) => renderItem(item, t)));
        }

        const vf = viewportFrame.value;
        if (vf) {
          contentChildren.push(h('rect', {
            class: 'main-ui-minimap__viewport',
            x: vf.frame.x,
            y: vf.frame.y,
            width: vf.frame.width,
            height: vf.frame.height,
          }));
        }
      }

      children.push(h(
        'g',
        isCircle ? { 'clip-path': `url(#${clipId})` } : {},
        contentChildren,
      ));

      if (isCircle) {
        // 圆形描边：裁切只影响绘制，边界仍需要一圈可见的轮廓
        children.push(h('circle', {
          class: 'main-ui-minimap__outline',
          cx: props.width / 2,
          cy: props.height / 2,
          r: Math.min(props.width, props.height) / 2 - 0.5,
        }));
      }

      // 坐标指示器：不受裁切（圆外贴近边界的箭头也要可见）
      if (props.compass) {
        const cx = props.width / 2;
        const cy = props.height / 2;
        const r = Math.min(props.width, props.height) / 2 - 4;
        const axes = props.compass.axes;

        if (axes) {
          /**
           * **三维坐标轴 gizmo**：三根投影后的立体箭头，X 红 / Y 绿 / Z 蓝。
           *
           * 配色取业界通例（UE / Blender / Maya 的轴 gizmo 都是 RGB↔XYZ），
           * 这样使用者不必重新学一遍。
           *
           * 每根轴按其在屏幕上的投影方向与长度画：长度已由宿主按
           * `|投影分量|` 算好，因此**俯视时 Y 轴几乎消失**（正对镜头），
           * **侧视时 Y 轴最长** —— 这正是「一眼看出我在俯视还是侧看」的来源。
           *
           * 轴长统一乘一个系数 `axisScale`，让小地图里三根轴占据合适比例。
           */
          const axisScale = r * 0.72;
          const drawAxis = (
            vec: { x: number; y: number },
            colorClass: string,
            label: string,
          ): void => {
            const len = Math.hypot(vec.x, vec.y);
            // 近乎正对镜头的轴退化成一个点：画个小圆点示意「朝你/背你」
            if (len < 0.06) {
              children.push(h('circle', {
                class: `main-ui-minimap__axis-dot ${colorClass}`,
                cx: cx,
                cy: cy,
                r: 2.5,
              }));
              return;
            }
            const ex = cx + vec.x * axisScale;
            const ey = cy + vec.y * axisScale;
            const ux = vec.x / len;
            const uy = vec.y / len;
            // 箭头头部：沿轴反向回退出两条边
            const head = Math.min(6, Math.max(3, len * axisScale * 0.35));
            const px = -uy;
            const py = ux;
            const tip = `${ex},${ey}`;
            const left = `${ex - ux * head + px * head * 0.5},${ey - uy * head + py * head * 0.5}`;
            const right = `${ex - ux * head - px * head * 0.5},${ey - uy * head - py * head * 0.5}`;
            children.push(h('line', {
              class: `main-ui-minimap__axis ${colorClass}`,
              x1: cx, y1: cy, x2: ex, y2: ey,
            }));
            children.push(h('polygon', {
              class: `main-ui-minimap__axis-head ${colorClass}`,
              points: `${tip} ${left} ${right}`,
            }));
            children.push(h('text', {
              class: `main-ui-minimap__axis-label ${colorClass}`,
              x: ex + ux * 6,
              y: ey + uy * 6,
              'text-anchor': 'middle',
              'dominant-baseline': 'middle',
            }, label));
          };
          // 先画 Z（通常朝下/朝里），再 X，最后 Y —— 让上方的轴压住下方的线
          drawAxis(axes.z, 'main-ui-minimap__axis--z', 'Z');
          drawAxis(axes.x, 'main-ui-minimap__axis--x', 'X');
          drawAxis(axes.y, 'main-ui-minimap__axis--y', 'Y');
        } else {
          const az = props.compass.azimuth;
          // 方位角 0 = 北朝上；正值逆时针。屏幕 Y 向下，故取负号。
          const nx = cx + Math.sin(-az) * r;
          const ny = cy - Math.cos(-az) * r;
          children.push(h('line', {
            class: 'main-ui-minimap__compass',
            x1: cx,
            y1: cy,
            x2: nx,
            y2: ny,
          }));
          children.push(h('circle', {
            class: 'main-ui-minimap__compass-tip',
            cx: nx,
            cy: ny,
            r: 3,
          }));
          if (props.compass.showAxes) {
            // 旧的「只有两条线」画法（二维档）：X 轴（红）/ Y 轴（绿）
            children.push(h('line', {
              class: 'main-ui-minimap__axis main-ui-minimap__axis--x',
              x1: cx, y1: cy, x2: cx + r * 0.55, y2: cy,
            }));
            children.push(h('line', {
              class: 'main-ui-minimap__axis main-ui-minimap__axis--y',
              x1: cx, y1: cy, x2: cx, y2: cy + r * 0.55,
            }));
          }
        }
      }

      // 宿主自定义叠加层（例如比例尺、图例）。与内容层分开，避免互相覆盖。
      if (slots.overlay && t) {
        const overlay = slots.overlay({ transform: t });
        children.push(...overlay);
      }

      return h('svg', {
        class: [
          'main-ui-minimap',
          props.panOnClick ? 'is-interactive' : '',
          props.shape === 'circle' ? 'is-circle' : '',
        ],
        width: props.width,
        height: props.height,
        viewBox: `0 0 ${props.width} ${props.height}`,
        role: 'img',
        'aria-label': '缩略导航',
        'data-item-count': String(props.items.length),
        onPointerdown: handlePointer,
        // 拖动时持续跳转（小地图的常见操作：按住拖着走）
        onPointermove: (event: PointerEvent) => {
          if (event.buttons !== 1) return;
          handlePointer(event);
        },
      }, children);
    };
  },
});

/** 自定义内容绘制的槽函数签名。 */
export type MinimapContentSlot = (context: {
  transform: MinimapTransform;
  items: readonly MinimapItem[];
  viewport: MinimapViewportFrame | null;
}) => VNode | VNode[];
