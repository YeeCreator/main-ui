<script setup lang="ts">
/**
 * DualOutputDemoEditor —— 双输出面效果对比（演示用）。
 *
 * 左：**只有几何面** —— 文字走 GPU 图元批次，放大后是放大过的位图。
 * 右：**几何面 + 内容层** —— 文字与公式走浏览器 DOM，任意倍率都重新排版。
 *
 * 两侧**共用同一套相机操作**（滚轮缩放 / 拖拽平移），把同一份内容以两种方式呈现，
 * 便于直接对比「放大到 400% 时文字还清不清楚」。
 *
 * 两边的图元完全相同：同样的节点框（几何面）+ 同样的标签与公式文本。
 * 唯一差异是**右边把标签与公式放进了 contentItems**。
 */
import { computed, ref } from 'vue';
import type { EditorRenderContext } from 'main-ui/core';
import type { EntitySnapshot } from '@main-ui/core/primitives';
import type { ContentLayerItem } from '@main-ui/core/rendering';
import { WorldView } from '@main-ui/view-world';
import { FormulaView } from '@main-ui/view-formula';

const props = defineProps<{ context: EditorRenderContext }>();
void props;

/** 演示用的节点（世界坐标）。 */
type DemoNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  latex: string;
  tone: number;
};

const NODES: DemoNode[] = [
  { id: 'n1', x: 120, y: 120, width: 220, height: 96, label: '极限定义', latex: String.raw`\lim_{x \to 0}\frac{\sin x}{x}=1`, tone: 0x4a90d9 },
  { id: 'n2', x: 430, y: 120, width: 220, height: 96, label: '欧拉公式', latex: String.raw`e^{i\pi}+1=0`, tone: 0x57b894 },
  { id: 'n3', x: 120, y: 290, width: 220, height: 96, label: '高斯积分', latex: String.raw`\int_{-\infty}^{\infty}e^{-x^2}dx=\sqrt{\pi}`, tone: 0xd9a441 },
  { id: 'n4', x: 430, y: 290, width: 220, height: 96, label: '泰勒展开', latex: String.raw`e^x=\sum_{n=0}^{\infty}\frac{x^n}{n!}`, tone: 0xd9708c },
  { id: 'n5', x: 275, y: 440, width: 220, height: 96, label: '质能方程', latex: String.raw`E=mc^2`, tone: 0x9b6bd9 },
];

const VIEW_BOX = { x: 0, y: 0, width: 760, height: 620 };

/**
 * 几何面快照：节点框 + **GPU 文字**（标签）。
 *
 * 两侧用同一份快照 —— 差异只在「文字怎么画」这一件事上：
 * 左侧完全依赖这个快照（文字走 GPU 位图），右侧额外挂 DOM 内容层。
 *
 * 列式契约（见 `@main-ui/core/primitives` 的 `EntityBatch`）：
 * `points` 的**每一项**是一个扁平坐标数组 `[x0,y0,x1,y1,…]`，`count` 为项数。
 */
const snapshot = computed<EntitySnapshot>(() => ({
  bounds: VIEW_BOX,
  batches: {
    cards: {
      kind: 'card',
      geometry: 'polygon',
      count: NODES.length,
      columns: {
        points: NODES.map((node) => [
          node.x, node.y,
          node.x + node.width, node.y,
          node.x + node.width, node.y + node.height,
          node.x, node.y + node.height,
        ]),
        fill: NODES.map((node) => node.tone),
        fillAlpha: NODES.map(() => 0.18),
        stroke: NODES.map((node) => node.tone),
        strokeWidth: NODES.map(() => 2),
      },
    },
    labels: {
      kind: 'label',
      geometry: 'text',
      count: NODES.length,
      columns: {
        x: NODES.map((node) => node.x + 12),
        y: NODES.map((node) => node.y + 26),
        text: NODES.map((node) => node.label),
        fontSize: NODES.map(() => 16),
        color: NODES.map(() => 0x1f2933),
      },
    },
    formulas: {
      kind: 'formula',
      geometry: 'text',
      count: NODES.length,
      columns: {
        x: NODES.map((node) => node.x + 12),
        y: NODES.map((node) => node.y + 60),
        // 公式在 GPU 侧只能用近似文本 —— 这正是问题所在
        text: NODES.map((node) => node.latex),
        fontSize: NODES.map(() => 13),
        color: NODES.map(() => 0x52606d),
      },
    },
  },
}));

/**
 * 内容层项：标签与公式。
 *
 * 锚点放在节点框的**左上角内侧**，锚点对齐取「左上」，让 DOM 内容自然落在框内。
 */
