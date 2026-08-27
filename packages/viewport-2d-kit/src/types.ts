import type { Camera2D, Vec2 } from './viewportMath';

export type Viewport2DCamera = Camera2D;
export type { Vec2 };

export type Viewport2DController = {
  fitToCenter: () => void;
  getCamera: () => Viewport2DCamera;
  setCamera: (camera: Viewport2DCamera) => void;
};
