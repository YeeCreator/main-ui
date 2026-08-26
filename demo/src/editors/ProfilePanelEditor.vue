<script setup lang="ts">
import type { EditorRenderContext, JsonValue } from 'main-ui/core';

const props = defineProps<{ context: EditorRenderContext }>();

const asText = (value: JsonValue | undefined) => {
  if (typeof value === 'string') {
    return value;
  }
  if (value == null) {
    return '';
  }
  return JSON.stringify(value);
};
</script>

<template>
  <div class="demo-editor">
    <div class="demo-editor__header">
      <div>
        <h3>{{ asText(props.context.editor.payload.title) || props.context.editor.kind }}</h3>
        <p>{{ asText(props.context.editor.payload.description) }}</p>
      </div>
    </div>
    <div class="demo-grid">
      <div class="demo-panel-box">
        <strong>Workspace</strong>
        <p>{{ props.context.workspaceId }}</p>
      </div>
      <div class="demo-panel-box">
        <strong>Editor kind</strong>
        <p>{{ props.context.editor.kind }}</p>
      </div>
      <div class="demo-panel-box">
        <strong>Payload</strong>
        <p>{{ JSON.stringify(props.context.editor.payload) }}</p>
      </div>
    </div>
  </div>
</template>
