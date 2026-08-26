<script setup lang="ts">
import { ref } from 'vue';
import type { EditorRenderContext } from 'main-ui/core';

defineProps<{ context: EditorRenderContext }>();

const pointerStatus = ref('Pointer ready');

const handlePointerDown = (event: PointerEvent) => {
  pointerStatus.value = `Pointer captured at ${Math.round(event.offsetX)}, ${Math.round(event.offsetY)}`;
};
</script>

<template>
  <div class="demo-editor">
    <div class="demo-editor__header">
      <div>
        <h3>Canvas placeholder</h3>
        <p>Strong pointer interaction surface for math canvas and board-style hosts.</p>
      </div>
    </div>
    <div class="demo-canvas" tabindex="0" @pointerdown="handlePointerDown">
      <span class="demo-canvas__status">{{ pointerStatus }}</span>
    </div>
  </div>
</template>
