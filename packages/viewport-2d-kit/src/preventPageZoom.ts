/**
 * Best-effort guard against browser-level zoom gestures.
 *
 * We handle pan/zoom inside the game viewport, so we want to stop:
 * - Ctrl+Wheel page zoom (desktop/trackpad)
 * - gesture* events (Safari/iOS)
 *
 * Notes:
 * - Some browsers intentionally ignore parts of this for accessibility.
 * - We keep the prevention narrow (only while ctrlKey is pressed / gesture events).
 */
export function installPreventPageZoom() {
  // Ctrl + wheel => page zoom on many browsers.
  // Use a non-passive listener so preventDefault works.
  const onWheel = (e: WheelEvent) => {
    // Prevent browser zoom.
    if (e.ctrlKey) e.preventDefault();
  };
  window.addEventListener('wheel', onWheel, { passive: false });

  // Note: We intentionally do NOT prevent non-ctrl wheel globally here,
  // because the app still needs to scroll in sidebars and other pages.
  // Per-game viewports should call preventDefault() on wheel capture.
  //
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
