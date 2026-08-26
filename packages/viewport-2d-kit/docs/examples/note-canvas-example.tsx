import React from 'react';
import { Viewport2D } from 'viewport-2d-kit/core';
import { ViewportOverlayMenu } from 'viewport-2d-kit/ui';

/**
 * 笔记卡片模型。
 */
type NoteCard = {
  /** 卡片唯一标识。 */
  id: string;
  /** 左上角 X。 */
  x: number;
  /** 左上角 Y。 */
  y: number;
  /** 卡片标题。 */
  title: string;
  /** 卡片正文。 */
  body: string;
};

/**
 * 笔记画布示例组件。
 *
 * @returns 可平移缩放的笔记画布。
 * @example
 * ```tsx
 * <NoteCanvasExample />
 * ```
 */
export function NoteCanvasExample(): React.JSX.Element {
  const cards: NoteCard[] = [
    { id: 'n1', x: 80, y: 90, title: '目标', body: '拆分核心与 UI 层，保持可复用。' },
    { id: 'n2', x: 420, y: 180, title: '方案', body: '核心走 core，外围控件走 ui 子入口。' },
    { id: 'n3', x: 240, y: 340, title: '风险', body: '避免 UI 依赖污染核心体积。' },
  ];

  return (
    <ViewportOverlayMenu>
      <div style={{ width: '100%', height: 560 }}>
        <Viewport2D viewBox={{ x: 0, y: 0, width: 900, height: 560 }} background="#fff7ed">
          <svg width={900} height={560}>
            {cards.map((card) => (
              <g key={card.id} transform={`translate(${card.x}, ${card.y})`}>
                <rect width={220} height={120} rx={14} fill="#ffffff" stroke="#fdba74" strokeWidth={2} />
                <text x={14} y={28} fontSize={16} fontWeight={700} fill="#9a3412">
                  {card.title}
                </text>
                <text x={14} y={54} fontSize={13} fill="#7c2d12">
                  {card.body}
                </text>
              </g>
            ))}
          </svg>
        </Viewport2D>
      </div>
    </ViewportOverlayMenu>
  );
}
