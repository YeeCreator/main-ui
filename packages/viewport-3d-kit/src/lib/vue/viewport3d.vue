<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  resolveCameraStateForBounds,
  zoomViewportCameraState,
  type ViewportCameraState,
} from '../core/camera';
import type { TransformMode } from '../core/gizmo';
import { normalizeSelectedEntityId, type SelectedEntityId } from '../core/selection';
import { createDemoEntities, type ViewportEntity } from '../core/scene';
import {
  applyModifierMiddleOrbitToCamera,
  applyUnrealLookToCamera,
  cycleDisplayMode,
  DEFAULT_EDIT_INTERACTION_OPTIONS,
  DEFAULT_RUNTIME_INTERACTION_OPTIONS,
  hasMeaningfulPointerMove,
  resolveModifierMiddleZoomFactor,
  resolveOrbitMouseBindings,
  resolveTransformModeByKey,
  shouldBlockContextMenu,
  shouldStartModifierMiddleAction,
  shouldStartUnrealLook,
  type ViewportDisplayMode,
  type ViewportWorkMode,
} from '../core/viewport';
import type { EntityTransformMap, EntityTransformState, Viewport3DVueProps } from './types';
import Viewport3DMenu from './components/viewport3d-menu.vue';
import Viewport3DMiniMap from './components/viewport3d-mini-map.vue';

