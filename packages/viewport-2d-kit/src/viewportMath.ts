export type Vec2 = { x: number; y: number };

/**
 * 2D camera for a large "map" (content/world space) shown through a viewport (screen space).
 *
 * Camera model:
 *   screenPx = panPx + world * scale
 */
export type Camera2D = {
  /** scale factor from world units -> screen pixels */
  scale: number;
  /** translation in SCREEN PIXELS */
  pan: Vec2;
};

export type ViewBox = { x: number; y: number; width: number; height: number };

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function fitCameraToViewBox(opts: {
  containerPx: { width: number; height: number };
  viewBox: ViewBox;
  paddingPx?: number;
}): Camera2D {
  const { containerPx, viewBox, paddingPx = 0 } = opts;

  const w = Math.max(1, containerPx.width - paddingPx * 2);
  const h = Math.max(1, containerPx.height - paddingPx * 2);

  const scale = Math.min(w / viewBox.width, h / viewBox.height);

  // Center the viewBox in the viewport.
  const worldCenterX = viewBox.x + viewBox.width / 2;
  const worldCenterY = viewBox.y + viewBox.height / 2;
  const screenCenterX = containerPx.width / 2;
  const screenCenterY = containerPx.height / 2;

  const panX = screenCenterX - worldCenterX * scale;
  const panY = screenCenterY - worldCenterY * scale;

  return { scale, pan: { x: panX, y: panY } };
}

export function screenToWorld(camera: Camera2D, ptScreen: Vec2): Vec2 {
  return {
    x: (ptScreen.x - camera.pan.x) / camera.scale,
    y: (ptScreen.y - camera.pan.y) / camera.scale,
  };
}

export function worldToScreen(camera: Camera2D, ptWorld: Vec2): Vec2 {
  return {
    x: camera.pan.x + ptWorld.x * camera.scale,
    y: camera.pan.y + ptWorld.y * camera.scale,
  };
}

export function panBy(camera: Camera2D, deltaScreen: Vec2): Camera2D {
  return {
    ...camera,
    pan: {
      x: camera.pan.x + deltaScreen.x,
      y: camera.pan.y + deltaScreen.y,
    },
  };
}

/**
 * Zoom around a specific viewport pixel anchor, keeping the anchor's world point fixed.
 */
export function zoomAtScreenPoint(camera: Camera2D, opts: { factor: number; anchorScreen: Vec2 }): Camera2D {
  const { factor, anchorScreen } = opts;

  const worldBefore = screenToWorld(camera, anchorScreen);
  const nextScale = camera.scale * factor;

  const panX = anchorScreen.x - worldBefore.x * nextScale;
  const panY = anchorScreen.y - worldBefore.y * nextScale;

  return { scale: nextScale, pan: { x: panX, y: panY } };
}

export function cameraToCssTransform(camera: Camera2D): string {
  return `translate(${camera.pan.x}px, ${camera.pan.y}px) scale(${camera.scale})`;
}
