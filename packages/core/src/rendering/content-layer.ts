/**
 * rendering/content-layer —— 视口的**内容层**契约（框架无关、零 DOM 依赖）。
 *
 * ## 为什么需要这一层
 *
 * GPU 视口（WebGL）无法承担白板的内容：
 *
 * | 白板必需 | GPU | 浏览器 DOM |
 * | --- | --- | --- |
 * | 原生文本编辑（IME / 光标 / 选区） | 做不到 | 原生 |
 * | 异构内容（视频 / iframe / 可编辑表格） | 做不到 | 原生 |
 * | 任意倍率锐利（公式细线） | 位图放大即糊 | 始终按屏幕密度绘制 |
 *
 * 故视口提供**双输出面**，共用**同一台相机**：
 *
 * ```text
 *                ┌──────────── 同一台相机 ────────────┐
 *   view-world ──┬── 几何面（GPU） ：点 / 线 / 面 / 贴图 / 动画
 *                └── 文字面（DOM） ：公式 / 富文本 / 可编辑内容
 * ```
 *
 * **这不是「两套变换并存」**：禁令针对的是两个**相机**（§十九 F-3 教训）；
 * 本处只有一台相机、一次变换、两个输出面。
 *
 * ## 本模块只做纯计算
 *
 * 投影（world → screen）、可见范围、裁剪判定全部是纯函数，可 Node 单测。
 * 渲染与 DOM 挂载归模板（`view-world` 的 `dom-layer` 插槽）。
 */

import type { Camera2D, Vec2 } from './camera';
import { screenToWorld, worldToScreen } from './camera';

/** 视口容器尺寸（CSS 像素）。 */
export type ContentLayerSize = { width: number; height: number };

/** 世界坐标矩形（含 x/y 与宽高）。 */
export type WorldRect = { x: number; y: number; width: number; height: number };

/**
 * 内容锚点：把内容放在世界坐标的哪个位置。
 *
 * 与图元（GPU 侧）的差异：内容层项是**一块区域**，不是一元点，
 * 因此需要尺寸与锚点，供宿主定位 DOM 元素。
 */
export type ContentAnchor = {
  /** 世界坐标锚点。 */
  world: Vec2;
  /** 锚点在内容盒上的相对位置：0 = 左/上，0.5 = 居中，1 = 右/下。 */
  anchorX?: number;
  anchorY?: number;
};

/**
 * 内容层项。
 *
 * **只描述"要放什么、放哪儿"**，不描述"怎么渲染" —— 渲染由宿主决定
 * （公式走 KaTeX、富文本走编辑器、视频走 `<video>`）。
 */
export type ContentLayerItem = {
  /** 稳定标识（用于 key 与增量更新）。 */
  id: string;
  /** 内容类型（宿主自定义语义，例如 `formula` / `text` / `media`）。 */
  kind: string;
  /** 世界坐标锚点与对齐方式。 */
  anchor: ContentAnchor;
  /**
   * 内容的**世界单位**估算尺寸（宽高）。
   *
   * 用途：**裁剪判定**。宿主不必精确，够判断"是否落在可见范围内"即可。
   * 缺省视为零尺寸（仍会参与可见性判定）。
   */
  size?: { width: number; height: number };
  /** 附加给宿主的透传数据（内容本身不在此处，避免把业务数据塞进渲染契约）。 */
  data?: Record<string, unknown>;
};

/** 内容层项的屏幕投影结果。 */
export type ProjectedContentItem = ContentLayerItem & {
  /** 屏幕坐标（相对容器左上角，CSS 像素）。 */
  screen: Vec2;
  /** 屏幕上的估算像素尺寸（已按缩放折算）。 */
  screenSize: { width: number; height: number };
  /**
   * 锚点对齐后的 CSS 偏移量（供 `transform: translate(...)` 使用）。
   *
   * 已把「锚点不在左上角」折算进去：把 `translate` 设为该值时，
   * 内容的锚点正好落在 `screen` 上。
   */
  offset: Vec2;
};

/**
 * 计算视口的**可见世界范围**。
 *
 * 用屏幕四角反算世界坐标，得到包含整个视口的轴对齐矩形。
 * 相机有旋转时取四角包围盒（比精确多边形保守，但足够用于裁剪）。
 *
 * @param camera 当前相机。
 * @param size 容器尺寸（CSS 像素）。
 * @returns 可见世界矩形。
 * @example
 * visibleWorldRect({ scale: 1, pan: { x: 0, y: 0 } }, { width: 800, height: 600 })
 * // → { x: 0, y: 0, width: 800, height: 600 }
 */
