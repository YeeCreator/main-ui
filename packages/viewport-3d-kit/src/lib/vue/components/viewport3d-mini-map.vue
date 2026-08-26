<script setup lang="ts">
defineProps<{
  enabled: boolean;
}>();
</script>

<template>
  <div v-show="enabled" class="vk-minimap-host">
    <slot />
  </div>
</template>

<style scoped>
.vk-minimap-host {
  position: absolute;
  left: 16px;
  bottom: 16px;
  width: 180px;
  height: 140px;
  border: 1px solid rgba(148, 163, 184, 0.9);
  border-radius: 10px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(2px);
}

.vk-minimap-host :slotted(.vk-mini-canvas) {
  width: 100%;
  height: 100%;
  display: block;
}

@media (max-width: 720px) {
  .vk-minimap-host {
    left: 8px;
    bottom: 8px;
    width: 138px;
    height: 104px;
  }
}
</style>
