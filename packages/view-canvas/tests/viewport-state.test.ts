import { describe, expect, test } from 'vitest';
import {
  cameraTransformOf,
  constrainScale,
  fitCamera,
  panCamera,
  wheelZoomFactor,
  zoomByFactor,
} from '../src/viewport-state';

describe('view-canvas viewport-state', () => {
  test('constrainScale clamps scale but keeps pan (and omits zero rotation)', () => {
    expect(constrainScale({ scale: 100, pan: { x: 5, y: 6 } }, 0.2, 4)).toEqual({ scale: 4, pan: { x: 5, y: 6 } });
    expect(constrainScale({ scale: 0.01, pan: { x: 5, y: 6 } }, 0.2, 4)).toEqual({ scale: 0.2, pan: { x: 5, y: 6 } });
    const withRot = constrainScale({ scale: 2, pan: { x: 1, y: 1 }, rotation: 0.5 }, 0.2, 4);
    expect(withRot.rotation).toBeCloseTo(0.5, 6);
  });

  test('fitCamera returns null for degenerate size and centers otherwise', () => {
    expect(fitCamera({ width: 0, height: 0 }, { x: 0, y: 0, width: 100, height: 50 }, 0, 0.2, 8)).toBeNull();
    const camera = fitCamera({ width: 200, height: 100 }, { x: 0, y: 0, width: 100, height: 50 }, 0, 0.2, 8);
    expect(camera?.scale).toBe(2);
  });

  test('zoomByFactor anchors at container center by default', () => {
    const camera = { scale: 1, pan: { x: 0, y: 0 } };
    const next = zoomByFactor(camera, { width: 100, height: 100 }, 2, null, 0.2, 8);
    expect(next.scale).toBe(2);
    // anchor (50,50); world before = (50,50); pan' = 50 - 50*2 = -50
    expect(next.pan).toEqual({ x: -50, y: -50 });
  });

  test('zoomByFactor respects scale bounds', () => {
    const camera = { scale: 3.9, pan: { x: 0, y: 0 } };
    const next = zoomByFactor(camera, { width: 100, height: 100 }, 2, null, 0.2, 4);
    expect(next.scale).toBe(4);
  });

  test('wheelZoomFactor is exponential in deltaY', () => {
    expect(wheelZoomFactor(0)).toBe(1);
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100)).toBeLessThan(1);
  });

  test('panCamera translates in screen pixels', () => {
    expect(panCamera({ scale: 1, pan: { x: 0, y: 0 } }, { x: 7, y: -3 }).pan).toEqual({ x: 7, y: -3 });
  });

  test('cameraTransformOf renders translate+scale', () => {
    expect(cameraTransformOf({ scale: 2, pan: { x: 5, y: 6 } })).toBe('translate(5 6) scale(2)');
  });
});