interface RuntimeEntity {
  entity: ViewportEntity;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

const props = withDefaults(defineProps<Viewport3DVueProps>(), {
  defaultMiniMapEnabled: false,
  defaultSelectedEntityId: null,
  defaultTransformMode: 'translate',
  defaultWorkMode: 'runtime',
  defaultDisplayMode: 'rendered',
});

const emit = defineEmits<{
  (e: 'update:miniMapEnabled', value: boolean): void;
  (e: 'update:selectedEntityId', value: SelectedEntityId): void;
  (e: 'update:transformMode', value: TransformMode): void;
  (e: 'update:entityTransforms', value: EntityTransformMap): void;
  (e: 'update:cameraState', value: ViewportCameraState): void;
  (e: 'update:workMode', value: ViewportWorkMode): void;
  (e: 'update:displayMode', value: ViewportDisplayMode): void;
  (e: 'update:unrealRuntimeNavigation', value: boolean): void;
  (e: 'update:modifierMiddlePresetEnabled', value: boolean): void;
}>();

function tuple3(x: number, y: number, z: number): [number, number, number] {
  return [x, y, z];
}

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

function readCameraState(camera: THREE.PerspectiveCamera, controls: OrbitControls): ViewportCameraState {
  return {
    position: tuple3(camera.position.x, camera.position.y, camera.position.z),
    target: tuple3(controls.target.x, controls.target.y, controls.target.z),
    fov: camera.fov,
    near: camera.near,
    far: camera.far,
  };
}

function applyCameraState(camera: THREE.PerspectiveCamera, controls: OrbitControls, state: ViewportCameraState) {
  camera.position.set(...state.position);
  camera.fov = state.fov;
  camera.near = state.near;
  camera.far = state.far;
  camera.updateProjectionMatrix();
  controls.target.set(...state.target);
  controls.update();
}

function createEntityGeometry(entity: ViewportEntity): THREE.BufferGeometry {
  const [sx, sy, sz] = entity.size;
  if (entity.kind === 'sphere') {
    return new THREE.SphereGeometry(Math.max(sx, sy, sz) / 2, 32, 16);
  }
  if (entity.kind === 'cylinder') {
    const radius = Math.max(sx, sz) / 2;
    return new THREE.CylinderGeometry(radius, radius, sy, 24);
  }
  return new THREE.BoxGeometry(sx, sy, sz);
}

const containerRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const miniCanvasRef = ref<HTMLCanvasElement | null>(null);

const localState = reactive({
  miniMapEnabled: props.defaultMiniMapEnabled,
  selectedEntityId: normalizeSelectedEntityId(props.defaultSelectedEntityId),
  transformMode: props.defaultTransformMode as TransformMode,
  entityTransforms: {} as EntityTransformMap,
  cameraState: props.defaultCameraState ?? null,
  workMode: props.defaultWorkMode as ViewportWorkMode,
  displayMode: props.defaultDisplayMode as ViewportDisplayMode,
  unrealRuntimeNavigation:
    props.defaultUnrealRuntimeNavigation ?? DEFAULT_RUNTIME_INTERACTION_OPTIONS.unrealRuntimeNavigation,
  modifierMiddlePresetEnabled:
    props.defaultModifierMiddlePresetEnabled ??
    (DEFAULT_EDIT_INTERACTION_OPTIONS.controlPreset === 'modifier-middle'),
});

const entities = computed(() => props.entities ?? createDemoEntities());

watch(
  entities,
  (nextEntities) => {
    if (props.entityTransforms !== undefined) {
      return;
    }
    localState.entityTransforms = {
      ...createInitialTransforms(nextEntities),
      ...localState.entityTransforms,
    };
  },
  { immediate: true },
);

const activeMiniMapEnabled = computed(() => props.miniMapEnabled ?? localState.miniMapEnabled);
const activeSelectedEntityId = computed(() => props.selectedEntityId ?? localState.selectedEntityId);
const activeTransformMode = computed(() => props.transformMode ?? localState.transformMode);
const activeEntityTransforms = computed(() => props.entityTransforms ?? localState.entityTransforms);
const activeCameraState = computed(() => props.cameraState ?? localState.cameraState);
const activeWorkMode = computed(() => props.workMode ?? localState.workMode);
const activeDisplayMode = computed(() => props.displayMode ?? localState.displayMode);
const activeUnrealRuntimeNavigation = computed(
  () => props.unrealRuntimeNavigation ?? localState.unrealRuntimeNavigation,
);
const activeModifierMiddlePresetEnabled = computed(
  () => props.modifierMiddlePresetEnabled ?? localState.modifierMiddlePresetEnabled,
);
const containerClassName = computed(() => props.className ?? '');

const runtimeEntities = computed(() => buildRuntimeEntities(entities.value, activeEntityTransforms.value));
const runtimeSceneBounds = computed(() => computeRuntimeSceneBounds(runtimeEntities.value));

let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let controls: OrbitControls | null = null;
let transformControls: TransformControls | null = null;
let transformControlsHelper: THREE.Object3D | null = null;
let ambientLight: THREE.AmbientLight | null = null;
let directionalLight: THREE.DirectionalLight | null = null;
let gridHelper: THREE.GridHelper | null = null;
let axesHelper: THREE.AxesHelper | null = null;
let miniRenderer: THREE.WebGLRenderer | null = null;
let miniCamera: THREE.PerspectiveCamera | null = null;
let animationId = 0;
let lastFrameTime = 0;

const meshMap = new Map<string, THREE.Mesh>();
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();

let isApplyingCameraState = false;
let isUnrealLook = false;
let isCustomMiddleAction = false;
let hasPointerMoved = false;
let lastPointer = { x: 0, y: 0 };

function setMiniMapEnabled(value: boolean) {
  if (props.miniMapEnabled === undefined) {
    localState.miniMapEnabled = value;
  }
  emit('update:miniMapEnabled', value);
}

function setSelectedEntityId(value: SelectedEntityId) {
  if (props.selectedEntityId === undefined) {
    localState.selectedEntityId = value;
  }
  emit('update:selectedEntityId', value);
}

function setTransformMode(value: TransformMode) {
  if (props.transformMode === undefined) {
    localState.transformMode = value;
  }
  emit('update:transformMode', value);
}

function setEntityTransforms(value: EntityTransformMap) {
  if (props.entityTransforms === undefined) {
    localState.entityTransforms = value;
  }
  emit('update:entityTransforms', value);
}

function setCameraStateValue(value: ViewportCameraState) {
  if (props.cameraState === undefined) {
    localState.cameraState = value;
  }
  emit('update:cameraState', value);
}

function setWorkMode(value: ViewportWorkMode) {
  if (props.workMode === undefined) {
    localState.workMode = value;
  }
  emit('update:workMode', value);
}

function setDisplayMode(value: ViewportDisplayMode) {
  if (props.displayMode === undefined) {
    localState.displayMode = value;
  }
  emit('update:displayMode', value);
}

function setUnrealRuntimeNavigation(value: boolean) {
  if (props.unrealRuntimeNavigation === undefined) {
    localState.unrealRuntimeNavigation = value;
  }
  emit('update:unrealRuntimeNavigation', value);
}

function setModifierMiddlePresetEnabled(value: boolean) {
  if (props.modifierMiddlePresetEnabled === undefined) {
    localState.modifierMiddlePresetEnabled = value;
  }
  emit('update:modifierMiddlePresetEnabled', value);
}

function applyCameraStateToScene(nextState: ViewportCameraState): boolean {
  if (!camera || !controls) {
    return false;
  }
  isApplyingCameraState = true;
  applyCameraState(camera, controls, nextState);
  queueMicrotask(() => {
    isApplyingCameraState = false;
  });
  return true;
}

function syncCameraStateFromScene() {
  if (isApplyingCameraState || !camera || !controls) {
    return;
  }
  setCameraStateValue(readCameraState(camera, controls));
}

function focusBounds(bounds: THREE.Box3, paddingFactor = 1.3) {
  const fallbackState = activeCameraState.value ?? resolveCameraStateForBounds(runtimeSceneBounds.value);
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
}

function resetCameraView() {
  focusBounds(runtimeSceneBounds.value, 1.35);
}

function focusSelection() {
  const selectedId = activeSelectedEntityId.value;
  if (!selectedId) {
    return;
  }

  const mesh = meshMap.get(selectedId);
  const focusBoundsBox = new THREE.Box3();

  if (mesh) {
    focusBoundsBox.setFromObject(mesh);
  } else {
    const runtimeEntity = runtimeEntities.value.find((item) => item.entity.id === selectedId);
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

  if (!focusBoundsBox.isEmpty()) {
    focusBounds(focusBoundsBox, 1.2);
  }
}

function zoomCamera(factor: number) {
  const baseState = activeCameraState.value ?? resolveCameraStateForBounds(runtimeSceneBounds.value);
  const nextState = zoomViewportCameraState(baseState, { factor, minDistance: 1.5 });
  setCameraStateValue(nextState);
  applyCameraStateToScene(nextState);
}

function applyUnrealLookDelta(deltaX: number, deltaY: number) {
  if (!camera || !controls) {
    return;
  }

  applyUnrealLookToCamera(camera, controls.target, { deltaX, deltaY });
  controls.update();
  syncCameraStateFromScene();
}

function applyModifierMiddleAction(deltaX: number, deltaY: number, event: PointerEvent) {
  if (!controls || !camera) {
    return;
  }

  if (event.altKey) {
    const factor = resolveModifierMiddleZoomFactor(deltaY);
    zoomCamera(factor);
    return;
  }

  if (event.ctrlKey) {
    applyModifierMiddleOrbitToCamera(camera, controls.target, { deltaX, deltaY });
    controls.update();
    syncCameraStateFromScene();
  }
}

function updateOrbitMouseButtons() {
  if (!controls) {
    return;
  }

  const bindings = resolveOrbitMouseBindings(
    activeWorkMode.value,
    activeUnrealRuntimeNavigation.value,
    activeModifierMiddlePresetEnabled.value,
  );

  controls.mouseButtons.LEFT =
    bindings.left === 'pan'
      ? THREE.MOUSE.PAN
      : bindings.left === 'dolly'
        ? THREE.MOUSE.DOLLY
        : THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE =
    bindings.middle === 'pan'
      ? THREE.MOUSE.PAN
      : bindings.middle === 'dolly'
        ? THREE.MOUSE.DOLLY
        : THREE.MOUSE.ROTATE;
  controls.mouseButtons.RIGHT =
    bindings.right === 'pan'
      ? THREE.MOUSE.PAN
      : bindings.right === 'dolly'
        ? THREE.MOUSE.DOLLY
        : THREE.MOUSE.ROTATE;
}

function updateSelectedTransformFromMesh() {
  if (activeWorkMode.value !== 'edit') {
    return;
  }

  const selectedId = activeSelectedEntityId.value;
  if (!selectedId) {
    return;
  }

  const mesh = meshMap.get(selectedId);
  if (!mesh) {
    return;
  }

  setEntityTransforms({
    ...activeEntityTransforms.value,
    [selectedId]: {
      position: [mesh.position.x, mesh.position.y, mesh.position.z],
      rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
      scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z],
    },
  });
}

function syncSceneEntities() {
  if (!scene) {
    return;
  }

  const liveIds = new Set(runtimeEntities.value.map((item) => item.entity.id));
  meshMap.forEach((mesh, id) => {
    if (liveIds.has(id)) {
      return;
    }
    scene?.remove(mesh);
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    } else {
      mesh.material.dispose();
    }
    meshMap.delete(id);
  });