const contentItems = computed<ContentLayerItem[]>(() =>
  NODES.flatMap((node) => [
    {
      id: `${node.id}-label`,
      kind: 'text',
      anchor: { world: { x: node.x + 10, y: node.y + 8 }, anchorX: 0, anchorY: 0 },
      data: { text: node.label },
    } satisfies ContentLayerItem,
    {
      id: `${node.id}-formula`,
      kind: 'formula',
      anchor: { world: { x: node.x + 10, y: node.y + 32 }, anchorX: 0, anchorY: 0 },
      // **不给 size**：公式高度由 KaTeX 自然决定。
      // 给了固定高度反而会把公式压扁（内容层容器不裁剪，只做锚点定位）。
      data: { latex: node.latex },
    } satisfies ContentLayerItem,
  ]),
);

/**
 * 右侧用的快照：**只有节点框**，不含 GPU 文字。
 *
 * 为什么不能复用 `snapshot`：右侧的文字由 DOM 内容层负责，
 * 若快照里再带一份 GPU 文字，会在同一位置叠出两份字（且放大后一糊一清），
 * 那样展示的不是「双输出面」而是「叠字 bug」。
 */
const snapshotWithoutText = computed<EntitySnapshot>(() => {
  const base = snapshot.value;
  return {
    bounds: base.bounds,
    batches: { cards: base.batches.cards },
  };
});

/** 两侧当前缩放（用于显示百分比）。 */
const leftZoom = ref(100);
const rightZoom = ref(100);

/**
 * 把相机事件折成百分比显示。
 *
 * `WorldView` 只抛 `camera-change`（载荷即 `WorldCameraState`），
 * 没有单独的缩放百分比事件 —— 百分比是宿主自己的展示口径，不由渲染层承担。
 */
function percentOf(scale: number): number {
  return Math.round(scale * 100);
}

/** 两侧的迷你句柄（拿到 `ready` 事件后可用 `setCamera` 直接改相机）。 */
type ReadyApi = { setCamera: (camera: { scale: number; pan: { x: number; y: number } }) => void };
const leftApi = ref<ReadyApi | null>(null);
const rightApi = ref<ReadyApi | null>(null);

/**
 * 把两侧同时拉到同一倍率，并对准**同一个世界锚点**（「泰勒展开」节点）。
 *
 * 为什么锚点不用视口中心：两侧容器尺寸相同但相机各自独立，
 * 若取「视口中心对应的世界点」，两边会指向不同位置，对比就失去意义。
 * 固定指到某一个节点，才能保证左右看的是同一条公式。
 */
const FOCUS_WORLD = { x: 540, y: 338 }; // 「泰勒展开」节点中心（含框内文字偏移）

function syncZoom(scale: number): void {
  // 让 FOCUS_WORLD 落在容器中心：`pan` 为世界原点在容器内的屏幕偏移。
  // 容器中心 ≈ VIEW_BOX 中心（两侧同尺寸，取其一即可）。
  const centerX = VIEW_BOX.width / 2;
  const centerY = VIEW_BOX.height / 2;
  const camera = {
    scale,
    pan: { x: centerX - FOCUS_WORLD.x * scale, y: centerY - FOCUS_WORLD.y * scale },
  };
  leftApi.value?.setCamera({ scale: camera.scale, pan: { ...camera.pan } });
  rightApi.value?.setCamera({ scale: camera.scale, pan: { ...camera.pan } });
}

</script>

<template>
  <div class="dual-demo">
    <header class="dual-demo__header">
      <strong>双输出面效果对比</strong>
      <span>滚轮缩放、拖拽平移；下面按钮可把两侧同时拉到同一倍率</span>
      <div class="dual-demo__actions">
        <button v-for="z in [1, 2, 4, 8]" :key="z" type="button" @click="syncZoom(z)">
          {{ z * 100 }}%
        </button>
      </div>
    </header>

    <div class="dual-demo__body">
      <section class="dual-demo__pane">
        <h3>① 只有几何面（文字走 GPU 图元）<span class="dual-demo__zoom">{{ leftZoom }}%</span></h3>
        <WorldView
          :snapshot="snapshot"
          :view-box="VIEW_BOX"
          :min-scale="0.2"
          :max-scale="12"
          @ready="leftApi = $event"
          @camera-change="leftZoom = percentOf($event.scale)"
        />
        <p class="dual-demo__note">
          标签能画（GPU 有文字图元），但<strong>公式排版做不到</strong> —— 下面显示的只能是 LaTeX 源码原样。
          若把源码当文字挤进框里，放大后还会糊成一片。
        </p>
      </section>

      <section class="dual-demo__pane">
        <h3>② 几何面 + 内容层（文字走 DOM）<span class="dual-demo__zoom">{{ rightZoom }}%</span></h3>
        <WorldView
          :snapshot="snapshotWithoutText"
          :view-box="VIEW_BOX"
          :content-items="contentItems"
          :min-scale="0.2"
          :max-scale="12"
          @ready="rightApi = $event"
          @camera-change="rightZoom = percentOf($event.scale)"
        >
          <template #content-layer="{ items, camera }">
            <div
              v-for="item in items"
              :key="item.id"
              class="dual-demo__content"
              :style="{
                transform: `translate(${item.screen.x + item.offset.x}px, ${item.screen.y + item.offset.y}px) scale(${camera.scale})`,
              }"
            >
              <span v-if="item.kind === 'text'" class="dual-demo__label">{{ item.data?.text }}</span>
              <FormulaView
                v-else-if="item.kind === 'formula'"
                :latex="String(item.data?.latex ?? '')"
                :display-mode="true"
              />
            </div>
          </template>
        </WorldView>
        <p class="dual-demo__note">
          同一台相机、同一份内容，只是把标签与公式交给浏览器绘制 —— 任意倍率都重新排版。
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dual-demo {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  background: var(--mui-color-bg);
  color: var(--mui-color-text);
}

