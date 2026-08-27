import * as THREE from 'three';
import type { TransformMode } from '../gizmo';
import type { ViewportDisplayMode, ViewportWorkMode } from './mode-state';

/**
 * 轨道鼠标动作。
 */
export type OrbitMouseAction = 'rotate' | 'pan' | 'dolly';

/**
 * 轨道鼠标绑定。
 */
export interface OrbitMouseBindings {
  /** 左键动作。 */
  left: OrbitMouseAction;
  /** 中键动作。 */
  middle: OrbitMouseAction;
  /** 右键动作。 */
  right: OrbitMouseAction;
}

/**
 * Unreal 视角控制参数。
 */
export interface UnrealLookOptions {
  /** 水平移动增量。 */
  deltaX: number;
  /** 垂直移动增量。 */
  deltaY: number;
  /** 灵敏度。 */
  sensitivity?: number;
}

/**
 * 修饰键中键旋转参数。
 */
export interface ModifierOrbitOptions {
  /** 水平移动增量。 */
  deltaX: number;
  /** 垂直移动增量。 */
  deltaY: number;
  /** 旋转速度。 */
  speed?: number;
}

/**
 * 视口输入上下文。
 */
export interface PointerInputContext {
  /** 工作模式。 */
  workMode: ViewportWorkMode;
  /** 是否启用 Unreal 导航。 */
  unrealRuntimeNavigation: boolean;
  /** 是否启用中键修饰键方案。 */
  modifierMiddlePresetEnabled: boolean;
  /** 鼠标按钮。 */
  button: number;
  /** Alt 是否按下。 */
  altKey: boolean;
  /** Ctrl 是否按下。 */
  ctrlKey: boolean;
}

/**
 * 判断是否启动 Unreal 右键观察。
 *
 * @param context 输入上下文。
 * @returns 是否应启动。
 */
export function shouldStartUnrealLook(context: PointerInputContext): boolean {
  return context.workMode === 'runtime' && context.unrealRuntimeNavigation && context.button === 2;
}

/**
 * 判断是否启动中键修饰键方案。
 *
 * @param context 输入上下文。
 * @returns 是否应启动。
 */
export function shouldStartModifierMiddleAction(context: PointerInputContext): boolean {
  return (
    context.modifierMiddlePresetEnabled &&
    context.button === 1 &&
    (context.altKey || context.ctrlKey)
  );
}

/**
 * 判断是否应屏蔽上下文菜单。
 *
 * @param workMode 工作模式。
 * @param unrealRuntimeNavigation Unreal 导航开关。
 * @param shiftKey Shift 是否按下。
 * @returns 是否屏蔽。
 */
export function shouldBlockContextMenu(
  workMode: ViewportWorkMode,
  unrealRuntimeNavigation: boolean,
  shiftKey: boolean,
): boolean {
  return workMode === 'runtime' && unrealRuntimeNavigation && !shiftKey;
}

/**
 * 判断移动是否达到有效阈值。
 *
 * @param deltaX X 方向位移。
 * @param deltaY Y 方向位移。
 * @param threshold 判定阈值。
 * @returns 是否有效移动。
 */
export function hasMeaningfulPointerMove(
  deltaX: number,
  deltaY: number,
  threshold = 2,
): boolean {
  return Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold;
}

/**
 * 根据工作模式解析轨道鼠标绑定。
 *
 * @param workMode 工作模式。
 * @param unrealRuntimeNavigation Unreal 导航开关。
 * @param modifierMiddlePresetEnabled 中键修饰键方案开关。
 * @returns 鼠标绑定定义。
 */
export function resolveOrbitMouseBindings(
  workMode: ViewportWorkMode,
  unrealRuntimeNavigation: boolean,
  modifierMiddlePresetEnabled: boolean,
): OrbitMouseBindings {
  if (workMode === 'runtime' && unrealRuntimeNavigation) {
    return {
      left: 'pan',
      middle: 'pan',
      right: 'pan',
    };
  }

  if (modifierMiddlePresetEnabled) {
    return {
      left: 'rotate',
      middle: 'pan',
      right: 'pan',
    };
  }

  return {
    left: 'rotate',
    middle: 'pan',
    right: 'dolly',
  };
}

/**
 * 将按键映射到变换模式。
 *
 * @param key 键值。
 * @returns 变换模式或空。
 */
export function resolveTransformModeByKey(key: string): TransformMode | null {
  const lower = key.toLowerCase();
  if (lower === 'g') {
    return 'translate';
  }
  if (lower === 'r') {
    return 'rotate';
  }
  if (lower === 's') {
    return 'scale';
  }
  return null;
}

/**
 * 切换显示模式。
 *
 * @param mode 当前模式。
 * @returns 下一模式。
 */
export function cycleDisplayMode(mode: ViewportDisplayMode): ViewportDisplayMode {
  const order: ViewportDisplayMode[] = ['wireframe', 'solid', 'rendered'];
  const index = order.indexOf(mode);
  return order[(index + 1) % order.length];
}

/**
 * 根据鼠标位移计算缩放倍率。
 *
 * @param deltaY Y 方向增量。
 * @returns 缩放倍率。
 */
export function resolveModifierMiddleZoomFactor(deltaY: number): number {
  return deltaY > 0 ? 1.04 : 0.96;
}

/**
 * 应用 Unreal 风格右键观察。
 *
 * @param camera 透视相机。
 * @param target 控制器目标点。
 * @param options 参数。
 */
export function applyUnrealLookToCamera(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  options: UnrealLookOptions,
): void {
  const { deltaX, deltaY, sensitivity = 0.0025 } = options;

  const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  euler.y -= deltaX * sensitivity;
  euler.x -= deltaY * sensitivity;
  euler.x = THREE.MathUtils.clamp(euler.x, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
  camera.quaternion.setFromEuler(euler);

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const nextTarget = camera.position.clone().add(forward.multiplyScalar(10));
  target.copy(nextTarget);
}

/**
 * 应用修饰键中键旋转（围绕 target）。
 *
 * @param camera 透视相机。
 * @param target 控制器目标点。
 * @param options 参数。
 */
export function applyModifierMiddleOrbitToCamera(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  options: ModifierOrbitOptions,
): void {
  const { deltaX, deltaY, speed = 0.008 } = options;

  const offset = camera.position.clone().sub(target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta -= deltaX * speed;
  spherical.phi -= deltaY * speed;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.02, Math.PI - 0.02);

  offset.setFromSpherical(spherical);
  camera.position.copy(target.clone().add(offset));
  camera.lookAt(target);
}
