<script setup lang="ts">
/**
 * MinimapDemoEditor —— 缩略导航（小地图）双画法对比。
 *
 * 左侧主视口可自由缩放/平移；下方两个缩略图**共用同一份数据**：
 *
 * - 左：`point` 画法 —— 每个实体画成一个质点（游戏小地图的典型形态）
 * - 右：`rect` 画法 —— 每个单元按比例画成框（画布缩略图的典型形态）
 *
 * 两个缩略图的**坐标数学完全相同**（同一个 `minimapTransform`），
 * 差别只有简化画法。点击任一缩略图，主视口跳到该处 —— 证明「点击跳转」
 * 也只有一份实现。
 *
 * 用途：直观确认「游戏小地图」与「画布导航」可以共用同一个组件，
 * 不必维护两套世界↔小图换算。
 */
import { computed, ref } from 'vue';
import type { EditorRenderContext } from 'main-ui/core';
import type { EntitySnapshot } from '@main-ui/core/primitives';
import type { Vec2, WorldRect } from '@main-ui/core/rendering';
import { WorldView } from '@main-ui/view-world';
import { Minimap } from '@main-ui/view-minimap';
import type { MinimapItem } from '@main-ui/view-minimap';

const props = defineProps<{ context: EditorRenderContext }>();
void props;

/** 演示用单元（世界坐标）。 */
type DemoCell = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 缩略图里的语义分组，仅用于着色演示。 */
  group: 'node' | 'landmark';
};

/** 生成一版固定布局：左上若干方块 + 右下零散地标。 */
const CELLS: DemoCell[] = [
  { id: 'c1', x: 60, y: 60, width: 180, height: 110, group: 'node' },
  { id: 'c2', x: 300, y: 60, width: 180, height: 110, group: 'node' },
  { id: 'c3', x: 60, y: 230, width: 180, height: 110, group: 'node' },
  { id: 'c4', x: 300, y: 230, width: 180, height: 110, group: 'node' },
  { id: 'c5', x: 540, y: 60, width: 180, height: 110, group: 'node' },
  { id: 'c6', x: 540, y: 230, width: 180, height: 110, group: 'node' },
  { id: 'p1', x: 150, y: 430, width: 0, height: 0, group: 'landmark' },
  { id: 'p2', x: 330, y: 470, width: 0, height: 0, group: 'landmark' },
  { id: 'p3', x: 520, y: 440, width: 0, height: 0, group: 'landmark' },
  { id: 'p4', x: 700, y: 480, width: 0, height: 0, group: 'landmark' },
  { id: 'p5', x: 250, y: 560, width: 0, height: 0, group: 'landmark' },
  { id: 'p6', x: 620, y: 560, width: 0, height: 0, group: 'landmark' },
];

const VIEW_BOX: WorldRect = { x: 0, y: 0, width: 800, height: 640 };

/** 几何面快照：所有单元画成方块（点型给一个小方块以便看清）。 */
const snapshot = computed<EntitySnapshot>(() => {
  /** 统一取每个单元的绘制矩形：点型给一个可见的最小方块。 */
  const boxes = CELLS.map((cell) => (cell.width
    ? { x: cell.x, y: cell.y, w: cell.width, h: cell.height }
    : { x: cell.x - 6, y: cell.y - 6, w: 12, h: 12 }));

  return {
    bounds: VIEW_BOX,
    batches: {
      cards: {
        kind: 'card',
        geometry: 'polygon',
        count: CELLS.length,
        columns: {
          // `points` 是**列**：每一项是一个图元的扁平坐标数组。
          points: boxes.map((b) => [b.x, b.y, b.x + b.w, b.y, b.x + b.w, b.y + b.h, b.x, b.y + b.h]),
          fill: CELLS.map((cell) => (cell.group === 'landmark' ? 0x9b6bd9 : 0x4a90d9)),
          fillAlpha: CELLS.map((cell) => (cell.group === 'landmark' ? 1 : 0.5)),
          stroke: CELLS.map((cell) => (cell.group === 'landmark' ? 0x9b6bd9 : 0x4a90d9)),
          strokeWidth: CELLS.map(() => 1),
        },
      },
    },
  };
});

/** 缩略图数据：两种画法都用这一份。 */
const minimapItems = computed<MinimapItem[]>(() =>
  CELLS.map((cell) => ({
    id: cell.id,
    world: { x: cell.x, y: cell.y, width: cell.width, height: cell.height },
    group: cell.group,
  })),
);

/** 两份展示用数据：点画法把方块也画成点，框画法把地标也画成框。 */
const pointStyleItems = computed<MinimapItem[]>(() =>
  CELLS.map((cell) => ({
    id: cell.id,
    // 用中心点：宽高置零即自动判为 point
    world: {
      x: cell.x + cell.width / 2,
      y: cell.y + cell.height / 2,
      width: 0,
      height: 0,
    },
    kind: 'point' as const,
    group: cell.group,
    highlighted: cell.group === 'landmark',
  })),
);

const rectStyleItems = computed<MinimapItem[]>(() =>
  CELLS.map((cell) => ({
    id: cell.id,
    // 地标原本零宽高，给一个最小可视尺寸，演示「框画法」如何处理点实体
    world: cell.width
      ? { x: cell.x, y: cell.y, width: cell.width, height: cell.height }
      : { x: cell.x - 8, y: cell.y - 8, width: 16, height: 16 },
    kind: 'rect' as const,
    group: cell.group,
    highlighted: cell.group === 'landmark',
  })),
);

