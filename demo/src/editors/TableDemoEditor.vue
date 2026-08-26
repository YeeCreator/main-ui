<script setup lang="ts">
import type { EditorRenderContext } from 'main-ui/core';

defineProps<{ context: EditorRenderContext }>();

const rows = [
  { id: 'doc-001', title: 'Workbench contract', state: 'Ready' },
  { id: 'doc-002', title: 'Host profile fixture', state: 'Validating' },
  { id: 'doc-003', title: 'Renderer adapter', state: 'Draft' },
];
</script>

<template>
  <div class="demo-editor">
    <div class="demo-editor__header">
      <div>
        <h3>Table demo</h3>
        <p>A neutral table-like editor for information workbench hosts.</p>
      </div>
    </div>
    <table class="demo-table">
      <thead>
        <tr><th>ID</th><th>Title</th><th>State</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td>{{ row.id }}</td>
          <td>{{ row.title }}</td>
          <td>{{ row.state }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
