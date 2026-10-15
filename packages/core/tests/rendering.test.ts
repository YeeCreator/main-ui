import { describe, expect, test } from 'vitest';
import {
  cameraRotation,
  clamp,
  deserializeCamera,
  fitCameraToViewBox,
  panBy,
  rotateAtScreenPoint,
  screenToWorld,
  serializeCamera,
  worldToScreen,
  zoomAtScreenPoint,
} from '../src/rendering/camera';
import { constrainCamera } from '../src/rendering/constraints';
import { classifyWheelIntent, wheelPanDelta } from '../src/rendering/interactions';

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

  test('cameraRotation defaults to 0 for legacy cameras', () => {
    expect(cameraRotation({ scale: 1, pan: { x: 0, y: 0 } })).toBe(0);
    expect(cameraRotation({ scale: 1, pan: { x: 0, y: 0 }, rotation: Math.PI / 2 })).toBeCloseTo(Math.PI / 2, 6);
  });

  test('rotation keeps screenToWorld / worldToScreen inverse', () => {
    const camera = { scale: 2, pan: { x: 10, y: -4 }, rotation: Math.PI / 5 };
    const world = { x: 7, y: 3 };
    const screen = worldToScreen(camera, world);
    const back = screenToWorld(camera, screen);
    expect(back.x).toBeCloseTo(world.x, 6);
    expect(back.y).toBeCloseTo(world.y, 6);
  });

  test('zoomAtScreenPoint preserves anchor under rotation', () => {
    const camera = { scale: 1.3, pan: { x: -12, y: 8 }, rotation: Math.PI / 6 };
    const anchor = { x: 55, y: 31 };
    const before = screenToWorld(camera, anchor);
    const next = zoomAtScreenPoint(camera, { factor: 1.7, anchorScreen: anchor });
    const after = screenToWorld(next, anchor);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(next.rotation).toBeCloseTo(camera.rotation, 6);
  });

  test('rotateAtScreenPoint preserves anchor and accumulates angle', () => {
    const camera = { scale: 1.2, pan: { x: 4, y: 6 }, rotation: 0 };
    const anchor = { x: 40, y: 25 };
    const before = screenToWorld(camera, anchor);
    const next = rotateAtScreenPoint(camera, { deltaAngle: Math.PI / 4, anchorScreen: anchor });
    const after = screenToWorld(next, anchor);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(next.rotation).toBeCloseTo(Math.PI / 4, 6);
    expect(next.scale).toBe(camera.scale);
  });

  test('serializeCamera omits rotation when zero, keeps it otherwise', () => {
    expect(serializeCamera({ scale: 2, pan: { x: 1, y: 1 } })).toEqual({ scale: 2, pan: { x: 1, y: 1 } });
    const withRot = serializeCamera({ scale: 2, pan: { x: 1, y: 1 }, rotation: 0.5 });
    expect(withRot.rotation).toBeCloseTo(0.5, 6);
    expect(deserializeCamera(withRot)?.rotation).toBeCloseTo(0.5, 6);
  });
});

describe('core/rendering wheel intent', () => {
  test('auto mode: ctrlKey zooms, plain wheel pans', () => {
    expect(classifyWheelIntent({ ctrlKey: true }, 'auto')).toBe('zoom');
    expect(classifyWheelIntent({ ctrlKey: false }, 'auto')).toBe('pan');
  });

  test('forced modes override ctrlKey', () => {
    expect(classifyWheelIntent({ ctrlKey: false }, 'zoom')).toBe('zoom');
    expect(classifyWheelIntent({ ctrlKey: true }, 'pan')).toBe('pan');
  });

  test('wheelPanDelta negates the wheel delta', () => {
    expect(wheelPanDelta({ deltaX: 10, deltaY: -5 })).toEqual({ x: -10, y: 5 });
    expect(wheelPanDelta({ deltaX: 3, deltaY: 4 }, 2)).toEqual({ x: -6, y: -8 });
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
