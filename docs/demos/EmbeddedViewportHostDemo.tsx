import React from 'react';
import { MatchFrame, StatusBar, Toolbar, ViewportHost } from '../../src/layout';

/**
 * 外部视口嵌入演示。
 *
 * 该示例只展示壳层与嵌入位，不绑定具体视口引擎。
 *
 * @returns 演示组件。
 */
export function EmbeddedViewportHostDemo(): React.JSX.Element {
  const viewportContainerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const host = viewportContainerRef.current;
    if (!host) {
      return;
    }

    host.dataset.viewportMounted = 'true';
    host.textContent = '这里可以在 useEffect 中挂载外部视口实例';

    return () => {
      host.textContent = '';
      delete host.dataset.viewportMounted;
    };
  }, []);

  return (
    <MatchFrame
      preset="default"
      toolbar={<Toolbar preset="default" center={<span>视口嵌入演示</span>} />}
      center={
        <ViewportHost preset="default" style={{ padding: 20 }}>
          <div
            ref={viewportContainerRef}
            style={{
              width: '100%',
              height: '100%',
              minHeight: 320,
              border: '1px dashed rgba(0,0,0,0.16)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666666',
            }}
          />
        </ViewportHost>
      }
      statusbar={<StatusBar preset="default" left={[{ content: '宿主容器已就绪' }]} right={[{ content: '等待外部工具包挂载' }]} />}
    />
  );
}