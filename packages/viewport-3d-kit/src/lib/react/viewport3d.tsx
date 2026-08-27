import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, OrbitControls, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { ViewportEntity } from '../core/scene/scene-state';
import { createDemoEntities } from '../core/scene/scene-state';
import { MiniMap3D, type MiniMapMode } from './minimap3d';
import { normalizeSelectedEntityId, type SelectedEntityId } from '../core/selection/selection-state';
import type { TransformMode } from '../core/gizmo/transform-mode';
import {
  resolveCameraStateForBounds,
  zoomViewportCameraState,
  type ViewportCameraState,
} from '../core/camera';
import {
  applyModifierMiddleOrbitToCamera,
  applyUnrealLookToCamera,
  cycleDisplayMode,
  DEFAULT_EDIT_INTERACTION_OPTIONS,
  DEFAULT_RUNTIME_INTERACTION_OPTIONS,
  resolveModifierMiddleZoomFactor,
  resolveOrbitMouseBindings,
  resolveTransformModeByKey,
  shouldBlockContextMenu,
  shouldStartModifierMiddleAction,
  shouldStartUnrealLook,
  type ViewportDisplayMode,
  type ViewportWorkMode,
} from '../core/viewport';
import { Viewport3DContextMenu, Viewport3DToolbar } from '../ui';

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
 * 视口运行态对象。
 */
interface RuntimeEntity {
  /** 对象数据。 */
  entity: ViewportEntity;
  /** 位置。 */
  position: [number, number, number];
  /** 旋转。 */
  rotation: [number, number, number];
  /** 缩放。 */
  scale: [number, number, number];
}

/**
 * 主视口组件属性。
 */
export interface Viewport3DProps {
  /** 场景对象列表。 */
  entities?: ViewportEntity[];
  /** 受控：是否启用小地图。 */
  miniMapEnabled?: boolean;
  /** 非受控：小地图默认状态。 */
  defaultMiniMapEnabled?: boolean;
  /** 小地图模式。 */
  miniMapMode?: MiniMapMode;
  /** 小地图开关变化回调。 */
  onMiniMapEnabledChange?: (enabled: boolean) => void;
  /** 受控：选中对象。 */
  selectedEntityId?: SelectedEntityId;
  /** 非受控：默认选中对象。 */
  defaultSelectedEntityId?: SelectedEntityId;
  /** 选中对象变化回调。 */
  onSelectedEntityIdChange?: (id: SelectedEntityId) => void;
  /** 受控：变换模式。 */
  transformMode?: TransformMode;
  /** 非受控：默认变换模式。 */
  defaultTransformMode?: TransformMode;
  /** 变换模式变化回调。 */
  onTransformModeChange?: (mode: TransformMode) => void;
  /** 受控：对象变换状态。 */
  entityTransforms?: EntityTransformMap;
  /** 非受控：默认对象变换状态。 */
  defaultEntityTransforms?: EntityTransformMap;
  /** 对象变换变化回调。 */
  onEntityTransformsChange?: (transforms: EntityTransformMap) => void;
  /** 受控：相机状态。 */
  cameraState?: ViewportCameraState;
  /** 非受控：默认相机状态。 */
  defaultCameraState?: ViewportCameraState;
  /** 相机状态变化回调。 */
  onCameraStateChange?: (state: ViewportCameraState) => void;
  /** 受控：工作模式。 */
  workMode?: ViewportWorkMode;
  /** 非受控：默认工作模式。 */
  defaultWorkMode?: ViewportWorkMode;
  /** 工作模式变化回调。 */
  onWorkModeChange?: (mode: ViewportWorkMode) => void;
  /** 受控：显示模式。 */
  displayMode?: ViewportDisplayMode;
  /** 非受控：默认显示模式。 */
  defaultDisplayMode?: ViewportDisplayMode;
  /** 显示模式变化回调。 */
  onDisplayModeChange?: (mode: ViewportDisplayMode) => void;
  /** 受控：Unreal 运行导航。 */
  unrealRuntimeNavigation?: boolean;
  /** 非受控：默认 Unreal 运行导航。 */
  defaultUnrealRuntimeNavigation?: boolean;
  /** Unreal 运行导航变化回调。 */
  onUnrealRuntimeNavigationChange?: (enabled: boolean) => void;
  /** 受控：中键+修饰键方案。 */
  modifierMiddlePresetEnabled?: boolean;
  /** 非受控：默认中键+修饰键方案。 */
  defaultModifierMiddlePresetEnabled?: boolean;
  /** 中键+修饰键方案变化回调。 */
  onModifierMiddlePresetEnabledChange?: (enabled: boolean) => void;
  /** 容器类名。 */
  className?: string;
}

