/**
 * minimap —— 缩略导航的坐标纯函数（零渲染依赖）。
 *
 * ## 为什么只有一套实现
 *
 * 缩略导航有两种通俗叫法：「小地图」（游戏，把实体画成一个质点）与
 * 「导航图 / 缩略图」（画布，把单元按比例画成框）。看似两条技术路线，
 * 实际除**简化画法**外每一步都相同：
 *
 * | 环节 | 质点法 | 缩放法 |
 * | --- | --- | --- |
 * | 算世界范围 | 相同 | 相同 |
 * | 世界 ↔ 缩略图坐标映射 | 相同 | 相同 |
 * | 画视口矩形 | 相同 | 相同 |
 * | 点击跳转 | 相同 | 相同 |
 * | **简化画法** | 画成点 | 画成框 |
 *
 * 而「点」在几何上就是**零宽高的矩形**。故两条路线共用同一套坐标数学，
 * 简化画法交给视图组件按 `kind` 分派即可 —— 强行分成两套实现，会得到两个
 * 「世界 ↔ 小图」换算，正是本库反复出现的失败形态（同一件事两处实现）。
 *
 * ## 不做什么
 *
 * 本模块**不重绘场景**。「对整体进行缩放渲染」在实现上不可行：
 * 再开一个 WebGL context 会让显存翻倍；复制全部 DOM 内容节点会让白板场景
 * 节点数翻倍。主流画布软件（含 draw.io）的缩略图画的也是**简化图元**，
 * 不是把文字与连线缩小重画一遍。
 */

import type { Camera2D, Vec2 } from './camera';
import type { WorldRect } from './content-layer';

/** 缩略图组件的像素尺寸。 */
export type MinimapSize = { width: number; height: number };

/**
 * 世界 ↔ 缩略图的坐标映射。
 *
 * 纯值，可序列化、可深比较。**不要在宿主侧自己算**：缩放因子与内边距的
 * 组合极易算错（尤其内边距要按两个方向分别取 min），一旦宿主各算一份，
 * 视口矩形就会与内容错位。
 */
export type MinimapTransform = {
  /** 世界单位 → 缩略图像素的比例。 */
  scale: number;
  /** 世界原点在缩略图内的像素偏移。 */
  offset: Vec2;
  /** 世界单位 → 缩略图像素。 */
  worldToMinimap: (point: Vec2) => Vec2;
  /** 缩略图像素 → 世界单位（供点击跳转使用）。 */
  minimapToWorld: (point: Vec2) => Vec2;
  /** 世界矩形 → 缩略图像素矩形。 */
  worldRectToMinimap: (rect: WorldRect) => WorldRect;
  /** 缩略图像素矩形 → 世界矩形。 */
  minimapRectToWorld: (rect: WorldRect) => WorldRect;
};

/** 计算可用于缩略图的**内容范围**（多项合并后的包围盒）。 */
export function contentWorldBounds(rects: readonly WorldRect[]): WorldRect | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rect of rects) {
    if (rect.x < minX) minX = rect.x;
    if (rect.y < minY) minY = rect.y;
    if (rect.x + rect.width > maxX) maxX = rect.x + rect.width;
    if (rect.y + rect.height > maxY) maxY = rect.y + rect.height;
  }
  // 退化为点或线时给一个最小尺寸，避免除零与「缩略图内什么都看不见」。
  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

/**
 * 计算「世界范围 → 缩略图」的适配变换。
 *
 * 世界范围与视口矩形都要纳入：视口可能移到内容之外，若只适配内容范围，
 * 视口矩形就会被画到缩略图外面去。
 *
 * @param world 需要纳入的世界范围（内容包围盒，或与视口合并后的范围）。
 * @param size 缩略图像素尺寸。
 * @param padding 缩略图内的留白（像素，默认 4）。
 * @returns 坐标映射。
 * @example
 * const t = minimapTransform({ x: 0, y: 0, width: 1000, height: 500 }, { width: 200, height: 100 }, 0)
 * // t.scale === 0.2；t.worldToMinimap({ x: 500, y: 250 }) → { x: 100, y: 50 }
 */
export function minimapTransform(
  world: WorldRect,
  size: MinimapSize,
  padding = 4,
): MinimapTransform {
  // 两个方向各留一份 padding，故可用像素要减 2 倍。
  const usableWidth = Math.max(size.width - padding * 2, 1);
  const usableHeight = Math.max(size.height - padding * 2, 1);
  // 取两个方向的**较小**比例：保证整个世界范围都能装进去（等比缩放，不拉伸）。
  const scale = Math.min(usableWidth / world.width, usableHeight / world.height);

  // 等比缩放后内容在缩略图内居中：多出来的空间对半分。
  const drawnWidth = world.width * scale;
  const drawnHeight = world.height * scale;
  const offset: Vec2 = {
    x: padding + (usableWidth - drawnWidth) / 2 - world.x * scale + 0,
    y: padding + (usableHeight - drawnHeight) / 2 - world.y * scale + 0,
  };

  const worldToMinimap = (point: Vec2): Vec2 => ({
    x: point.x * scale + offset.x,
    y: point.y * scale + offset.y,
  });

  const minimapToWorld = (point: Vec2): Vec2 => ({
    x: (point.x - offset.x) / scale,
    y: (point.y - offset.y) / scale,
  });

  const worldRectToMinimap = (rect: WorldRect): WorldRect => {
    const topLeft = worldToMinimap({ x: rect.x, y: rect.y });
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: rect.width * scale,
      height: rect.height * scale,
    };
  };

  const minimapRectToWorld = (rect: WorldRect): WorldRect => {
    const topLeft = minimapToWorld({ x: rect.x, y: rect.y });
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: rect.width / scale,
      height: rect.height / scale,
    };
  };

  return { scale, offset, worldToMinimap, minimapToWorld, worldRectToMinimap, minimapRectToWorld };
}