  runtimeEntities.value.forEach((runtimeEntity) => {
    const { entity, position, rotation, scale } = runtimeEntity;
    const selected = activeSelectedEntityId.value === entity.id;
    const wireframe = activeDisplayMode.value === 'wireframe' || (selected && activeWorkMode.value === 'edit');
    const roughness = activeDisplayMode.value === 'rendered' ? 0.5 : 0.95;
    const metalness = activeDisplayMode.value === 'rendered' ? 0.2 : 0;

    let mesh = meshMap.get(entity.id);
    if (!mesh) {
      const material = new THREE.MeshStandardMaterial({ color: entity.color });
      mesh = new THREE.Mesh(createEntityGeometry(entity), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.entityId = entity.id;
      meshMap.set(entity.id, mesh);
      scene?.add(mesh);
    }

    const [px, py, pz] = position;
    const [rx, ry, rz] = rotation;
    mesh.position.set(px, py, pz);
    mesh.rotation.set(rx, ry, rz);
    mesh.scale.set(...scale);

    const material = mesh.material as THREE.MeshStandardMaterial;
    material.color.set(entity.color);
    material.wireframe = wireframe;
    material.roughness = roughness;
    material.metalness = metalness;
    material.emissive.set(selected ? '#f59e0b' : '#000000');
    material.emissiveIntensity = selected ? 0.35 : 0;
  });

  if (ambientLight && directionalLight) {
    ambientLight.intensity = activeDisplayMode.value === 'rendered' ? 0.65 : 0.92;
    directionalLight.intensity = activeDisplayMode.value === 'rendered' ? 1.1 : 0.65;
    directionalLight.castShadow = activeDisplayMode.value === 'rendered';
  }

  if (renderer) {
    renderer.shadowMap.enabled = activeDisplayMode.value === 'rendered';
  }

  if (transformControls) {
    transformControls.setMode(activeTransformMode.value);
    const selectedMesh = activeSelectedEntityId.value ? meshMap.get(activeSelectedEntityId.value) ?? null : null;
    if (activeWorkMode.value === 'edit' && selectedMesh) {
      transformControls.attach(selectedMesh);
      if (transformControlsHelper) {
        transformControlsHelper.visible = true;
      }
    } else {
      transformControls.detach();
      if (transformControlsHelper) {
        transformControlsHelper.visible = false;
      }
    }
  }

  updateOrbitMouseButtons();
}

function resizeRenderer() {
  if (!containerRef.value || !renderer || !camera) {
    return;
  }

  const rect = containerRef.value.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  if (miniRenderer && miniCanvasRef.value) {
    const miniRect = miniCanvasRef.value.getBoundingClientRect();
    const miniW = Math.max(1, Math.floor(miniRect.width));
    const miniH = Math.max(1, Math.floor(miniRect.height));
    miniRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    miniRenderer.setSize(miniW, miniH, false);
    if (miniCamera) {
      miniCamera.aspect = miniW / miniH;
      miniCamera.updateProjectionMatrix();
    }
  }
}

function pickEntity(clientX: number, clientY: number) {
  if (!renderer || !camera || activeWorkMode.value !== 'edit') {
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);

  const intersects = raycaster.intersectObjects(Array.from(meshMap.values()), false);
  if (intersects.length === 0) {
    setSelectedEntityId(null);
    return;
  }

  const pickedId = intersects[0].object.userData.entityId as string | undefined;
  if (!pickedId) {
    setSelectedEntityId(null);
    return;
  }
  setSelectedEntityId(pickedId);
}

function onPointerDown(event: PointerEvent) {
  lastPointer = { x: event.clientX, y: event.clientY };
  hasPointerMoved = false;

  if (!controls) {
    return;
  }

  const inputContext = {
    workMode: activeWorkMode.value,
    unrealRuntimeNavigation: activeUnrealRuntimeNavigation.value,
    modifierMiddlePresetEnabled: activeModifierMiddlePresetEnabled.value,
    button: event.button,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
  };

  if (shouldStartUnrealLook(inputContext)) {
    isUnrealLook = true;
    controls.enabled = false;
    event.preventDefault();
    return;
  }

  if (shouldStartModifierMiddleAction(inputContext)) {
    isCustomMiddleAction = true;
    controls.enabled = false;
    event.preventDefault();
  }
}

function onPointerMove(event: PointerEvent) {
  const deltaX = event.clientX - lastPointer.x;
  const deltaY = event.clientY - lastPointer.y;

  if (hasMeaningfulPointerMove(deltaX, deltaY)) {
    hasPointerMoved = true;
  }

  lastPointer = { x: event.clientX, y: event.clientY };

  if (isUnrealLook) {
    event.preventDefault();
    applyUnrealLookDelta(deltaX, deltaY);
    return;
  }

  if (isCustomMiddleAction) {
    event.preventDefault();
    applyModifierMiddleAction(deltaX, deltaY, event);
  }
}

function onPointerUp(event: PointerEvent) {
  if (controls && (isUnrealLook || isCustomMiddleAction)) {
    controls.enabled = true;
  }

  if (!hasPointerMoved && event.button === 0) {
    pickEntity(event.clientX, event.clientY);
  }

  isUnrealLook = false;
  isCustomMiddleAction = false;
}

function onKeyDown(event: KeyboardEvent) {
  if (activeWorkMode.value !== 'edit') {
    return;
  }

  const nextTransformMode = resolveTransformModeByKey(event.key);
  if (nextTransformMode) {
    setTransformMode(nextTransformMode);
    return;
  }
  if (event.key === 'z' || event.key === 'Z') {
    const next = cycleDisplayMode(activeDisplayMode.value);
    setDisplayMode(next);
  }
}

function renderMiniMap() {
  if (!activeMiniMapEnabled.value || !miniRenderer || !miniCamera || !camera || !scene) {
    return;
  }

  const bounds = runtimeSceneBounds.value;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z, 10);

