<script setup lang="ts">
/**
 * pixi 渲染内核示例（方案 B · 推荐路径）。
 *
 * 演示：
 * - PixiViewportCanvas（Vue 薄封装）挂载 pixi 内核
 * - @ready 拿到 PixiViewport，向 world 容器添加世界坐标 Graphics
 * - @camera-change / @zoom-percent-change / @interacting-change 同步外部状态
 * - vp.screenToWorld 做点击命中（世界坐标）
 */
import { ref } from 'vue';
import { PixiViewportCanvas, type PixiViewport } from 'viewport-2d-kit/pixi';
import { Graphics, Text } from 'pixi.js';

const VIEW_BOX = { x: -200, y: -160, width: 800, height: 560 };
const zoomPercent = ref(100);
const interacting = ref(false);
const lastWorldPoint = ref('—');

function onPixiReady(viewport: PixiViewport): void {
  // 1. 背景网格（世界坐标）
  const grid = new Graphics();
  const step = 80;
  for (let x = -400; x <= 400; x += step) {
    grid.moveTo(x, -300).lineTo(x, 300);
  }
  for (let y = -300; y <= 300; y += step) {
    grid.moveTo(-400, y).lineTo(400, y);
  }
  grid.stroke({ width: 1, color: 0xd8dee9, alpha: 0.6 });
  viewport.world.addChild(grid);

  // 2. 一个节点（圆角矩形 + 文本）
  const box = new Graphics();
  box.roundRect(-120, -60, 240, 120, 12);
  box.fill(0xdcfce7);
  box.stroke({ width: 2, color: 0x2563eb });
  viewport.world.addChild(box);

  const label = new Text({
    text: 'pixi kernel',
    style: { fontSize: 16, fill: '#1e293b', fontWeight: 'bold' as const },
  });
  label.anchor.set(0.5);
  viewport.world.addChild(label);

  // 3. 点击 canvas → screenToWorld 命中
  viewport.app.canvas.addEventListener('click', (event: MouseEvent) => {
    const rect = viewport.app.canvas.getBoundingClientRect();
    const world = viewport.screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    lastWorldPoint.value = `${world.x.toFixed(1)}, ${world.y.toFixed(1)}`;
  });
}

function onCameraChange(camera: { scale: number; pan: { x: number; y: number } }): void {
  zoomPercent.value = Math.round(camera.scale * 100);
}
</script>

<template>
  <div style="display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 8px; height: 100%;">
    <div style="display: flex; gap: 12px; align-items: center; font-size: 12px; color: #475569;">
      <span>缩放：{{ zoomPercent }}%</span>
      <span>拖拽中：{{ interacting ? '是' : '否' }}</span>
      <span>点击世界坐标：{{ lastWorldPoint }}</span>
    </div>
    <PixiViewportCanvas
      :view-box="VIEW_BOX"
      :padding-px="24"
      @ready="onPixiReady"
      @camera-change="onCameraChange"
      @interacting-change="interacting = $event"
    />
  </div>
</template>