/**
 * 视口矩形在缩略图内**允许被看见**的范围。
 *
 * 视口通常远小于世界，但放大到极限时视口矩形会小到看不见（1~2 像素）。
 * 视图组件应保证描边可见，故这里给出一个下限尺寸 —— 只影响绘制，
 * **不影响点击跳转的坐标换算**（后者必须用真实矩形，否则跳转会偏）。
 */
export const MINIMAP_VIEWPORT_MIN_SIZE = 6;

/**
 * 把视口矩形转成缩略图内用于**绘制**的矩形（含最小可见尺寸）。
 *
 * 放大到极限时真实矩形可能不足 1 像素，直接画会完全看不见；
 * 这里以真实矩形中心为基准撑到下限，让用户始终能看到「我在哪」。
 *
 * @param transform 坐标映射。
 * @param viewport 视口矩形（世界坐标）。
 * @returns 缩略图内的绘制矩形（像素）。
 * @example
 * const drawn = minimapViewportRect(t, viewportWorldRect)
 */
export function minimapViewportRect(
  transform: MinimapTransform,
  viewport: WorldRect,
): WorldRect {
  const rect = transform.worldRectToMinimap(viewport);
  const width = Math.max(rect.width, MINIMAP_VIEWPORT_MIN_SIZE);
  const height = Math.max(rect.height, MINIMAP_VIEWPORT_MIN_SIZE);
  // 以真实中心为准撑开，避免视口「跳」到一边。
  return {
    x: rect.x + rect.width / 2 - width / 2,
    y: rect.y + rect.height / 2 - height / 2,
    width,
    height,
  };
}

/**
 * 由当前相机与容器尺寸反算**可见世界矩形**（供缩略图画视口框）。
 *
 * 与 `content-layer` 的 `visibleWorldRect` 语义一致（同样取四角包围盒，
 * 相机有旋转时偏保守），此处在 minimap 模块内以最小依赖重述，
 * 使本模块可独立用于不引入内容层的宿主。
 *
 * @param camera 当前相机。
 * @param viewportSize 视口容器尺寸（CSS 像素）。
 * @returns 可见世界矩形。
 * @example
 * visibleWorldRectOfCamera({ scale: 2, pan: { x: 0, y: 0 } }, { width: 800, height: 600 })
 * // → { x: 0, y: 0, width: 400, height: 300 }
 */
export function visibleWorldRectOfCamera(
  camera: Camera2D,
  viewportSize: MinimapSize,
): WorldRect {
  const scale = camera.scale === 0 ? 1 : camera.scale;
  // 忽略旋转下的精确反算：取「屏幕宽 / 缩放」作为世界宽，与无旋转时完全一致；
  // 有旋转时略偏保守（近似外接盒），可接受 —— 缩略图只需表达「大致在哪」。
  const width = viewportSize.width / scale;
  const height = viewportSize.height / scale;
  const x = -camera.pan.x / scale;
  const y = -camera.pan.y / scale;
  return {
    x: x + 0,
    y: y + 0,
    width: Math.max(width, 1),
    height: Math.max(height, 1),
  };
}

/**
 * 点击缩略图任意位置 → 应把相机平移到哪里（使该点落到视口中心）。
 *
 * 这是缩略图「点击跳转」的完整算法。宿主不必自己推公式 ——
 * `pan` 的符号方向极易写反（本库已在 demo 里踩过一次）。
 *
 * @param transform 坐标映射。
 * @param clickMini 点击位置（缩略图像素）。
 * @param viewportSize 视口容器尺寸（CSS 像素）。
 * @param scale 保持不变的缩放倍率（通常沿用当前相机）。
 * @returns 新的 `pan`（配合原 `scale` 即为新相机）。
 * @example
 * const pan = panToMinimapPoint(t, { x: 100, y: 50 }, { width: 800, height: 600 }, 2)
 * // 点击处的世界点被搬到屏幕中心
 */
export function panToMinimapPoint(
  transform: MinimapTransform,
  clickMini: Vec2,
  viewportSize: MinimapSize,
  scale: number,
): Vec2 {
  const world = transform.minimapToWorld(clickMini);
  // `worldToScreen` 为 `screen = pan + world * scale`；
  // 要让 `world` 落在容器中心，则 `pan = center - world * scale`。
  return {
    x: viewportSize.width / 2 - world.x * scale + 0,
    y: viewportSize.height / 2 - world.y * scale + 0,
  };
}
