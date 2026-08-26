<script setup lang="ts">
import type { EditorRenderContext } from 'main-ui/core';

const props = defineProps<{ context: EditorRenderContext }>();
</script>

<template>
  <div class="demo-editor">
    <div class="demo-editor__header">
      <div>
        <h3>Game session</h3>
        <p>{{ JSON.stringify(props.context.editor.payload) }}</p>
      </div>
    </div>
    <div class="demo-game-board" />
  </div>
</template>