.dual-demo__header {
  display: flex;
  gap: 12px;
  align-items: baseline;
  padding: 10px 14px;
  border-bottom: 1px solid var(--mui-color-border);
  background: var(--mui-color-panel);
  font-size: 13px;
}

.dual-demo__header span {
  color: var(--mui-color-text-muted);
  font-size: 12px;
}

/* 倍率按钮右对齐：方便一眼看到「两侧同一倍率」这件事 */
.dual-demo__actions {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.dual-demo__actions button {
  padding: 3px 10px;
  border: 1px solid var(--mui-color-border);
  border-radius: 5px;
  background: var(--mui-color-bg);
  color: var(--mui-color-text);
  font-size: 12px;
  cursor: pointer;
}

.dual-demo__actions button:hover {
  border-color: var(--mui-color-accent, #4a90d9);
  color: var(--mui-color-accent, #4a90d9);
}

.dual-demo__body {
  display: grid;
  /* 上下排列：左右并排时每栏只剩半个窄栏，相机 fit 后缩到看不清，
     反而看不出文字差异。上下排列让每栏拿到完整宽度。 */
  grid-template-rows: 1fr 1fr;
  gap: 1px;
  min-height: 0;
  overflow: auto;
  background: var(--mui-color-border);
}

.dual-demo__pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 0;
  background: var(--mui-color-panel);
}

/* WorldView 根节点需撑满中间格：它自身是 position:relative 的普通块，
   在 grid 里默认按内容高度收缩，会塌成一条。 */
.dual-demo__pane > :deep(.main-ui-view-world) {
  min-height: 0;
  height: 100%;
}

.dual-demo__pane h3 {
  margin: 0;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  border-bottom: 1px solid var(--mui-color-border);
  display: flex;
  justify-content: space-between;
}

.dual-demo__zoom {
  color: var(--mui-color-text-muted);
  font-weight: 400;
}

.dual-demo__note {
  margin: 0;
  padding: 8px 12px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--mui-color-text-muted);
  border-top: 1px solid var(--mui-color-border);
}

.dual-demo__content {
  position: absolute;
  top: 0;
  left: 0;
  /* transform-origin 必须在左上：内容按世界坐标定位，
     以左上为原点缩放才能与节点框对齐。 */
  transform-origin: 0 0;
  /* 内容层容器整体不接收指针（由 view-world 保证），
     这里只在需要交互的子元素上按需开启 */
  pointer-events: none;
  /* 不设 max-width：KaTeX 的根号、上下标本就允许横向溢出自身的盒，
     裁剪它等于把公式切掉一角。让内容自然渲染，靠字号控制宽度。 */
  white-space: nowrap;
  /* **内容层与几何面的配色是分离的**：几何面颜色由宿主按快照写死（这里是浅色卡片），
     而 `FormulaView` 取 `--mui-color-text`（深色主题下是浅色）。
     两者不一致就会出现「浅底浅字」。故在内容层就地覆盖，
     让 DOM 侧文字始终与其下方的几何底色对比充分。 */
  --mui-color-text: #1f2430;
  color: #1f2430;
}

/* 公式字号：KaTeX display 模式自带上下留白，直接 1em 会顶出 96 高的节点框，
   这里压到 0.92em，让「高斯积分」这类最宽的一条也能落在 220×96 的框内。 */
.dual-demo__content :deep(.katex) {
  font-size: 0.92em;
}

/* 去掉 display 模式自带的外边距：内容层已用坐标定位，多余外边距会让基线漂移 */
.dual-demo__content :deep(.katex-display) {
  margin: 0;
}

.dual-demo__label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--mui-color-text);
  white-space: nowrap;
}
</style>
