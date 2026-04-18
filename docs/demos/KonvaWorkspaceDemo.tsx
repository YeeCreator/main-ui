import React from 'react';
import { MatchFrame, Panel, StatusBar, Toolbar, ViewportHost } from '../../src/layout';
import { Sidebar } from '../../src/Sidebar';
import type { SidebarModel } from '../../src/types';

/**
 * Konva 风格工作台演示模型。
 */
const konvaSidebarModel: SidebarModel = {
  title: '画布工具',
  sections: [
    {
      id: 'tool-select',
      title: '工具模式',
      statusText: '切换当前画布工具。',
      controls: [
        {
          kind: 'segmented',
          label: '模式',
          value: 'select',
          options: [
            { value: 'select', label: '选择' },
            { value: 'pen', label: '钢笔' },
            { value: 'rect', label: '矩形' },
          ],
          onChange: () => {},
        },
      ],
    },
    {
      id: 'zoom-info',
      title: '视图信息',
      statusText: '当前画布缩放 100%，坐标原点位于左上角。',
      actions: [{ label: '重置视图', onClick: () => {} }],
    },
  ],
};

/**
 * Konva 风格工作台演示。
 *
 * @returns 演示组件。
 */
export function KonvaWorkspaceDemo(): React.JSX.Element {
  return (
    <MatchFrame
      preset="konva"
      toolbar={
        <Toolbar
          preset="konva"
          left={<span>画布编辑器</span>}
          center={<span>Konva 风格主壳层</span>}
          right={<span>图层 12 个对象</span>}
        />
      }
      leftSidebar={<Sidebar model={konvaSidebarModel} preset="konva" />}
      center={
        <ViewportHost preset="konva" style={{ padding: 16 }}>
          <Panel preset="konva" title="外部视口挂载位" style={{ height: '100%' }}>
            <div
              style={{
                height: '100%',
                minHeight: 360,
                borderRadius: 12,
                border: '1px dashed rgba(91,72,47,0.24)',
                background:
                  'radial-gradient(circle at top left, rgba(255,255,255,0.9), rgba(244,231,206,0.9) 45%, rgba(235,220,193,0.9))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b5c4b',
                fontSize: 14,
              }}
            >
              这里嵌入 Konva Stage 或其他 2D 视口
            </div>
          </Panel>
        </ViewportHost>
      }
      rightSidebar={
        <Panel preset="konva" title="属性面板" style={{ margin: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div>对象：矩形 01</div>
            <div>位置：240, 160</div>
            <div>尺寸：320 × 180</div>
            <div>旋转：0°</div>
          </div>
        </Panel>
      }
      statusbar={
        <StatusBar
          preset="konva"
          left={[{ content: '画布 4096 × 4096' }, { content: '对象 12 / 选中 1' }]}
          right={[{ content: '缩放 100%' }, { content: '像素网格已开启' }]}
        />
      }
    />
  );
}