/** 主视口状态。 */
const mainApi = ref<{ setCamera: (camera: { scale: number; pan: Vec2 }) => void } | null>(null);
const mainCamera = ref<{ scale: number; pan: Vec2 }>({ scale: 1, pan: { x: 0, y: 0 } });
const mainSize = ref<{ width: number; height: number }>({ width: 0, height: 0 });
const mainHost = ref<HTMLElement | null>(null);

/** 可见世界矩形（缩略图画视口框用）。 */
const viewportRect = computed<WorldRect>(() => {
  const { scale, pan } = mainCamera.value;
  const safe = scale === 0 ? 1 : scale;
  return {
    x: -pan.x / safe + 0,
    y: -pan.y / safe + 0,
    width: Math.max(mainSize.value.width / safe, 1),
    height: Math.max(mainSize.value.height / safe, 1),
  };
});

/** 容器尺寸（缩略图点击跳转需要它把目标点居中）。 */
function syncSize(): void {
  const host = mainHost.value;
  if (!host) return;
  const rect = host.getBoundingClientRect();
  mainSize.value = { width: Math.round(rect.width), height: Math.round(rect.height) };
}

/**
 * 收到 `ready` 时保存句柄并同步尺寸。
 *
 * 必须包一层而不是直接写 `mainApi = $event; syncSize()`：
 * 卸载阶段 `mainHost` 已被置空，直接调 `syncSize` 会在 `getBoundingClientRect`
 * 处抛 `Cannot read properties of null`。
 */
function onMainReady(api: { setCamera: (camera: { scale: number; pan: Vec2 }) => void }): void {
  mainApi.value = api;
  syncSize();
  // 初始把相机停在 100% 并对准内容左上区：默认的「fit 全图」会把世界缩到
  // 一半，缩略图里的视口框几乎铺满，反而看不出缩略导航的意义。
  //
  // 必须等一帧：`ready` 之后组件内部还有一个 rAF 兜底的 `fitToBounds`，
  // 同步设置会被它立刻覆盖（表现为相机永远停在 fit 后的倍率）。
  requestAnimationFrame(() => {
    api.setCamera({ scale: 1, pan: { x: -40, y: -30 } });
  });
}

/** 缩略图点击 → 主视口把该点移到中心。 */
function onNavigate(payload: { pan: Vec2 }): void {
  mainApi.value?.setCamera({ scale: mainCamera.value.scale, pan: payload.pan });
}

const zoomLabel = computed(() => `${Math.round(mainCamera.value.scale * 100)}%`);
</script>

<template>
  <div class="minimap-demo">
    <header class="minimap-demo__header">
      <strong>缩略导航：一个抽象，两种画法</strong>
      <span>点击下方任一缩略图，主视口跳到该处（两张图的坐标数学完全相同）</span>
      <span class="minimap-demo__zoom">{{ zoomLabel }}</span>
    </header>

    <div ref="mainHost" class="minimap-demo__main" @pointerenter="syncSize">
      <WorldView
        :snapshot="snapshot"
        :view-box="VIEW_BOX"
        :min-scale="0.2"
        :max-scale="10"
        @ready="onMainReady"
        @camera-change="mainCamera = $event"
      />
    </div>

    <div class="minimap-demo__maps">
      <section class="minimap-demo__pane">
        <h4>① 质点画法（游戏小地图）</h4>
        <p>每个实体画成质点，半径固定为像素值 —— 缩放缩略图尺寸时点不跟着变大。</p>
        <Minimap
          :items="pointStyleItems"
          :viewport="viewportRect"
          :camera="mainCamera"
          :viewport-size="mainSize"
          :width="200"
          :height="150"
          @navigate="onNavigate"
        />
      </section>

      <section class="minimap-demo__pane">
        <h4>② 缩略画法（画布导航）</h4>
        <p>单元按比例画成框，点实体给最小可视尺寸 —— 与左边<strong>同一份数据、同一套坐标映射</strong>。</p>
        <Minimap
          :items="rectStyleItems"
          :viewport="viewportRect"
          :camera="mainCamera"
          :viewport-size="mainSize"
          :width="200"
          :height="150"
          @navigate="onNavigate"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.minimap-demo {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: 100%;
  min-height: 0;
  background: var(--mui-color-bg);
  color: var(--mui-color-text);
}

.minimap-demo__header {
  display: flex;
  gap: 12px;
  align-items: baseline;
  padding: 10px 14px;
  border-bottom: 1px solid var(--mui-color-border);
  background: var(--mui-color-panel);
  font-size: 13px;
}

.minimap-demo__header span {
  color: var(--mui-color-text-muted);
  font-size: 12px;
}

.minimap-demo__zoom {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.minimap-demo__main {
  min-height: 0;
  position: relative;
}

/* WorldView 在 grid 行内会塌陷，需显式撑满 */
.minimap-demo__main :deep(.main-ui-view-world) {
  height: 100%;
}

.minimap-demo__maps {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 12px 14px;
  border-top: 1px solid var(--mui-color-border);
  background: var(--mui-color-panel);
}

.minimap-demo__pane h4 {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 600;
}

.minimap-demo__pane p {
  margin: 0 0 8px;
  color: var(--mui-color-text-muted);
  font-size: 11px;
  line-height: 1.5;
}
</style>
