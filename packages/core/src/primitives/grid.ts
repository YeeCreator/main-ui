/**
 * primitives/grid —— 网格/棋盘图元渲染（PixiJS v8）。
 *
 * 在给定 PIXI.Container 上绘制一个 cols×rows 的网格；可选棋盘交替填充。
 * 所有坐标为世界坐标，随相机缩放。
 */
import { Container, Graphics } from 'pixi.js';
import type { GridSpec } from './types';

/**
 * 绘制网格图元，返回新建的 Container（已绘制内容，未加入父容器）。
 */
export function createGrid(spec: GridSpec): Container {
  const layer = new Container();
  layer.label = 'grid';
  const g = new Graphics();

  const {
    x, y, cols, rows, cellWidth, cellHeight,
    lineColor = 0x000000, lineWidth = 1, cellFill,
  } = spec;

  const totalW = cols * cellWidth;
  const totalH = rows * cellHeight;

  // 棋盘交替填充
  if (cellFill) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const color = (r + c) % 2 === 0 ? cellFill[0] : cellFill[1];
        g.rect(x + c * cellWidth, y + r * cellHeight, cellWidth, cellHeight).fill(color);
      }
    }
  }

  // 网格线（竖线）
  if (lineWidth > 0) {
    for (let c = 0; c <= cols; c++) {
      const px = x + c * cellWidth;
      g.moveTo(px, y).lineTo(px, y + totalH).stroke({ width: lineWidth, color: lineColor });
    }
    // 横线
    for (let r = 0; r <= rows; r++) {
      const py = y + r * cellHeight;
      g.moveTo(x, py).lineTo(x + totalW, py).stroke({ width: lineWidth, color: lineColor });
    }
  }

  layer.addChild(g);
  return layer;
}

/** 在既有容器上就地绘制网格（复用容器）。 */
export function renderGrid(target: Container, spec: GridSpec): Container {
  const layer = createGrid(spec);
  target.addChild(layer);
  return layer;
}