/**
 * 将三个数字封装为三元组。
 *
 * @param x X。
 * @param y Y。
 * @param z Z。
 * @returns 三维元组。
 */
function tuple3(x: number, y: number, z: number): [number, number, number] {
  return [x, y, z];
}

/**
 * 轨道动作映射到 Three 鼠标枚举。
 *
 * @param action 轨道动作。
 * @returns Three 鼠标动作。
 */
function mapOrbitActionToThreeMouse(action: 'rotate' | 'pan' | 'dolly') {
  if (action === 'pan') {
    return THREE.MOUSE.PAN;
  }
  if (action === 'dolly') {
    return THREE.MOUSE.DOLLY;
  }
  return THREE.MOUSE.ROTATE;
}

/**
 * 从实体数据创建初始变换字典。
 *
 * @param entities 场景对象。
 * @returns 变换字典。
 */
function createInitialTransforms(entities: ViewportEntity[]): EntityTransformMap {
  return entities.reduce<EntityTransformMap>((acc, entity) => {
    acc[entity.id] = {
      position: entity.position,
      rotation: entity.rotation ?? [0, 0, 0],
      scale: [1, 1, 1],
    };
    return acc;
  }, {});
}

/**
 * 构建运行态实体列表。
 *
 * @param entities 场景对象。
 * @param transforms 变换字典。
 * @returns 运行态实体列表。
 */
function buildRuntimeEntities(entities: ViewportEntity[], transforms: EntityTransformMap): RuntimeEntity[] {
  return entities.map((entity) => {
    const fallback: EntityTransformState = {
      position: entity.position,
      rotation: entity.rotation ?? [0, 0, 0],
      scale: [1, 1, 1],
    };
    const transform = transforms[entity.id] ?? fallback;

    return {
      entity,
      position: transform.position,
      rotation: transform.rotation,
      scale: transform.scale,
    };
  });
}

/**
 * 渲染实体几何。
 *
 * @param props 组件属性。
 * @returns 几何节点。
 */
function EntityGeometry(props: { entity: ViewportEntity }) {
  const { entity } = props;
  const [sx, sy, sz] = entity.size;

  if (entity.kind === 'sphere') {
    return <sphereGeometry args={[Math.max(sx, sy, sz) / 2, 32, 16]} />;
  }

  if (entity.kind === 'cylinder') {
    const radius = Math.max(sx, sz) / 2;
    return <cylinderGeometry args={[radius, radius, sy, 24]} />;
  }

  return <boxGeometry args={[sx, sy, sz]} />;
}

/**
 * 计算运行态场景包围盒。
 *
 * @param runtimeEntities 运行态实体。
 * @returns 场景包围盒。
 */
function computeRuntimeSceneBounds(runtimeEntities: RuntimeEntity[]): THREE.Box3 {
  const bounds = new THREE.Box3();

  runtimeEntities.forEach((runtimeEntity) => {
    const { entity, position, scale } = runtimeEntity;
    const [px, py, pz] = position;
    const scaledSize = tuple3(entity.size[0] * scale[0], entity.size[1] * scale[1], entity.size[2] * scale[2]);
    const halfSize = new THREE.Vector3(scaledSize[0] / 2, scaledSize[1] / 2, scaledSize[2] / 2);
    const center = new THREE.Vector3(px, py, pz);

    bounds.expandByPoint(center.clone().sub(halfSize));
    bounds.expandByPoint(center.clone().add(halfSize));
  });

  if (bounds.isEmpty()) {
    bounds.expandByPoint(new THREE.Vector3(-1, -1, -1));
    bounds.expandByPoint(new THREE.Vector3(1, 1, 1));
  }

  return bounds;
}

/**
 * 读取当前 Three 场景中的相机状态。
 *
 * @param camera 相机实例。
 * @param controls 控制器实例。
 * @returns 相机状态。
 */
function readCameraState(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsImpl,
): ViewportCameraState {
  return {
    position: tuple3(camera.position.x, camera.position.y, camera.position.z),
    target: tuple3(controls.target.x, controls.target.y, controls.target.z),
    fov: camera.fov,
    near: camera.near,
    far: camera.far,
  };
}

