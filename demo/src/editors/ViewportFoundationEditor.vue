<script setup lang="ts">
import { computed, ref } from 'vue';
import type { EditorRenderContext, JsonObject } from '../../../src/core';
import {
  Viewport2DCanvas,
  type Camera2D,
  type Viewport2DCanvasExpose,
  type ViewportContainerSize,
} from 'viewport-2d-kit/vue';

type ViewportVariant = 'autodo-graph' | 'math-canvas' | 'game-board' | 'generic';

type SceneNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tone: string;
};

type SceneEdge = {
  source: string;
  target: string;
};

type ViewportScene = {
  title: string;
  description: string;
  viewBox: { x: number; y: number; width: number; height: number };
  nodes: SceneNode[];
  edges: SceneEdge[];
};

const props = defineProps<{ context: EditorRenderContext }>();

const viewportRef = ref<Viewport2DCanvasExpose | null>(null);
const zoomPercent = ref(100);
const cameraState = ref<Camera2D>({ scale: 1, pan: { x: 0, y: 0 } });
const viewportSize = ref<ViewportContainerSize>({ width: 1, height: 1 });

const payload = computed(() => props.context.editor.payload as JsonObject & { variant?: ViewportVariant });
const variant = computed<ViewportVariant>(() => payload.value.variant ?? 'generic');
const gridPatternId = computed(() => `demo-viewport-grid-${props.context.editor.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`);

const scenes: Record<ViewportVariant, ViewportScene> = {
  'autodo-graph': {
    title: 'Knowledge graph viewport',
    description: 'Graph editor foundation for DAG and knowledge visualization surfaces.',
    viewBox: { x: -180, y: -120, width: 720, height: 420 },
    nodes: [
      { id: 'source', label: 'Sources', x: -40, y: 40, width: 126, height: 54, tone: 'blue' },
      { id: 'parse', label: 'Parse assets', x: 190, y: -40, width: 142, height: 54, tone: 'green' },
      { id: 'notes', label: 'Notes', x: 390, y: 90, width: 112, height: 54, tone: 'gold' },
      { id: 'graph', label: 'Graph', x: 210, y: 210, width: 118, height: 54, tone: 'pink' },
    ],
    edges: [
      { source: 'source', target: 'parse' },
      { source: 'parse', target: 'notes' },
      { source: 'parse', target: 'graph' },
      { source: 'notes', target: 'graph' },
    ],
  },
  'math-canvas': {
    title: 'Formula canvas viewport',
    description: 'World-space editor foundation for formula nodes, edges and inspector workflows.',
    viewBox: { x: -220, y: -180, width: 760, height: 460 },
    nodes: [
      { id: 'input', label: 'x^2 + y^2', x: -70, y: -30, width: 138, height: 58, tone: 'blue' },
      { id: 'eval', label: 'Engine', x: 190, y: 90, width: 118, height: 58, tone: 'green' },
      { id: 'result', label: 'Result', x: 400, y: -50, width: 118, height: 58, tone: 'gold' },
      { id: 'note', label: 'Proof note', x: 120, y: 250, width: 132, height: 58, tone: 'pink' },
    ],
    edges: [
      { source: 'input', target: 'eval' },
      { source: 'eval', target: 'result' },
      { source: 'eval', target: 'note' },
    ],
  },
  'game-board': {
    title: 'Game board viewport',
    description: 'Shared board foundation for game sessions and map-like interaction surfaces.',
    viewBox: { x: -160, y: -160, width: 640, height: 420 },
    nodes: [
      { id: 'board', label: 'Board', x: 0, y: 0, width: 142, height: 70, tone: 'green' },
      { id: 'state', label: 'State', x: 260, y: -70, width: 118, height: 58, tone: 'blue' },
      { id: 'rules', label: 'Rules', x: 260, y: 120, width: 118, height: 58, tone: 'gold' },
      { id: 'history', label: 'History', x: -80, y: 220, width: 126, height: 58, tone: 'pink' },
    ],
    edges: [
      { source: 'board', target: 'state' },
      { source: 'board', target: 'rules' },
      { source: 'board', target: 'history' },
    ],
  },
  generic: {
    title: 'Viewport foundation',
    description: 'Neutral 2D editor foundation for zoomable and pannable surfaces.',
    viewBox: { x: -160, y: -120, width: 600, height: 360 },
    nodes: [
      { id: 'camera', label: 'Camera', x: -40, y: 10, width: 116, height: 54, tone: 'blue' },
      { id: 'layers', label: 'Layers', x: 180, y: 90, width: 116, height: 54, tone: 'green' },
      { id: 'tools', label: 'Tools', x: 340, y: -40, width: 116, height: 54, tone: 'gold' },
    ],
    edges: [
      { source: 'camera', target: 'layers' },
      { source: 'layers', target: 'tools' },
    ],
  },
};

