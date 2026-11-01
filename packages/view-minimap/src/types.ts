import type { Vec2, WorldRect } from '@main-ui/core/rendering';

/**
 * 缩略导航（`Minimap`）的公共类型。
 *
 * ## 一个抽象，两种画法
 *
 * 「小地图」（游戏）与「缩略图 / 导航」（画布）在坐标数学上完全一致，
 * 差别只有**简化画法**。这里用一个 `kind` 字段表达这个差别：
 *
 * - `point`：实体画成一个质点（游戏里的单位、城市）
 * - `rect`：单元画成一个框（画布里的节点、卡片）
 * - `path`：折线（路线、连线）
 *
 * 判据上是统一的：**点就是零宽高的矩形**。宿主不必在两套 API 之间挑，
 * 传同一种结构即可；缺省时组件按 `width` / `height` 是否为 0 自动判。
 */

/** 缩略图内一项内容的简化画法。 */
export type MinimapItemKind = 'point' | 'rect' | 'path';

/** 缩略图内的一项内容（世界坐标）。 */
export type MinimapItem = {
  /** 稳定标识（用于渲染 key）。 */
  id: string;
  /**
   * 该项在世界中的范围。
   *
   * `point` 型忽略宽高（可传 0）；`path` 型用 `points`，此字段仅用于包围盒。
   */
  world: WorldRect;
  /**
   * 简化画法。缺省按 `world.width === 0 && world.height === 0` 自动判为 `point`。
   */
  kind?: MinimapItemKind;
  /**
   * `path` 型的折线点（世界坐标）。
   *
   * 与 `world` 二选一：`path` 必须给 `points`，`world` 仍建议给包围盒，
   * 否则该项不参与「内容范围」计算，可能被画到缩略图外。
   */
  points?: Vec2[];
  /** 语义分组（供宿主在插槽里按组着色，组件本身不含业务语义）。 */
  group?: string;
  /** 是否高亮（例如已选中、当前所在区域）。 */
  highlighted?: boolean;
};

/** 视口矩形在缩略图内的绘制结果（供自定义插槽使用）。 */
export type MinimapViewportFrame = {
  /** 绘制矩形（像素，已含最小可见尺寸）。 */
  frame: WorldRect;
  /** 真实矩形（像素，未撑开；点击/命中判定应用它）。 */
  raw: WorldRect;
};
