import React from 'react';

const VSCodiumWorkspaceDemo = React.lazy(async () => import('../../docs/demos/VSCodiumWorkspaceDemo').then((module) => ({ default: module.VSCodiumWorkspaceDemo })));
const KonvaWorkspaceDemo = React.lazy(async () => import('../../docs/demos/KonvaWorkspaceDemo').then((module) => ({ default: module.KonvaWorkspaceDemo })));
const EmbeddedViewportHostDemo = React.lazy(async () => import('../../docs/demos/EmbeddedViewportHostDemo').then((module) => ({ default: module.EmbeddedViewportHostDemo })));

type DemoKey = 'vscodium' | 'konva' | 'embedded';

const tabs: Array<{ id: DemoKey; label: string; description: string }> = [
  { id: 'vscodium', label: 'VSCodium 预设', description: '深色工作台布局，适合资源编辑器、IDE 风格工具。' },
  { id: 'konva', label: 'Konva 预设', description: '偏画布工具台风格，适合 2D 设计与创作型工具。' },
  { id: 'embedded', label: '纯嵌入宿主', description: '只展示视口挂载位，不附带具体视口引擎。' },
];

/**
 * 本地 demo 宿主应用。
 *
 * @returns 可运行的本地预览页面。
 */
export function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = React.useState<DemoKey>('vscodium');

  const activeMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#101214', color: '#f7f7f7' }}>
      <header
        style={{
          flex: '0 0 auto',
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <strong style={{ fontSize: 16 }}>main-ui-react 本地 demo</strong>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{activeMeta.description}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tabs.map((tab) => {
            const selected = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  border: selected ? '1px solid #5ab1ff' : '1px solid rgba(255,255,255,0.18)',
                  background: selected ? 'rgba(90,177,255,0.18)' : 'rgba(255,255,255,0.05)',
                  color: '#ffffff',
                  borderRadius: 999,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      <main style={{ flex: '1 1 auto', minHeight: 0 }}>
        <React.Suspense
          fallback={
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.72)' }}>
              正在加载示例...
            </div>
          }
        >
          {activeTab === 'vscodium' ? <VSCodiumWorkspaceDemo /> : null}
          {activeTab === 'konva' ? <KonvaWorkspaceDemo /> : null}
          {activeTab === 'embedded' ? <EmbeddedViewportHostDemo /> : null}
        </React.Suspense>
      </main>
    </div>
  );
}