import type { SplitDirection } from '../types';

/**
 * 停靠引导落点（五向）：拖拽进行时目标区域的五个合法落位方向。
 * 四个边缘方向对应分割落位，中心对应组内堆叠落位。
 */
export type DropZone = 'top' | 'bottom' | 'left' | 'right' | 'center';

export const DROP_ZONES: readonly DropZone[] = ['top', 'bottom', 'left', 'right', 'center'];

export type DropZoneRect = { x: number; y: number; width: number; height: number };

/**
 * 根据指针位置解析目标区域的落点方向（纯函数，与渲染层无关）。
 *
 * 边缘带宽度 = 对应边长 × `edgeRatio`（默认 0.22），先判定水平边带再判定垂直边带，
 * 四角区域归入先命中的水平方向；不落在任何边带内则为中心堆叠落点。
 */
export const resolveDropZone = (
  rect: Pick<DropZoneRect, 'x' | 'y' | 'width' | 'height'>,
  point: { x: number; y: number },
  edgeRatio = 0.22,
): DropZone => {
  const relativeX = point.x - rect.x;
  const relativeY = point.y - rect.y;
  const verticalBand = rect.height * edgeRatio;
  const horizontalBand = rect.width * edgeRatio;
  if (relativeY < verticalBand) return 'top';
  if (relativeY > rect.height - verticalBand) return 'bottom';
  if (relativeX < horizontalBand) return 'left';
  if (relativeX > rect.width - horizontalBand) return 'right';
  return 'center';
};

/** 边缘落点对应的分割方向；中心落点返回 `null`（组内堆叠，非分割）。 */
export const dropZoneToSplitDirection = (zone: DropZone): SplitDirection | null => {
  switch (zone) {
    case 'top':
      return 'up';
    case 'bottom':
      return 'down';
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    default:
      return null;
  }
};
