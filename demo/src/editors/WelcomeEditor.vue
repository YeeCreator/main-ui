<script setup lang="ts">
import type { EditorRenderContext } from '../../../src/core';

defineProps<{ context: EditorRenderContext }>();
</script>

<template>
  <div class="demo-editor">
    <div class="demo-editor__header">
      <div>
        <h2>main-ui workbench</h2>
        <p>Framework-free core with a Vue3 renderer, split tree, tab groups and host profiles.</p>
      </div>
    </div>
    <div class="demo-grid">
      <div class="demo-card">
        <strong>Core</strong>
        <p>Pure TypeScript document, reducer, registries and persistence adapters.</p>
      </div>
      <div class="demo-card">
        <strong>Vue Renderer</strong>
        <p>Provider, workbench shell, activity bar, leaf groups and editor hosts.</p>
      </div>
      <div class="demo-card">
        <strong>Host Profiles</strong>
        <p>Neutral fixtures for autodo-app, matheshop and yeegames adaptation.</p>
      </div>
    </div>
  </div>
</template>
