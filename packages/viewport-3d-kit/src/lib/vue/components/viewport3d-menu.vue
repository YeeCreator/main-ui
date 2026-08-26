<script setup lang="ts">
import type { TransformMode } from '../../core/gizmo';
import type { SelectedEntityId } from '../../core/selection';
import type { ViewportDisplayMode, ViewportWorkMode } from '../../core/viewport';

defineProps<{
  workMode: ViewportWorkMode;
  displayMode: ViewportDisplayMode;
  transformMode: TransformMode;
  selectedEntityId: SelectedEntityId;
  unrealRuntimeNavigation: boolean;
  modifierMiddlePresetEnabled: boolean;
  miniMapEnabled: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:workMode', value: ViewportWorkMode): void;
  (e: 'update:displayMode', value: ViewportDisplayMode): void;
  (e: 'update:transformMode', value: TransformMode): void;
  (e: 'update:selectedEntityId', value: SelectedEntityId): void;
  (e: 'update:unrealRuntimeNavigation', value: boolean): void;
  (e: 'update:modifierMiddlePresetEnabled', value: boolean): void;
  (e: 'update:miniMapEnabled', value: boolean): void;
  (e: 'zoom-in'): void;
  (e: 'zoom-out'): void;
  (e: 'reset-view'): void;
  (e: 'focus-selection'): void;
}>();
</script>

<template>
  <div class="vk-overlay vk-vue-overlay">
    <div class="vk-vue-toolbar">
      <div class="vk-vue-row">
        <button
          type="button"
          :class="['vk-vue-btn', workMode === 'runtime' ? 'is-active' : '']"
          @click="emit('update:workMode', 'runtime')"
        >
          运行
        </button>
        <button
          type="button"
          :class="['vk-vue-btn', workMode === 'edit' ? 'is-active' : '']"
          @click="emit('update:workMode', 'edit')"
        >
          编辑
        </button>

        <select
          class="vk-vue-select"
          :value="displayMode"
          @change="emit('update:displayMode', ($event.target as HTMLSelectElement).value as ViewportDisplayMode)"
        >
          <option value="wireframe">Wireframe</option>
          <option value="solid">Solid</option>
          <option value="rendered">Rendered</option>
        </select>
      </div>

      <div class="vk-vue-row">
        <label class="vk-vue-check">
          <input
            type="checkbox"
            :checked="unrealRuntimeNavigation"
            @change="emit('update:unrealRuntimeNavigation', ($event.target as HTMLInputElement).checked)"
          />
          UE 运行导航
        </label>

        <label class="vk-vue-check">
          <input
            type="checkbox"
            :checked="modifierMiddlePresetEnabled"
            @change="emit('update:modifierMiddlePresetEnabled', ($event.target as HTMLInputElement).checked)"
          />
          中键修饰键方案
        </label>

        <label class="vk-vue-check">
          <input
            type="checkbox"
            :checked="miniMapEnabled"
            @change="emit('update:miniMapEnabled', ($event.target as HTMLInputElement).checked)"
          />
          小地图
        </label>
      </div>

      <div v-if="workMode === 'edit'" class="vk-vue-row">
        <button
          type="button"
          :class="['vk-vue-btn', transformMode === 'translate' ? 'is-active' : '']"
          @click="emit('update:transformMode', 'translate')"
        >
          平移 (G)
        </button>
        <button
          type="button"
          :class="['vk-vue-btn', transformMode === 'rotate' ? 'is-active' : '']"
          @click="emit('update:transformMode', 'rotate')"
        >
          旋转 (R)
        </button>
        <button
          type="button"
          :class="['vk-vue-btn', transformMode === 'scale' ? 'is-active' : '']"
          @click="emit('update:transformMode', 'scale')"
        >
          缩放 (S)
        </button>
        <button type="button" class="vk-vue-btn" @click="emit('update:selectedEntityId', null)">
          取消选择
        </button>
      </div>

      <div class="vk-vue-row">
        <button type="button" class="vk-vue-btn" @click="emit('zoom-in')">放大</button>
        <button type="button" class="vk-vue-btn" @click="emit('zoom-out')">缩小</button>
        <button type="button" class="vk-vue-btn" @click="emit('reset-view')">重置视角</button>
        <button type="button" class="vk-vue-btn" :disabled="!selectedEntityId" @click="emit('focus-selection')">
          聚焦选中
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vk-vue-overlay {
  max-width: min(680px, calc(100% - 24px));
}

.vk-vue-toolbar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(2px);
}

.vk-vue-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.vk-vue-btn,
.vk-vue-select {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 12px;
  color: #1e293b;
}

.vk-vue-btn {
  cursor: pointer;
}

.vk-vue-btn.is-active {
  background: #dbeafe;
  border-color: #93c5fd;
}

.vk-vue-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.vk-vue-check {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #334155;
}

@media (max-width: 720px) {
  .vk-vue-overlay {
    right: 8px;
    left: 8px;
    max-width: none;
  }

  .vk-vue-toolbar {
    gap: 8px;
  }
}
</style>