  miniCamera.position.set(center.x, center.y + span, center.z + 0.001);
  miniCamera.lookAt(center.x, center.y, center.z);
  miniRenderer.render(scene, miniCamera);
}

function animate() {
  animationId = window.requestAnimationFrame(animate);
  const now = performance.now();
  const delta = Math.max(0, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  if (activeWorkMode.value === 'runtime') {
    meshMap.forEach((mesh) => {
      mesh.rotation.y += delta * 0.4;
    });
  }

  controls?.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  renderMiniMap();
}

onMounted(() => {
  if (!canvasRef.value || !containerRef.value) {
    return;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#f8fafc');

  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true });

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.addEventListener('change', syncCameraStateFromScene);

  transformControls = new TransformControls(camera, renderer.domElement);
  transformControlsHelper = transformControls.getHelper();
  transformControlsHelper.visible = false;
  transformControls.addEventListener('dragging-changed', (event) => {
    if (!controls) {
      return;
    }
    controls.enabled = !event.value;
  });
  transformControls.addEventListener('objectChange', () => {
    updateSelectedTransformFromMesh();
    syncCameraStateFromScene();
  });
  scene.add(transformControlsHelper);

  ambientLight = new THREE.AmbientLight('#ffffff', 0.92);
  directionalLight = new THREE.DirectionalLight('#ffffff', 0.65);
  directionalLight.position.set(10, 14, 8);
  scene.add(ambientLight);
  scene.add(directionalLight);

  gridHelper = new THREE.GridHelper(40, 40, '#94a3b8', '#cbd5e1');
  axesHelper = new THREE.AxesHelper(5);
  scene.add(gridHelper);
  scene.add(axesHelper);

  if (miniCanvasRef.value) {
    miniRenderer = new THREE.WebGLRenderer({ canvas: miniCanvasRef.value, antialias: true });
    miniCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  }

  syncSceneEntities();
  lastFrameTime = performance.now();

  const initialState = activeCameraState.value ?? resolveCameraStateForBounds(runtimeSceneBounds.value);
  applyCameraStateToScene(initialState);
  if (!activeCameraState.value) {
    setCameraStateValue(initialState);
  }

  resizeRenderer();
  animate();

  window.addEventListener('resize', resizeRenderer);
  containerRef.value.addEventListener('pointerdown', onPointerDown);
  containerRef.value.addEventListener('pointermove', onPointerMove);
  containerRef.value.addEventListener('pointerup', onPointerUp);
  containerRef.value.addEventListener('pointercancel', onPointerUp);
  containerRef.value.addEventListener('keydown', onKeyDown);
  containerRef.value.addEventListener('contextmenu', (event) => {
    if (shouldBlockContextMenu(activeWorkMode.value, activeUnrealRuntimeNavigation.value, event.shiftKey)) {
      event.preventDefault();
    }
  });
});

