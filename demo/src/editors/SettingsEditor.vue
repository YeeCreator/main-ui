<script setup lang="ts">
import type { EditorRenderContext } from 'main-ui/core';
import { useWorkbench } from 'main-ui/vue';

defineProps<{ context: EditorRenderContext }>();

const { document, dispatch } = useWorkbench();
</script>

<template>
  <div class="demo-editor">
    <div class="demo-editor__header">
      <div>
        <h3>Settings</h3>
        <p>System editor rendered as tab or overlay without business coupling.</p>
      </div>
    </div>
    <div class="demo-form-grid">
      <label>Theme</label>
      <select
        :value="document.theme.mode"
        @change="dispatch({ type: 'theme/setMode', mode: ($event.target as HTMLSelectElement).value as 'light' | 'dark' | 'system' })"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
      <label>Density</label>
      <input value="compact" readonly>
      <label>Workspace</label>
      <input :value="context.workspaceId" readonly>
    </div>
  </div>
</template>