/**
 * 将相机状态应用到 Three 场景。
 *
 * @param camera 相机实例。
 * @param controls 控制器实例。
 * @param state 相机状态。
 */
function applyCameraState(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsImpl,
  state: ViewportCameraState,
) {
  camera.position.set(...state.position);
  camera.fov = state.fov;
  camera.near = state.near;
  camera.far = state.far;
  camera.updateProjectionMatrix();

  controls.target.set(...state.target);
  controls.update();
}

/**
 * 视口中的实体渲染。
 *
 * @param props 组件属性。
 * @returns 渲染节点。
 */
function ViewportEntities(props: {
  runtimeEntities: RuntimeEntity[];
  workMode: ViewportWorkMode;
  displayMode: ViewportDisplayMode;
  selectedEntityId: SelectedEntityId;
  onSelectEntity: (id: SelectedEntityId) => void;
  meshRefMap: MutableRefObject<Map<string, THREE.Mesh>>;
}) {
  const { runtimeEntities, workMode, displayMode, selectedEntityId, onSelectEntity, meshRefMap } = props;

  useFrame((_, delta) => {
    if (workMode !== 'runtime') {
      return;
    }

    meshRefMap.current.forEach((mesh) => {
      mesh.rotation.y += delta * 0.4;
    });
  });

  return (
    <>
      <Grid args={[40, 40]} cellSize={1} cellThickness={0.5} sectionSize={5} sectionThickness={1} fadeDistance={80} />
      <axesHelper args={[5]} />

      {runtimeEntities.map((runtimeEntity) => {
        const { entity, position, rotation, scale } = runtimeEntity;
        const [px, py, pz] = position;
        const [rx, ry, rz] = rotation;
        const isSelected = selectedEntityId === entity.id;
        const wireframe = displayMode === 'wireframe' || (isSelected && workMode === 'edit');
        const roughness = displayMode === 'rendered' ? 0.5 : 0.95;
        const metalness = displayMode === 'rendered' ? 0.2 : 0;

        return (
          <mesh
            key={entity.id}
            ref={(mesh) => {
              if (!mesh) {
                meshRefMap.current.delete(entity.id);
                return;
              }
              meshRefMap.current.set(entity.id, mesh);
            }}
            position={[px, py, pz]}
            rotation={[rx, ry, rz]}
            scale={scale}
            castShadow
            receiveShadow
            onClick={(event) => {
              if (workMode !== 'edit') {
                return;
              }
              event.stopPropagation();
              onSelectEntity(entity.id);
            }}
          >
            <EntityGeometry entity={entity} />
            <meshStandardMaterial
              color={entity.color}
              emissive={isSelected ? '#f59e0b' : '#000000'}
              emissiveIntensity={isSelected ? 0.35 : 0}
              roughness={roughness}
              metalness={metalness}
              wireframe={wireframe}
            />
          </mesh>
        );
      })}
    </>
  );
}

/**
 * 通用 3D 视口组件。
 *
 * @param props 组件属性。
 * @returns 3D 视口组件。
 */
