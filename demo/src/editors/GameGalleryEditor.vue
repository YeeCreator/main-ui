<script setup lang="ts">
import type { EditorRenderContext } from 'main-ui/core';
import { useWorkbench } from 'main-ui/vue';

defineProps<{ context: EditorRenderContext }>();

const { dispatch } = useWorkbench();

const openSession = (gameId: string) => {
  void dispatch({
    type: 'editor/open',
    request: {
      editorKind: 'game-session',
      title: `${gameId} session`,
      payload: {
        gameId,
        sessionId: `${gameId}-${Date.now()}`,
      },
    },
  });
};
</script>

<template>
  <div class="demo-editor">
    <div class="demo-editor__header">
      <div>
        <h3>Game gallery</h3>
        <p>Parameterized game-session editors validate multi-instance payload recovery.</p>
      </div>
    </div>
    <div class="demo-actions">
      <button type="button" @click="openSession('chess')">Open chess</button>
      <button type="button" @click="openSession('go')">Open go</button>
      <button type="button" @click="openSession('puzzle')">Open puzzle</button>
    </div>
  </div>
</template>
