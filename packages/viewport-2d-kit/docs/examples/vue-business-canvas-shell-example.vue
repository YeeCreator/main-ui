<template>
  <ViewportBusinessCanvasShell>
    <template #left>
      <div>
        <h2>工具区</h2>
        <button type="button">选择</button>
        <button type="button">连线</button>
      </div>
    </template>

    <template #toolbarLeading>
      <strong>Host canvas</strong>
    </template>

    <template #toolbarCenter>
      <span>{{ status }}</span>
    </template>

    <template #toolbarTrailing>
      <button type="button">运行</button>
    </template>

    <div ref="hostRef" style="position: relative; min-width: 0; min-height: 0; height: 100%;">
      <Viewport2D :view-box="viewBox" background="#fbfbfd" :style="{ width: '100%', height: '100%' }">
        <template #default="{ camera }">
          <div :style="bridge.worldStyle.value" style="position: absolute; left: 0; top: 0;">
            <svg :viewBox="bridge.viewBoxText.value" width="100%" height="100%">
              <path d="M 160 120 C 260 120, 320 220, 440 220" fill="none" stroke="#2563eb" stroke-width="2" />
            </svg>

            <article
              style="position: absolute; left: 120px; top: 90px; width: 120px; height: 64px; border: 1px solid #cbd5e1; background: white; border-radius: 6px; padding: 8px;"
              @dblclick="status = `world: ${formatPoint(bridge.clientEventToWorld(camera, $event))}`"
            >
              双击读取 world 坐标
            </article>
          </div>
        </template>
      </Viewport2D>
    </div>

    <template #right>
      <div>
        <h2>Inspector</h2>
        <p>业务节点、规则和服务仍由宿主管理。</p>
      </div>
    </template>
  </ViewportBusinessCanvasShell>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Viewport2D, ViewportBusinessCanvasShell, useViewportHostBridge } from 'viewport-2d-kit/vue';

const hostRef = ref<HTMLDivElement | null>(null);
const viewBox = { x: 0, y: 0, width: 1200, height: 800 };
const bridge = useViewportHostBridge(hostRef, viewBox);
const status = ref('等待交互');

const formatPoint = (point: { x: number; y: number }) => `${Math.round(point.x)}, ${Math.round(point.y)}`;
</script>