onBeforeUnmount(() => {
  if (containerRef.value) {
    containerRef.value.removeEventListener('pointerdown', onPointerDown);
    containerRef.value.removeEventListener('pointermove', onPointerMove);
    containerRef.value.removeEventListener('pointerup', onPointerUp);
    containerRef.value.removeEventListener('pointercancel', onPointerUp);
    containerRef.value.removeEventListener('keydown', onKeyDown);
  }

  window.removeEventListener('resize', resizeRenderer);
  window.cancelAnimationFrame(animationId);

  controls?.dispose();
  transformControls?.dispose();
  transformControlsHelper = null;
  renderer?.dispose();
  miniRenderer?.dispose();

  meshMap.forEach((mesh) => {
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => material.dispose());
    } else {
      mesh.material.dispose();
    }
  });
  meshMap.clear();
});

watch(runtimeEntities, () => {
  syncSceneEntities();
}, { deep: true });

watch(activeDisplayMode, () => {
  syncSceneEntities();
});

watch(activeSelectedEntityId, () => {
  syncSceneEntities();
});

watch(activeWorkMode, () => {
  syncSceneEntities();
});

watch(activeTransformMode, () => {
  if (transformControls) {
    transformControls.setMode(activeTransformMode.value);
  }
});

watch(activeUnrealRuntimeNavigation, () => {
  updateOrbitMouseButtons();
});