const scene = computed(() => scenes[variant.value]);

const nodesById = computed(() => new Map(scene.value.nodes.map((node) => [node.id, node])));
const sceneEdges = computed(() =>
  scene.value.edges.flatMap((edge) => {
    const source = nodesById.value.get(edge.source);
    const target = nodesById.value.get(edge.target);
    return source && target ? [{ source, target }] : [];
  }),
);

const cameraText = computed(() => {
  const camera = cameraState.value;
  return `${zoomPercent.value}%  pan ${Math.round(camera.pan.x)}, ${Math.round(camera.pan.y)}  ${viewportSize.value.width}x${viewportSize.value.height}`;
});

const handleCameraChange = (camera: Camera2D, size: ViewportContainerSize) => {
  cameraState.value = camera;
  viewportSize.value = size;
};
</script>

<template>
  <div class="demo-editor demo-viewport-editor">
    <div class="demo-editor__header">
      <div>
        <h3>{{ scene.title }}</h3>
        <p>{{ scene.description }}</p>
      </div>
      <div class="demo-actions">
        <button type="button" @click="viewportRef?.zoomOut()">-</button>
        <button type="button" @click="viewportRef?.fitToBounds()">Fit</button>
        <button type="button" @click="viewportRef?.zoomIn()">+</button>
      </div>
    </div>

    <div class="demo-viewport-stage">
      <Viewport2DCanvas
        ref="viewportRef"
        class="demo-viewport"
        :view-box="scene.viewBox"
        :min-scale="0.25"
        :max-scale="4"
        :padding-px="56"
        @zoom-percent-change="(value) => (zoomPercent = value)"
        @camera-change="handleCameraChange"
      >
        <template #default="{ width, height, cameraTransform }">
          <svg class="demo-viewport__svg" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`">
            <defs>
              <pattern :id="gridPatternId" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" class="demo-viewport__grid-line" />
              </pattern>
            </defs>
            <rect :width="width" :height="height" class="demo-viewport__backdrop" />
            <rect :width="width" :height="height" :fill="`url(#${gridPatternId})`" opacity="0.55" />

            <g :transform="cameraTransform">
              <line
                v-for="edge in sceneEdges"
                :key="`${edge.source.id}-${edge.target.id}`"
                :x1="edge.source.x + edge.source.width / 2"
                :y1="edge.source.y + edge.source.height / 2"
                :x2="edge.target.x + edge.target.width / 2"
                :y2="edge.target.y + edge.target.height / 2"
                class="demo-viewport__edge"
              />

              <g
                v-for="node in scene.nodes"
                :key="node.id"
                :transform="`translate(${node.x} ${node.y})`"
                class="demo-viewport__node"
                :class="`is-${node.tone}`"
              >
                <rect :width="node.width" :height="node.height" rx="6" />
                <text :x="node.width / 2" :y="node.height / 2 + 5" text-anchor="middle">{{ node.label }}</text>
              </g>
            </g>
          </svg>
        </template>
      </Viewport2DCanvas>

      <div class="demo-viewport__status">{{ cameraText }}</div>
    </div>
  </div>
</template>
