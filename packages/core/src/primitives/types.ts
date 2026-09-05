/**
 * primitives/types —— 通用实体快照与图元规格（框架无关，不绑定 scene-kit）。
 *
 * 宿主适配层负责把自己的数据（如 SK 的 WorldSnapshot、YG 的棋盘 state）
 * 映射为 `EntitySnapshot`，view-world 据此自动渲染图元。
 */

/** 图元几何类型。 */
export type EntityGeometry = 'point' | 'sprite' | 'text' | 'polygon';

/** 世界坐标下的矩形范围。 */
export interface WorldBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 列式实体批次（SoA）：一个批次内的所有实体共享同一种几何与列结构。
 *
 * `columns` 中每列是一个只读数组，长度应等于 `count`；常见列名：
 * `x` / `y`（世界坐标）、`text`（文字图元）、`color`（数值色）、`texture`（精灵纹理键）等。
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
}

/** 数值色（0xRRGGBB）。 */
export type Color = number;

/** 网格/棋盘图元规格（世界坐标）。 */
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
  /** 棋盘交替填充色 [偶格, 奇格]；省略则不填充。 */
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
}

/** 多边形/路径图元项（世界坐标）。 */
export interface PolygonItem {
  points: ReadonlyArray<{ x: number; y: number }>;
  fill?: Color;
  fillAlpha?: number;
  stroke?: Color;
  strokeWidth?: number;
  closed?: boolean;
}
