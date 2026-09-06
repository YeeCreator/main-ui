/**
 * preventPageZoom —— 浏览器级缩放手势的最佳努力防护（吸收自原 viewport-2d-kit）。
 *
 * 视口内的平移/缩放由 view-world / PixiViewport 自行处理，因此需要阻止：
 * - Ctrl+Wheel 页面缩放（桌面/触控板）
 * - gesture* 事件（Safari/iOS）
 *
 * 说明：
 * - 部分浏览器出于无障碍考虑会忽略其中一部分。
 * - 防护保持窄范围（仅在 ctrlKey 按下 / gesture 事件时）。
 */
export function installPreventPageZoom(): () => void {
  // Ctrl + wheel => 多数浏览器为页面缩放；用非 passive 监听以便 preventDefault。
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) e.preventDefault();
  };
  window.addEventListener('wheel', onWheel, { passive: false });

  // 注意：这里**不**全局阻止非 ctrl 的 wheel，
  // 因为应用侧栏等仍需滚动；各游戏视口应在自身 wheel capture 里 preventDefault。
  const prevent = (e: Event) => e.preventDefault();
  window.addEventListener('gesturestart', prevent, { passive: false } as AddEventListenerOptions);
  window.addEventListener('gesturechange', prevent, { passive: false } as AddEventListenerOptions);
  window.addEventListener('gestureend', prevent, { passive: false } as AddEventListenerOptions);

  return () => {
    window.removeEventListener('wheel', onWheel as EventListener);
    window.removeEventListener('gesturestart', prevent as EventListener);
    window.removeEventListener('gesturechange', prevent as EventListener);
    window.removeEventListener('gestureend', prevent as EventListener);
  };
}
