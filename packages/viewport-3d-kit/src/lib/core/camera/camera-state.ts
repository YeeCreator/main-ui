import * as THREE from 'three';

/**
 * 视口相机状态。
 */
export interface ViewportCameraState {
  /** 相机位置。 */
  position: [number, number, number];
  /** 相机观察目标。 */
  target: [number, number, number];
  /** 相机视场角。 */
  fov: number;
  /** 近平面。 */
  near: number;
  /** 远平面。 */
  far: number;
}

/**
 * 相机状态序列化格式。
 */
export type SerializedViewportCameraState = {
  /** 序列化版本。 */
  v: 1;
  /** 相机位置。 */
  position: [number, number, number];
  /** 相机目标。 */
  target: [number, number, number];
  /** 视场角。 */
  fov: number;
  /** 近平面。 */
  near: number;
  /** 远平面。 */
  far: number;
};

/**
 * 场景包围盒求视角配置。
 */
export interface ResolveCameraStateOptions {
  /** 视场角。 */
  fov?: number;
  /** 相机方向向量。 */
  direction?: [number, number, number];
  /** 边界留白因子。 */
  paddingFactor?: number;
  /** 最小相机距离。 */
  minDistance?: number;
}

/**
 * 相机缩放配置。
 */
export interface ZoomCameraOptions {
  /** 缩放因子，大于 1 为拉远，小于 1 为拉近。 */
  factor: number;
  /** 最小相机距离。 */
  minDistance?: number;
}

/**
 * 相机状态序列化。
 *
 * @param state 相机状态。
 * @returns 序列化结果。
 */
export function serializeViewportCameraState(state: ViewportCameraState): SerializedViewportCameraState {
  return {
    v: 1,
    position: state.position,
    target: state.target,
    fov: state.fov,
    near: state.near,
    far: state.far,
  };
}

/**
 * 相机状态反序列化。
 *
 * @param data 序列化结果。
 * @returns 相机状态。
 */
export function deserializeViewportCameraState(data: SerializedViewportCameraState): ViewportCameraState {
  if (!data || data.v !== 1) {
    throw new Error('Unsupported camera state serialization format.');
  }

  return {
    position: data.position,
    target: data.target,
    fov: data.fov,
    near: data.near,
    far: data.far,
  };
}

/**
 * 基于场景包围盒生成相机状态。
 *
 * @param bounds 场景包围盒。
 * @param options 配置。
 * @returns 相机状态。
 */
export function resolveCameraStateForBounds(
  bounds: THREE.Box3,
  options: ResolveCameraStateOptions = {},
): ViewportCameraState {
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());

  const fov = options.fov ?? 50;
  const paddingFactor = options.paddingFactor ?? 1.3;
  const minDistance = options.minDistance ?? 4;

  const radius = Math.max(size.length() / 2, 1);
  const distance = Math.max(
    minDistance,
    (radius * paddingFactor) / Math.tan(THREE.MathUtils.degToRad(fov / 2)),
  );

  const inputDirection = options.direction ?? [1, 1, 1];
  const direction = new THREE.Vector3(...inputDirection);
  if (direction.lengthSq() < 1e-6) {
    direction.set(1, 1, 1);
  }
  direction.normalize();

  const position = center.clone().addScaledVector(direction, distance);

  return {
    position: [position.x, position.y, position.z],
    target: [center.x, center.y, center.z],
    fov,
    near: Math.max(0.1, distance / 200),
    far: Math.max(1000, distance * 40),
  };
}

/**
 * 对相机执行缩放，保持观察目标不变。
 *
 * @param state 当前相机状态。
 * @param options 缩放配置。
 * @returns 缩放后的相机状态。
 */
export function zoomViewportCameraState(
  state: ViewportCameraState,
  options: ZoomCameraOptions,
): ViewportCameraState {
  const { factor, minDistance = 1 } = options;
  if (!Number.isFinite(factor) || factor <= 0) {
    return state;
  }

  const position = new THREE.Vector3(...state.position);
  const target = new THREE.Vector3(...state.target);
  const offset = position.sub(target);
  const nextDistance = Math.max(minDistance, offset.length() * factor);

  if (offset.lengthSq() < 1e-6) {
    offset.set(1, 1, 1).normalize().multiplyScalar(nextDistance);
  } else {
    offset.normalize().multiplyScalar(nextDistance);
  }

  const nextPosition = target.clone().add(offset);

  return {
    ...state,
    position: [nextPosition.x, nextPosition.y, nextPosition.z],
  };
}