export function Viewport3D(props: Viewport3DProps) {
  const {
    entities: inputEntities,
    miniMapEnabled,
    defaultMiniMapEnabled = false,
    miniMapMode = 'top-down',
    onMiniMapEnabledChange,
    selectedEntityId,
    defaultSelectedEntityId = null,
    onSelectedEntityIdChange,
    transformMode,
    defaultTransformMode = 'translate',
    onTransformModeChange,
    entityTransforms,
    defaultEntityTransforms,
    onEntityTransformsChange,
    cameraState,
    defaultCameraState,
    onCameraStateChange,
    workMode,
    defaultWorkMode = 'runtime',
    onWorkModeChange,
    displayMode,
    defaultDisplayMode = 'rendered',
    onDisplayModeChange,
    unrealRuntimeNavigation,
    defaultUnrealRuntimeNavigation,
    onUnrealRuntimeNavigationChange,
    modifierMiddlePresetEnabled,
    defaultModifierMiddlePresetEnabled,
    onModifierMiddlePresetEnabledChange,
    className,
  } = props;

  const entities = useMemo(() => inputEntities ?? createDemoEntities(), [inputEntities]);

  const [localMiniMapEnabled, setLocalMiniMapEnabled] = useState(defaultMiniMapEnabled);
  const [localSelectedEntityId, setLocalSelectedEntityId] = useState<SelectedEntityId>(
    normalizeSelectedEntityId(defaultSelectedEntityId),
  );
  const [localTransformMode, setLocalTransformMode] = useState<TransformMode>(defaultTransformMode);
  const [localEntityTransforms, setLocalEntityTransforms] = useState<EntityTransformMap>(
    defaultEntityTransforms ?? createInitialTransforms(entities),
  );
  const [localCameraState, setLocalCameraState] = useState<ViewportCameraState | null>(
    defaultCameraState ?? null,
  );
  const [localWorkMode, setLocalWorkMode] = useState<ViewportWorkMode>(defaultWorkMode);
  const [localDisplayMode, setLocalDisplayMode] = useState<ViewportDisplayMode>(defaultDisplayMode);
  const [localUnrealRuntimeNavigation, setLocalUnrealRuntimeNavigation] = useState<boolean>(
    defaultUnrealRuntimeNavigation ?? DEFAULT_RUNTIME_INTERACTION_OPTIONS.unrealRuntimeNavigation,
  );
  const [localModifierMiddlePresetEnabled, setLocalModifierMiddlePresetEnabled] = useState<boolean>(
    defaultModifierMiddlePresetEnabled ?? (DEFAULT_EDIT_INTERACTION_OPTIONS.controlPreset === 'modifier-middle'),
  );

  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRefMap = useRef<Map<string, THREE.Mesh>>(new Map());
  const isApplyingCameraStateRef = useRef(false);
  const isCustomMiddleActionRef = useRef(false);
  const isUnrealLookRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const runtimeTransforms = entityTransforms ?? localEntityTransforms;
  const runtimeEntities = useMemo(
    () => buildRuntimeEntities(entities, runtimeTransforms),
    [entities, runtimeTransforms],
  );
  const runtimeSceneBounds = useMemo(() => computeRuntimeSceneBounds(runtimeEntities), [runtimeEntities]);

  const isMiniMapEnabled = miniMapEnabled ?? localMiniMapEnabled;
  const activeSelectedEntityId = selectedEntityId ?? localSelectedEntityId;
  const activeWorkMode = workMode ?? localWorkMode;
  const activeDisplayMode = displayMode ?? localDisplayMode;
  const activeTransformMode = transformMode ?? localTransformMode;
  const activeCameraState = cameraState ?? localCameraState;
  const activeUnrealRuntimeNavigation = unrealRuntimeNavigation ?? localUnrealRuntimeNavigation;
  const activeModifierMiddlePresetEnabled = modifierMiddlePresetEnabled ?? localModifierMiddlePresetEnabled;
  const selectedMesh = activeSelectedEntityId ? meshRefMap.current.get(activeSelectedEntityId) ?? null : null;

  useEffect(() => {
    if (entityTransforms !== undefined) {
      return;
    }

    setLocalEntityTransforms((prev) => {
      const next = { ...createInitialTransforms(entities), ...prev };
      return next;
    });
  }, [entities, entityTransforms]);

  useEffect(() => {
    if (cameraState !== undefined || localCameraState !== null) {
      return;
    }

    setLocalCameraState(resolveCameraStateForBounds(runtimeSceneBounds));
  }, [cameraState, localCameraState, runtimeSceneBounds]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || !activeCameraState) {
      return;
    }

    isApplyingCameraStateRef.current = true;
    applyCameraState(camera, controls, activeCameraState);
    queueMicrotask(() => {
      isApplyingCameraStateRef.current = false;
    });
  }, [activeCameraState]);

  const setMiniMapEnabled = (enabled: boolean) => {
    if (miniMapEnabled === undefined) {
      setLocalMiniMapEnabled(enabled);
    }
    onMiniMapEnabledChange?.(enabled);
  };

  const setSelectedEntityId = (id: SelectedEntityId) => {
    if (selectedEntityId === undefined) {
      setLocalSelectedEntityId(id);
    }
    onSelectedEntityIdChange?.(id);
  };

  const setActiveTransformMode = (mode: TransformMode) => {
    if (transformMode === undefined) {
      setLocalTransformMode(mode);
    }
    onTransformModeChange?.(mode);
  };

  const setWorkModeValue = (mode: ViewportWorkMode) => {
    if (workMode === undefined) {
      setLocalWorkMode(mode);
    }
    onWorkModeChange?.(mode);
  };

  const setDisplayModeValue = (mode: ViewportDisplayMode) => {
    if (displayMode === undefined) {
      setLocalDisplayMode(mode);
    }
    onDisplayModeChange?.(mode);
  };

  const setUnrealRuntimeNavigationValue = (enabled: boolean) => {
    if (unrealRuntimeNavigation === undefined) {
      setLocalUnrealRuntimeNavigation(enabled);
    }
    onUnrealRuntimeNavigationChange?.(enabled);
  };

  const setModifierMiddlePresetEnabledValue = (enabled: boolean) => {
    if (modifierMiddlePresetEnabled === undefined) {
      setLocalModifierMiddlePresetEnabled(enabled);
    }
    onModifierMiddlePresetEnabledChange?.(enabled);
  };

  const setTransforms = (transforms: EntityTransformMap) => {
    if (entityTransforms === undefined) {
      setLocalEntityTransforms(transforms);
    }
    onEntityTransformsChange?.(transforms);
  };

  const setCameraStateValue = (nextState: ViewportCameraState) => {
    if (cameraState === undefined) {
      setLocalCameraState(nextState);
    }
    onCameraStateChange?.(nextState);
  };

  const applyCameraStateToScene = (nextState: ViewportCameraState): boolean => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return false;
    }

    isApplyingCameraStateRef.current = true;
    applyCameraState(camera, controls, nextState);
    queueMicrotask(() => {
      isApplyingCameraStateRef.current = false;
    });
    return true;
  };

  const syncCameraStateFromScene = () => {
    if (isApplyingCameraStateRef.current) {
      return;
    }

    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    setCameraStateValue(readCameraState(camera, controls));
  };

  const focusBounds = (bounds: THREE.Box3, paddingFactor = 1.3) => {
    const fallbackState = activeCameraState ?? resolveCameraStateForBounds(runtimeSceneBounds);
    const direction = new THREE.Vector3(
      fallbackState.position[0] - fallbackState.target[0],
      fallbackState.position[1] - fallbackState.target[1],
      fallbackState.position[2] - fallbackState.target[2],
    );

    if (direction.lengthSq() < 1e-6) {
      direction.set(1, 1, 1);
    }

    direction.normalize();

    const nextState = resolveCameraStateForBounds(bounds, {
      fov: fallbackState.fov,
      direction: tuple3(direction.x, direction.y, direction.z),
      paddingFactor,
    });

    setCameraStateValue(nextState);
    applyCameraStateToScene(nextState);
  };

  const resetCameraView = () => {
    focusBounds(runtimeSceneBounds, 1.35);
  };

  const focusSelectedEntity = () => {
    if (!activeSelectedEntityId) {
      return;
    }

    const mesh = meshRefMap.current.get(activeSelectedEntityId);
    const focusBoundsBox = new THREE.Box3();

    if (mesh) {
      focusBoundsBox.setFromObject(mesh);
    } else {
      const runtimeEntity = runtimeEntities.find((item) => item.entity.id === activeSelectedEntityId);
      if (!runtimeEntity) {
        return;
      }

      const { entity, position, scale } = runtimeEntity;
      const [px, py, pz] = position;
      const half = new THREE.Vector3(
        (entity.size[0] * scale[0]) / 2,
        (entity.size[1] * scale[1]) / 2,
        (entity.size[2] * scale[2]) / 2,
      );
      const center = new THREE.Vector3(px, py, pz);
      focusBoundsBox.expandByPoint(center.clone().sub(half));
      focusBoundsBox.expandByPoint(center.clone().add(half));
    }

    if (focusBoundsBox.isEmpty()) {
      return;
    }

    focusBounds(focusBoundsBox, 1.2);
  };

  const zoomCamera = (factor: number) => {
    const baseState = activeCameraState ?? resolveCameraStateForBounds(runtimeSceneBounds);
    const nextState = zoomViewportCameraState(baseState, { factor, minDistance: 1.5 });
    setCameraStateValue(nextState);
    applyCameraStateToScene(nextState);
  };

  const applyUnrealLookDelta = (deltaX: number, deltaY: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    applyUnrealLookToCamera(camera, controls.target, { deltaX, deltaY });
    controls.update();
    syncCameraStateFromScene();
  };

  const applyModifierMiddleAction = (deltaX: number, deltaY: number, event: ReactPointerEvent<HTMLElement>) => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls) {
      return;
    }

    if (event.altKey) {
      const factor = resolveModifierMiddleZoomFactor(deltaY);
      zoomCamera(factor);
      return;
    }

    if (event.ctrlKey) {
      if (!camera) {
        return;
      }

      applyModifierMiddleOrbitToCamera(camera, controls.target, { deltaX, deltaY });
      controls.update();
      syncCameraStateFromScene();
    }
  };

  const handlePointerDownCapture = (event: ReactPointerEvent<HTMLElement>) => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    lastPointerRef.current = { x: event.clientX, y: event.clientY };

    const inputContext = {
      workMode: activeWorkMode,
      unrealRuntimeNavigation: activeUnrealRuntimeNavigation,
      modifierMiddlePresetEnabled: activeModifierMiddlePresetEnabled,
      button: event.button,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
    };

    if (shouldStartUnrealLook(inputContext)) {
      isUnrealLookRef.current = true;
      controls.enabled = false;
      event.preventDefault();
      return;
    }

    if (shouldStartModifierMiddleAction(inputContext)) {
      isCustomMiddleActionRef.current = true;
      controls.enabled = false;
      event.preventDefault();
    }
  };

  const handlePointerMoveCapture = (event: ReactPointerEvent<HTMLElement>) => {
    const prev = lastPointerRef.current;
    const deltaX = event.clientX - prev.x;
    const deltaY = event.clientY - prev.y;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };

    if (isUnrealLookRef.current) {
      event.preventDefault();
      applyUnrealLookDelta(deltaX, deltaY);
      return;
    }

    if (isCustomMiddleActionRef.current) {
      event.preventDefault();
      applyModifierMiddleAction(deltaX, deltaY, event);
    }
  };

  const handlePointerUpCapture = () => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    if (isUnrealLookRef.current || isCustomMiddleActionRef.current) {
      controls.enabled = true;
    }

    isUnrealLookRef.current = false;
    isCustomMiddleActionRef.current = false;
  };

  const handleKeyDownCapture = (event: React.KeyboardEvent<HTMLElement>) => {
    if (activeWorkMode !== 'edit') {
      return;
    }

    const nextTransformMode = resolveTransformModeByKey(event.key);
    if (nextTransformMode) {
      setActiveTransformMode(nextTransformMode);
      return;
    }
    if (event.key === 'z' || event.key === 'Z') {
      const next = cycleDisplayMode(activeDisplayMode);
      setDisplayModeValue(next);
    }
  };

  const orbitMouseButtons = useMemo(() => {
    const bindings = resolveOrbitMouseBindings(
      activeWorkMode,
      activeUnrealRuntimeNavigation,
      activeModifierMiddlePresetEnabled,
    );
    return {
      LEFT: mapOrbitActionToThreeMouse(bindings.left),
      MIDDLE: mapOrbitActionToThreeMouse(bindings.middle),
      RIGHT: mapOrbitActionToThreeMouse(bindings.right),
    } as const;
  }, [activeWorkMode, activeUnrealRuntimeNavigation, activeModifierMiddlePresetEnabled]);

  const updateSelectedTransformFromMesh = () => {
    if (activeWorkMode !== 'edit') {
      return;
    }
    if (!activeSelectedEntityId) {
      return;
    }

    const mesh = meshRefMap.current.get(activeSelectedEntityId);
    if (!mesh) {
      return;
    }

    const nextTransforms: EntityTransformMap = {
      ...runtimeTransforms,
      [activeSelectedEntityId]: {
        position: [mesh.position.x, mesh.position.y, mesh.position.z],
        rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
        scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z],
      },
    };

    setTransforms(nextTransforms);
  };

  return (
    <Viewport3DContextMenu
      workMode={activeWorkMode}
      onWorkModeChange={setWorkModeValue}
      displayMode={activeDisplayMode}
      onDisplayModeChange={setDisplayModeValue}
      unrealRuntimeNavigation={activeUnrealRuntimeNavigation}
      onUnrealRuntimeNavigationChange={setUnrealRuntimeNavigationValue}
      modifierMiddlePresetEnabled={activeModifierMiddlePresetEnabled}
      onModifierMiddlePresetEnabledChange={setModifierMiddlePresetEnabledValue}
      transformMode={activeTransformMode}
      onTransformModeChange={setActiveTransformMode}
      miniMapEnabled={isMiniMapEnabled}
      onMiniMapEnabledChange={setMiniMapEnabled}
      onZoomIn={() => zoomCamera(0.82)}
      onZoomOut={() => zoomCamera(1.2)}
      onResetCamera={resetCameraView}
      onFocusSelection={focusSelectedEntity}
      canFocusSelection={Boolean(activeSelectedEntityId)}
      onClearSelection={() => setSelectedEntityId(null)}
    >
      <section
        className={`vk-viewport ${className ?? ''}`.trim()}
        tabIndex={0}
        onPointerDownCapture={handlePointerDownCapture}
        onPointerMoveCapture={handlePointerMoveCapture}
        onPointerUpCapture={handlePointerUpCapture}
        onPointerCancelCapture={handlePointerUpCapture}
        onContextMenu={(event) => {
          if (shouldBlockContextMenu(activeWorkMode, activeUnrealRuntimeNavigation, event.shiftKey)) {
            event.preventDefault();
          }
        }}
        onKeyDownCapture={handleKeyDownCapture}
      >
        <Canvas
          shadows={activeDisplayMode === 'rendered'}
          camera={{ position: [6, 6, 8], fov: 50, near: 0.1, far: 1000 }}
          onCreated={({ camera }) => {
            cameraRef.current = camera as THREE.PerspectiveCamera;
            const initialState = activeCameraState ?? resolveCameraStateForBounds(runtimeSceneBounds);
            applyCameraStateToScene(initialState);
            if (!activeCameraState) {
              setCameraStateValue(initialState);
            }
          }}
          onPointerMissed={() => {
            if (activeWorkMode === 'edit') {
              setSelectedEntityId(null);
            }
          }}
        >
          <ambientLight intensity={activeDisplayMode === 'rendered' ? 0.65 : 0.92} />
          <directionalLight
            position={[10, 14, 8]}
            intensity={activeDisplayMode === 'rendered' ? 1.1 : 0.65}
            castShadow={activeDisplayMode === 'rendered'}
          />

          <ViewportEntities
            runtimeEntities={runtimeEntities}
            workMode={activeWorkMode}
            displayMode={activeDisplayMode}
            selectedEntityId={activeSelectedEntityId}
            onSelectEntity={setSelectedEntityId}
            meshRefMap={meshRefMap}
          />

          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.08}
            mouseButtons={orbitMouseButtons}
            onChange={syncCameraStateFromScene}
          />

          {activeWorkMode === 'edit' && selectedMesh ? (
            <TransformControls
              object={selectedMesh}
              mode={activeTransformMode}
              onMouseDown={() => {
                const controls = controlsRef.current;
                if (controls) {
                  controls.enabled = false;
                }
              }}
              onMouseUp={() => {
                const controls = controlsRef.current;
                if (controls) {
                  controls.enabled = true;
                }
                updateSelectedTransformFromMesh();
                syncCameraStateFromScene();
              }}
              onObjectChange={updateSelectedTransformFromMesh}
            />
          ) : null}
        </Canvas>

        <div className="vk-overlay">
          <Viewport3DToolbar
            workMode={activeWorkMode}
            onWorkModeChange={setWorkModeValue}
            displayMode={activeDisplayMode}
            onDisplayModeChange={setDisplayModeValue}
            unrealRuntimeNavigation={activeUnrealRuntimeNavigation}
            onUnrealRuntimeNavigationChange={setUnrealRuntimeNavigationValue}
            modifierMiddlePresetEnabled={activeModifierMiddlePresetEnabled}
            onModifierMiddlePresetEnabledChange={setModifierMiddlePresetEnabledValue}
            transformMode={activeTransformMode}
            onTransformModeChange={setActiveTransformMode}
            miniMapEnabled={isMiniMapEnabled}
            onMiniMapEnabledChange={setMiniMapEnabled}
            selectedEntityId={activeSelectedEntityId}
            onZoomIn={() => zoomCamera(0.82)}
            onZoomOut={() => zoomCamera(1.2)}
            onResetCamera={resetCameraView}
            onFocusSelection={focusSelectedEntity}
          />
        </div>

        <MiniMap3D
          enabled={isMiniMapEnabled}
          entities={runtimeEntities.map((runtimeEntity) => {
            const { entity, position, rotation, scale } = runtimeEntity;
            return {
              ...entity,
              position,
              rotation,
              size: tuple3(
                entity.size[0] * scale[0],
                entity.size[1] * scale[1],
                entity.size[2] * scale[2],
              ),
            };
          })}
          mode={miniMapMode}
        />
      </section>
    </Viewport3DContextMenu>
  );
}