watch(activeModifierMiddlePresetEnabled, () => {
  updateOrbitMouseButtons();
});

watch(
  activeCameraState,
  (nextState) => {
    if (!nextState) {
      return;
    }
    applyCameraStateToScene(nextState);
  },
  { deep: true },
);
</script>

<template>
  <section ref="containerRef" :class="['vk-viewport', containerClassName]" tabindex="0">
    <canvas ref="canvasRef" class="vk-main-canvas" />

    <Viewport3DMenu
      :work-mode="activeWorkMode"
      :display-mode="activeDisplayMode"
      :transform-mode="activeTransformMode"
      :selected-entity-id="activeSelectedEntityId"
      :unreal-runtime-navigation="activeUnrealRuntimeNavigation"
      :modifier-middle-preset-enabled="activeModifierMiddlePresetEnabled"
      :mini-map-enabled="activeMiniMapEnabled"
      @update:work-mode="setWorkMode"
      @update:display-mode="setDisplayMode"
      @update:transform-mode="setTransformMode"
      @update:selected-entity-id="setSelectedEntityId"
      @update:unreal-runtime-navigation="setUnrealRuntimeNavigation"
      @update:modifier-middle-preset-enabled="setModifierMiddlePresetEnabled"
      @update:mini-map-enabled="setMiniMapEnabled"
      @zoom-in="zoomCamera(0.82)"
      @zoom-out="zoomCamera(1.2)"
      @reset-view="resetCameraView"
      @focus-selection="focusSelection"
    />

    <Viewport3DMiniMap :enabled="activeMiniMapEnabled">
      <canvas ref="miniCanvasRef" class="vk-mini-canvas" />
    </Viewport3DMiniMap>
  </section>
</template>

<style scoped>
.vk-main-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