export function visibleWorldRect(camera: Camera2D, size: ContentLayerSize): WorldRect {
  const corners: Vec2[] = [
    screenToWorld(camera, { x: 0, y: 0 }),
    screenToWorld(camera, { x: size.width, y: 0 }),
    screenToWorld(camera, { x: 0, y: size.height }),
    screenToWorld(camera, { x: size.width, y: size.height }),
  ];

  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

/** 判断世界矩形是否与另一矩形相交（含边界接触）。 */
export function rectsIntersect(a: WorldRect, b: WorldRect): boolean {
  return a.x <= b.x + b.width
    && b.x <= a.x + a.width
    && a.y <= b.y + b.height
    && b.y <= a.y + a.height;
}

/**
 * 把内容层项投影为屏幕坐标。
 *
 * 纯计算，不含任何 DOM 操作。宿主拿到结果后自行渲染（`position: absolute`
 * + `transform: translate(offset)`）。
 *
 * @param camera 当前相机。
 * @param items 内容层项。
 * @returns 投影结果（顺序与输入一致）。
 * @example
 * const items = [{ id: 'f1', kind: 'formula', anchor: { world: { x: 10, y: 20 } } }]
 * projectContentLayer({ scale: 2, pan: { x: 0, y: 0 } }, items)
 * // → [{ ..., screen: { x: 20, y: 40 }, offset: { x: 0, y: 0 } }]  // 默认锚点居中
 */
export function projectContentLayer(
  camera: Camera2D,
  items: readonly ContentLayerItem[],
): ProjectedContentItem[] {
  return items.map((item) => {
    const screen = worldToScreen(camera, item.anchor.world);
    const anchorX = item.anchor.anchorX ?? 0.5;
    const anchorY = item.anchor.anchorY ?? 0.5;
    const worldW = item.size?.width ?? 0;
    const worldH = item.size?.height ?? 0;
    const screenW = worldW * camera.scale;
    const screenH = worldH * camera.scale;

    return {
      ...item,
      screen,
      screenSize: { width: screenW, height: screenH },
      // 锚点在盒内占比 × 自身尺寸 = 需要向左上回退的距离。
      // `+ 0` 把 -0 归一化：`-0` 与 `0` 在 Object.is / 深比较下不等，
      // 会让「左上锚点无偏移」这类断言无故失败，且无任何视觉差异。
      offset: { x: -screenW * anchorX + 0, y: -screenH * anchorY + 0 },
    };
  });
}

/**
 * 裁剪内容层：只保留落在可见世界范围内的项。
 *
 * **必须调用**：不做裁剪时，宿主会为所有项创建 DOM 节点，
 * 节点数一多即成为瓶颈（白板的常见失败形态）。
 *
 * 判定用世界坐标矩形相交，而非屏幕坐标 —— 相机一变，世界坐标不变，
 * 故判定结果稳定、可缓存。
 *
 * @param camera 当前相机。
 * @param size 容器尺寸。
 * @param items 内容层项。
 * @returns 可见项（顺序与输入一致）。
 * @example
 * const visible = cullContentLayer(camera, size, items)
 * projectContentLayer(camera, visible)
 */
export function cullContentLayer(
  camera: Camera2D,
  size: ContentLayerSize,
  items: readonly ContentLayerItem[],
): ContentLayerItem[] {
  const view = visibleWorldRect(camera, size);
  return items.filter((item) => {
    const w = item.size?.width ?? 0;
    const h = item.size?.height ?? 0;
    const anchorX = item.anchor.anchorX ?? 0.5;
    const anchorY = item.anchor.anchorY ?? 0.5;
    // 锚点不在左上角时，实际盒范围要左移/上移相应比例
    const box: WorldRect = {
      x: item.anchor.world.x - w * anchorX,
      y: item.anchor.world.y - h * anchorY,
      width: w,
      height: h,
    };
    return rectsIntersect(view, box);
  });
}

/**
 * 一步完成「裁剪 + 投影」。
 *
 * 模板的主用法。先裁剪再投影：裁剪结果稳定，投影结果随相机变化。
 *
 * @param camera 当前相机。
 * @param size 容器尺寸。
 * @param items 内容层项。
 * @returns 可见项的屏幕投影。
 */
export function prepareContentLayer(
  camera: Camera2D,
  size: ContentLayerSize,
  items: readonly ContentLayerItem[],
): ProjectedContentItem[] {
  return projectContentLayer(camera, cullContentLayer(camera, size, items));
}
