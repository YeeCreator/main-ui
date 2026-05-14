<script setup lang="ts">
import type { EditorRenderContext } from '../../../src/core';

defineProps<{ context: EditorRenderContext }>();
</script>

<template>
  <div class="demo-editor">
    <div class="demo-editor__header">
      <div>
        <h3>Inspector</h3>
        <p>Represents property panels, detail views and contextual side surfaces.</p>
      </div>
    </div>
    <div class="demo-form-grid">
      <label>Selection</label><input value="editor-instance" readonly>
      <label>Status</label><input value="Active" readonly>
      <label>Surface</label><input value="leaf group" readonly>
      <label>Payload</label><input :value="JSON.stringify(context.editor.payload)" readonly>
    </div>
  </div>
</template>
