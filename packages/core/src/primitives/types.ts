/**
 * primitives/types —— 通用实体快照与图元规格（框架无关，不绑定 scene-kit）。
 *
 * 宿主适配层负责把自己的数据结构（如上游引擎的世界快照、网格状态）
 * 映射为 `EntitySnapshot`，view-world 据此自动渲染图元。
 */

/** 图元几何类型。 */
export type EntityGeometry = 'point' | 'sprite' | 'text' | 'polygon' | 'polyline';

/** 世界坐标下的矩形范围。 */
export interface WorldBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 视图维度。数据契约的合法取值，不是过渡状态。 */
export type SnapshotDimensions = 2 | 3;

/**
 * 列式实体批次（SoA）：一个批次内的所有实体共享同一种几何与列结构。
 *
 * `columns` 中每列是一个只读数组，长度应等于 `count`；常见列名：
 * `x` / `y` / `z`（世界坐标，`z` 可选且缺省 0）、`text`（文字图元）、
 * `color`（数值色）、`texture`（精灵纹理键）等。
 *
 * **升维约定**：`z` 列与 `extrude` 列均为**可选列**，缺省 0。二维后端忽略二者，
 * 因此带 `z` 的快照在二维后端下的渲染结果与不带 `z` 逐像素一致。
 */
export interface EntityBatch {
  kind: string;
  count: number;
  columns: Record<string, readonly unknown[]>;
  geometry: EntityGeometry;
}

/**
 * 通用实体快照：一帧世界状态的列式描述。
 */
export interface EntitySnapshot {
  /** 世界范围（用于相机 fit）。 */
  bounds: WorldBounds;
  /** 批次表：key 为批次名，value 为列式批次。 */
  batches: Record<string, EntityBatch>;
  /** 可选帧号（用于回放/时间线）。 */
  tick?: number;
  /**
   * 视图维度（可选，缺省 2）。
   *
   * 这是**数据契约的合法取值**，不是过渡状态：同一份快照在二维后端按正交俯视渲染，
   * 在三维后端可带 `z` 与 `extrude` 呈现深度。二维后端忽略此字段。
   */
  dimensions?: SnapshotDimensions;
}

/** 数值色（0xRRGGBB）。 */
export type Color = number;

/**
 * 文字公告牌朝向（仅三维档生效）。
 *
 * - `'full'`：完全面向相机
 * - `'axis'`：只绕 Y 轴转
 * - `'none'`：不旋转
 */
export type TextBillboard = 'full' | 'axis' | 'none';

/** 网格图元规格（世界坐标）。 */
export interface GridSpec {
  x: number;
  y: number;
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  /** 网格线颜色。 */
  lineColor?: Color;
  /** 网格线宽（世界单位）。 */
  lineWidth?: number;
  /** 交替填充色 [偶格, 奇格]；省略则不填充。 */
  cellFill?: [Color, Color];
}

/** 文字图元项（世界坐标）。 */
export interface TextItem {
  x: number;
  y: number;
  text: string;
  /** 字号（世界单位，随相机缩放）。 */
  fontSize?: number;
  color?: Color;
  fontFamily?: string;
  /** 锚点：0=左/上，0.5=居中，1=右/下。默认居中。 */
  anchorX?: number;
  anchorY?: number;
  /** 深度（可选，缺省 0；二维后端忽略）。 */
  z?: number;
  /**
   * 公告牌朝向（可选，仅三维档生效；缺省 `'full'`）。
   *
   * - `'full'`：完全面向相机，怎么转都正着看 —— 血条、名字标签、伤害数字
   * - `'axis'`：只绕 Y 轴转（像立在地上的广告牌），俯视/侧视有透视 —— 地图地名
   * - `'none'`：不旋转，朝向由场景层级另行决定 —— 已有朝向语义的场合
   *
   * 缺省取 `'full'`：贴片场景占绝大多数，且内置 `Sprite` 天然就是这个语义。
   * 二维后端忽略本字段。
   */
  billboard?: TextBillboard;
}

/** 精灵/点图元项（世界坐标）。 */
export interface SpriteItem {
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: Color;
  /** 可选纹理键（由 view-world 的纹理注册表解析）；缺省时按占位图形渲染。 */
  texture?: string;
  /** 占位形状（无纹理时）。默认 'circle'。 */
  shape?: 'circle' | 'rect';
  /** 深度（可选，缺省 0；二维后端忽略）。 */
  z?: number;
  /** 挤出厚度（可选，缺省 0 = 无厚度；二维后端忽略）。 */
  extrude?: number;
}

/**
 * 折线图元项（世界坐标）。
 *
 * 与 `PolygonItem` 的分工：`polygon` 用于**闭合填充**（面），
 * `polyline` 用于**开放描边**（线/网络）。二者的列结构一致（`points`），
 * 差别只在语义与默认 `closed`；需要填充的闭合轮廓用 `polygon`，
 * 需要描绘网络/路径的用 `polyline`。
 */
export interface PolylineItem {
  /**
   * 点列。每点可带**独立 `z`**（缺省则回落到 `item.z`）。
   *
   * **为什么逐点而不是整条一个 z**：一维复形（弯到空间里的弧）在三维下
   * 每个采样点的高度各不相同。整条统一 `z` 只能画出平躺在某一高度的线，
   * 三维弧会被画成一条平面直线——那等于「呈现的三维」与「记下的三维」不一致。
   * 二维后端忽略 `z`，故带 `z` 的点列在二维下与不带时逐像素一致。
   */
  points: ReadonlyArray<{ x: number; y: number; z?: number }>;
  /** 描边颜色。 */
  stroke?: Color;
  /** 描边宽度（世界单位）。 */
  strokeWidth?: number;
  /** 是否闭合（默认 false = 开放折线）。 */
  closed?: boolean;
  /** 顶点圆点半径（世界单位）；0/缺省 = 不画顶点。 */
  vertexRadius?: number;
  /** 顶点圆点颜色（缺省同 stroke）。 */
  vertexColor?: Color;
  /** 可选填充色（闭合折线才生效）。 */
  fill?: Color;
  /** 填充透明度 0..1。 */
  fillAlpha?: number;
  /**
   * 整条线的缺省深度（可选，缺省 0；二维后端忽略）。
   *
   * 逐点的 `points[].z` 优先；本字段是「整条线同高」时的简写。
   */
  z?: number;
}

/** 多边形/路径图元项（世界坐标）。 */
export interface PolygonItem {
  points: ReadonlyArray<{ x: number; y: number }>;
  fill?: Color;
  fillAlpha?: number;
  stroke?: Color;
  strokeWidth?: number;
  closed?: boolean;
  /** 深度（可选，缺省 0；二维后端忽略）。 */
  z?: number;
  /** 挤出厚度（可选，缺省 0 = 无厚度；二维后端忽略）。 */
  extrude?: number;
}
