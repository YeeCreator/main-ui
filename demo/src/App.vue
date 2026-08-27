<script setup lang="ts">
import { MainUiProvider, WorkbenchShell } from 'main-ui/vue';
import { createDemoRuntime } from './runtime/createDemoRuntime';

const runtime = createDemoRuntime();
</script>

<template>
  <MainUiProvider :runtime="runtime">
    <WorkbenchShell />
  </MainUiProvider>
</template>
