<script setup lang="ts">
import type { EditorRenderContext } from 'main-ui/core';

defineProps<{ context: EditorRenderContext }>();
</script>

<template>
  <div class="demo-editor">
    <div class="demo-editor__header">
      <div>
        <h3>Graph placeholder</h3>
        <p>Neutral stand-in for graph, DAG, map or knowledge visualization editors.</p>
      </div>
    </div>
    <div class="demo-graph">
      <div class="demo-node">Input</div>
      <div class="demo-node">Process</div>
      <div class="demo-node">Output</div>
    </div>
  </div>
</template>
