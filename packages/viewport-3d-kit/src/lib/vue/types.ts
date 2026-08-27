import type { ViewportCameraState } from '../core/camera';
import type { TransformMode } from '../core/gizmo';
import type { SelectedEntityId } from '../core/selection';
import type { ViewportEntity } from '../core/scene';
import type { ViewportDisplayMode, ViewportWorkMode } from '../core/viewport';

/**
 * 对象局部变换数据。
 */
export interface EntityTransformState {
  /** 对象位置。 */
  position: [number, number, number];
  /** 对象旋转。 */
  rotation: [number, number, number];
  /** 对象缩放。 */
  scale: [number, number, number];
}

/**
 * 对象变换字典。
 */
export type EntityTransformMap = Record<string, EntityTransformState>;

/**
 * Vue 视口组件属性。
 */
export interface Viewport3DVueProps {
  /** 场景对象列表。 */
  entities?: ViewportEntity[];
  /** 受控：是否启用小地图。 */
  miniMapEnabled?: boolean;
  /** 非受控：小地图默认状态。 */
  defaultMiniMapEnabled?: boolean;
  /** 受控：选中对象。 */
  selectedEntityId?: SelectedEntityId;
  /** 非受控：默认选中对象。 */
  defaultSelectedEntityId?: SelectedEntityId;
  /** 受控：变换模式。 */
  transformMode?: TransformMode;
  /** 非受控：默认变换模式。 */
  defaultTransformMode?: TransformMode;
  /** 受控：对象变换状态。 */
  entityTransforms?: EntityTransformMap;
  /** 非受控：默认对象变换状态。 */
  defaultEntityTransforms?: EntityTransformMap;
  /** 受控：相机状态。 */
  cameraState?: ViewportCameraState;
  /** 非受控：默认相机状态。 */
  defaultCameraState?: ViewportCameraState;
  /** 受控：工作模式。 */
  workMode?: ViewportWorkMode;
  /** 非受控：默认工作模式。 */
  defaultWorkMode?: ViewportWorkMode;
  /** 受控：显示模式。 */
  displayMode?: ViewportDisplayMode;
  /** 非受控：默认显示模式。 */
  defaultDisplayMode?: ViewportDisplayMode;
  /** 受控：Unreal 运行导航。 */
  unrealRuntimeNavigation?: boolean;
  /** 非受控：默认 Unreal 运行导航。 */
  defaultUnrealRuntimeNavigation?: boolean;
  /** 受控：中键+修饰键方案。 */
  modifierMiddlePresetEnabled?: boolean;
  /** 非受控：默认中键+修饰键方案。 */
  defaultModifierMiddlePresetEnabled?: boolean;
  /** 容器类名。 */
  className?: string;
}
