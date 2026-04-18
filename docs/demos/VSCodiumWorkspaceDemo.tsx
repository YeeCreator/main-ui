import React from 'react';
import { ActivityRail, BottomPanel, EditorTabs, MatchFrame, Panel, StatusBar, Toolbar, ViewportHost } from '../../src/layout';
import { TreePanel } from '../../src/navigation';
import { InspectorFormPanel } from '../../src/form';

/**
 * VSCodium 风格工作台演示。
 *
 * 该示例展示典型的左树、中心视口、右侧属性、底部状态栏布局。
 *
 * @returns 演示组件。
 */
export function VSCodiumWorkspaceDemo(): React.JSX.Element {
  return (
    <MatchFrame
      preset="vscodium"
      toolbar={
        <Toolbar
          preset="vscodium"
          left={<span>资源管理器</span>}
          center={<span>main-ui-react / VSCodium 工作台</span>}
          right={<span>调试</span>}
        />
      }
      activityRail={
        <ActivityRail
          preset="vscodium"
          items={[
            { id: 'explorer', label: '资源管理器', icon: 'EX', active: true },
            { id: 'search', label: '搜索', icon: 'SR' },
            { id: 'scm', label: '源代码管理', icon: 'SC' },
            { id: 'run', label: '运行与调试', icon: 'RN' },
          ]}
          bottomItems={[{ id: 'settings', label: '设置', icon: 'ST' }]}
        />
      }
      leftSidebar={
        <TreePanel
          title="项目树"
          preset="vscodium"
          nodes={[
            {
              id: 'root',
              name: 'workspace',
              children: [
                { id: 'scene', name: 'scene.json' },
                { id: 'materials', name: 'materials', children: [{ id: 'mat-1', name: 'metal.mat' }] },
              ],
            },
          ]}
        />
      }
      editorTabs={
        <EditorTabs
          preset="vscodium"
          tabs={[
            { id: 'scene', label: 'scene.json', active: true, dirty: true, closable: true },
            { id: 'material', label: 'metal.mat', closable: true },
            { id: 'readme', label: 'README.md', closable: true },
          ]}
          trailing={<span style={{ fontSize: 12, color: '#9da2a6' }}>工作区: demo</span>}
        />
      }
      center={
        <ViewportHost preset="vscodium">
          <Panel
            preset="vscodium"
            title="视口挂载位"
            style={{ margin: 12, height: 'calc(100% - 24px)' }}
            actions={<span style={{ fontSize: 12 }}>可嵌入 Three.js / Konva / X6 / 自研视口</span>}
          >
            <div
              style={{
                height: '100%',
                minHeight: 320,
                border: '1px dashed #3c3c3c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9da2a6',
              }}
            >
              这里挂载客户自己的视口工具包
            </div>
          </Panel>
        </ViewportHost>
      }
      bottomPanel={
        <BottomPanel
          preset="vscodium"
          tabs={[
            { id: 'problems', label: '问题', active: true },
            { id: 'output', label: '输出' },
            { id: 'terminal', label: '终端' },
          ]}
          actions={<span style={{ fontSize: 12, color: '#9da2a6' }}>当前: 问题 3 条</span>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#cccccc' }}>
            <div>[警告] scene.json 第 12 行：未设置默认相机。</div>
            <div>[信息] materials/metal.mat：已使用演示材质模板。</div>
            <div>[提示] 你可以把这里替换成终端、输出、问题面板或自定义日志区。</div>
          </div>
        </BottomPanel>
      }
      rightSidebar={
        <InspectorFormPanel
          title="属性检查器"
          preset="vscodium"
          fields={[
            { name: 'name', label: '名称', kind: 'text' },
            { name: 'x', label: '位置 X', kind: 'number' },
            { name: 'y', label: '位置 Y', kind: 'number' },
          ]}
          initialValues={{ name: '节点 A', x: 120, y: 80 }}
          onSubmitValues={() => {}}
        />
      }
      statusbar={
        <StatusBar
          preset="vscodium"
          left={[{ content: 'main-ui-react' }, { content: '工作区已连接' }]}
          right={[{ content: 'UTF-8' }, { content: '空格: 2' }, { content: 'TypeScript React' }]}
        />
      }
    />
  );
}