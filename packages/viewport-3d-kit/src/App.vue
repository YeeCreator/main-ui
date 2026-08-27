<script setup lang="ts">
import { computed, ref } from 'vue';
import { Viewport3D } from './lib/vue';
import { createDemoEntities } from './lib/core/scene';
import type { SelectedEntityId } from './lib/core/selection';
import type { TransformMode } from './lib/core/gizmo';
import type { ViewportCameraState } from './lib/core/camera';
import type { ViewportDisplayMode, ViewportWorkMode } from './lib/core/viewport';
import type { EntityTransformMap } from './lib/vue';

const entities = computed(() => createDemoEntities());

const miniMapEnabled = ref(false);
const selectedEntityId = ref<SelectedEntityId>(null);
const transformMode = ref<TransformMode>('translate');
const entityTransforms = ref<EntityTransformMap>({});
const cameraState = ref<ViewportCameraState | null>(null);
const workMode = ref<ViewportWorkMode>('runtime');
const displayMode = ref<ViewportDisplayMode>('rendered');
const unrealRuntimeNavigation = ref(true);
const modifierMiddlePresetEnabled = ref(false);
</script>

<template>
  <main class="app-root">
    <h1 class="app-title">viewport-3d-kit (Core + Vue3)</h1>
    <p class="app-description">当前示例展示 Core + Vue3 主结构，React 作为兼容层保留。</p>

    <div class="app-row app-camera-row">
      <span>工作模式：{{ workMode === 'runtime' ? '运行' : '编辑' }}</span>
      <span>显示模式：{{ displayMode }}</span>
      <span>选中对象：{{ selectedEntityId ?? '无' }}</span>
    </div>

    <div class="app-row app-camera-row">
      <span>
        当前相机位置：
        {{
          cameraState
            ? `${cameraState.position[0].toFixed(2)}, ${cameraState.position[1].toFixed(2)}, ${cameraState.position[2].toFixed(2)}`
            : '初始化中'
        }}
      </span>
    </div>

    <Viewport3D
      class-name="app-viewport"
      :entities="entities"
      :mini-map-enabled="miniMapEnabled"
      :selected-entity-id="selectedEntityId"
      :transform-mode="transformMode"
      :entity-transforms="entityTransforms"
      :camera-state="cameraState ?? undefined"
      :work-mode="workMode"
      :display-mode="displayMode"
      :unreal-runtime-navigation="unrealRuntimeNavigation"
      :modifier-middle-preset-enabled="modifierMiddlePresetEnabled"
      @update:mini-map-enabled="miniMapEnabled = $event"
      @update:selected-entity-id="selectedEntityId = $event"
      @update:transform-mode="transformMode = $event"
      @update:entity-transforms="entityTransforms = $event"
      @update:camera-state="cameraState = $event"
      @update:work-mode="workMode = $event"
      @update:display-mode="displayMode = $event"
      @update:unreal-runtime-navigation="unrealRuntimeNavigation = $event"
      @update:modifier-middle-preset-enabled="modifierMiddlePresetEnabled = $event"
    />
  </main>
</template>
