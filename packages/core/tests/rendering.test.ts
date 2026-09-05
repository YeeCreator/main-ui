import { describe, expect, test } from 'vitest';
import {
  clamp,
  deserializeCamera,
  fitCameraToViewBox,
  panBy,
  screenToWorld,
  serializeCamera,
  worldToScreen,
  zoomAtScreenPoint,
} from '../src/rendering/camera';
import { constrainCamera } from '../src/rendering/constraints';

describe('core/rendering camera math', () => {
  test('screenToWorld / worldToScreen are inverse', () => {
    const camera = { scale: 2, pan: { x: 10, y: -4 } };
    const world = { x: 7, y: 3 };
    const screen = worldToScreen(camera, world);
    expect(screen).toEqual({ x: 10 + 7 * 2, y: -4 + 3 * 2 });
    expect(screenToWorld(camera, screen)).toEqual(world);
  });

  test('fitCameraToViewBox centers the box', () => {
    const camera = fitCameraToViewBox({
      containerPx: { width: 200, height: 100 },
      viewBox: { x: 0, y: 0, width: 100, height: 50 },
      paddingPx: 0,
    });
    // scale = min(200/100, 100/50) = 2
    expect(camera.scale).toBe(2);
    // world center (50,25) -> screen center (100,50)
    expect(worldToScreen(camera, { x: 50, y: 25 })).toEqual({ x: 100, y: 50 });
  });

  test('panBy translates in screen pixels', () => {
    const camera = { scale: 1, pan: { x: 0, y: 0 } };
    expect(panBy(camera, { x: 5, y: -3 }).pan).toEqual({ x: 5, y: -3 });
  });

  test('zoomAtScreenPoint keeps the anchor world point fixed', () => {
    const camera = { scale: 1, pan: { x: 0, y: 0 } };
    const anchor = { x: 40, y: 20 };
    const before = screenToWorld(camera, anchor);
    const next = zoomAtScreenPoint(camera, { factor: 2, anchorScreen: anchor });
    expect(next.scale).toBe(2);
    const after = screenToWorld(next, anchor);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  test('clamp / serialize / deserialize round-trip', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    const camera = { scale: 1.5, pan: { x: 2, y: 3 } };
    expect(deserializeCamera(serializeCamera(camera))).toEqual(camera);
    expect(deserializeCamera(null)).toBeNull();
    expect(deserializeCamera({ scale: NaN, pan: { x: 0, y: 0 } })).toBeNull();
  });
});

describe('core/rendering constraints', () => {
  test('clamps scale to range', () => {
    const next = constrainCamera({ scale: 100, pan: { x: 0, y: 0 } }, { scale: { min: 0.5, max: 4 } });
    expect(next.scale).toBe(4);
  });

  test('centers world smaller than viewport', () => {
    const next = constrainCamera(
      { scale: 1, pan: { x: 500, y: 500 } },
      { panBounds: { worldBounds: { x: 0, y: 0, width: 50, height: 50 }, viewportPx: { width: 200, height: 200 } } },
    );
    // world center 25 -> screen center 100
    expect(next.pan.x).toBe(100 - 25);
    expect(next.pan.y).toBe(100 - 25);
  });
});
