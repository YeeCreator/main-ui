# viewport-2d-kit

可复用的 2D 视窗（平移 + 缩放）工具包。**架构对齐 V3D（three.js 内核 + 薄壳）**：

- **渲染内核 = pixi.js（`viewport-2d-kit/pixi`）**：相机、坐标换算、交互、绘制全部由 `PixiViewport` 唯一管理，业务向 `world` 容器添加世界坐标的 Graphics/Sprite，获得 pixi 高性能渲染。
- **薄连接器 = `viewport-2d-kit/main-ui`**：`ViewportMainUiEditor` 只是“能放进 main-ui 标签页的窗口外观”，内部挂载 pixi 内核，不承载渲染实现。

本包可直接作为 `main-ui` 的编辑器实现被注册到任意工作区标签页。

此包为私有包，旨在在本工作区中使用。

## 入口

- 根入口：`viewport-2d-kit`
   - 聚合导出 `core`、`vue`、`main-ui`、`pixi`。
- 核心入口：`viewport-2d-kit/core`
   - 与框架无关的相机、交互、约束、渲染辅助、坐标换算能力（内核数学）。
- **pixi 渲染内核入口：`viewport-2d-kit/pixi`**
   - `PixiViewport`（PIXI.Application + world 容器 + 相机 + 交互）+ `PixiViewportCanvas`（Vue 薄封装）。**当前推荐入口。**
- **React 薄封装入口：`viewport-2d-kit/react-pixi`**
   - `PixiViewportReact`：pixi 内核的 React 组件（服务于 React 宿主）。
- main-ui 入口：`viewport-2d-kit/main-ui`
   - 提供薄连接器 `ViewportMainUiEditor` 与注册辅助函数，用于作为 `main-ui` 编辑器加载。
- Vue 入口：`viewport-2d-kit/vue`
   - `Viewport2D`、`Viewport2DCanvas`、`ViewportBusinessCanvasShell` 与 Vue 侧宿主桥接能力（**历史兼容层，新项目请走 `pixi` 入口**）。

## 开发

- 构建一次：`pnpm -C viewport-2d-kit build`
- 监听构建：`pnpm -C viewport-2d-kit dev`
- 类型检查：`pnpm -C viewport-2d-kit typecheck`

## 当被其他工程本地引用时的开发（重要）

因为此包仅导出 `dist/`（参见 `main`/`types`/`exports`），消费者只有在 `dist` 更新后才能看到改动。

### 方案 1（推荐）：在此包中运行 watch 构建

1. 在 `viewport-2d-kit` 目录：
   - 首次：`pnpm install`
   - 启动监听：`pnpm dev`
2. 在消费端项目：
   - 首次：`pnpm install`
   - 启动其开发服务器（`pnpm dev` / `pnpm start`）

当你修改 `viewport-2d-kit/src/**` 时，`tsup --watch` 会自动更新 `dist/`。多数消费端在刷新浏览器后会获取到变更。

### 方案 2：一次性构建

如果不想一直运行 watcher：

- 在 `viewport-2d-kit`：`pnpm build`
- 在消费端（在 Windows / pnpm 的某些情况下需要）：`pnpm install`

### VS Code（2025+）设置

目标：一键同时启动“库的 watch 构建”和“消费端 dev”。

- 在消费端创建一个 task，运行 `pnpm -C ../viewport-2d-kit dev`
- 再创建一个 task，运行消费端的 `pnpm dev`
- 使用 compound task 同时运行两者。

备注：
- PowerShell 中用 `;` 链接命令。
- 建议保持 `viewport-2d-kit` 的 watcher 在运行中，以便 `dist/` 持续更新。

### WebStorm（2025+）设置

推荐做法：创建两个 Run Configuration 和一个 Compound：

1. 运行配置 A（库的 watch）：
   - package.json：`viewport-2d-kit/package.json`
   - script：`dev`（tsup --watch）
   - 工作目录：`.../viewport-2d-kit`
2. 运行配置 B（消费端）：
   - package.json：消费端的 package.json
   - script：`dev`
3. Compound：
   - 同时运行 A + B。

这样在开发时对库的修改能即时在消费端生效。

### 方案 3：消费端脚本（当你无法同时运行 watch 时）

消费端可以添加类似脚本：

- `predev`: 构建此包并安装依赖，然后启动 dev
- `dev:with-deps`: 运行 `predev` 然后启动 `dev`

此方案比 watch 慢，但明确可靠。

## 使用示例

### 1) 使用 core 能力

```ts
import {
  createViewportController,
  type ViewportController,
  type ViewportInteractionMode,
  screenToWorld,
  worldToScreen,
  getVisibleWorldBox,
  applyCameraToCanvas2D,
  serializeCamera,
  deserializeCamera,
} from 'viewport-2d-kit/core';
```

### 2) 直接注册为 main-ui 编辑器

```ts
import { registerViewportMainUiEditor } from 'viewport-2d-kit/main-ui';

registerViewportMainUiEditor(runtime, {
   kind: 'viewport-foundation',
   title: 'Viewport foundation',
   rendererKey: 'viewport-foundation-editor',
   allowedWorkspaceIds: ['workspace-demo', 'workspace-analysis'],
});
```

### 3) 仅使用组件并由宿主自定义 descriptor

```ts
import { ViewportMainUiEditor } from 'viewport-2d-kit/main-ui';

runtime.vue.registerEditorRenderer('viewport-foundation-editor', ViewportMainUiEditor);
```

### 4) 使用 pixi 渲染内核（推荐）

Vue 宿主（如 battle-games）：

```vue
<template>
  <PixiViewportCanvas
    :view-box="{ x: 0, y: 0, width: 900, height: 620 }"
    @ready="onPixiReady"
    @camera-change="onCameraChange"
  />
</template>

<script setup lang="ts">
import { PixiViewportCanvas, type PixiViewport } from 'viewport-2d-kit/pixi';

function onPixiReady(viewport: PixiViewport) {
  // 内核就绪：向 world 容器添加世界坐标内容，相机由内核唯一管理
  const g = new Graphics().rect(0, 0, 100, 100).fill(0xdcfce7);
  viewport.world.addChild(g);
}
</script>
```

React 宿主：

```tsx
import { PixiViewportReact } from 'viewport-2d-kit/react-pixi';

<PixiViewportReact
  viewBox={{ x: 0, y: 0, width: 900, height: 620 }}
  onReady={(viewport) => {
    viewport.world.addChild(new Graphics().circle(0, 0, 20).fill(0x3b82f6));
  }}
/>
```

### 5) Vue 宿主画布壳 + bridge（历史兼容层）

```ts
import { Viewport2D, ViewportBusinessCanvasShell, useViewportHostBridge } from 'viewport-2d-kit/vue';
```

适用场景：
- 宿主已经有自己的业务状态机与 Inspector。
- 需要复用“三栏布局 + toolbar + viewport body”壳，而不想在每个项目重复写布局样板。
- 需要复用 `client -> world` 与 `screen delta -> world delta` 的桥接函数。

## main-ui 编辑器定位（薄连接器）

- 工具包提供了可直接挂到 `main-ui` 的 Vue 编辑器组件 `ViewportMainUiEditor`，其内部挂载 pixi 渲染内核。
- 编辑器 payload 支持：`viewBox`、`minScale`、`maxScale`、`paddingPx`、`nodes`、`edges`（demo 内容以 Graphics 绘制进 world 容器）。
- 同一 renderer 可被多个工作区引用，从而实现“任意窗口（标签页）加载使用”。
- 连接器只负责窗口外观与注册，不承载渲染实现——渲染全部在 pixi 内核。

## 架构总览（V3D 同构）

```text
main-ui 工作台（标签页/窗口生命周期）
  └─ viewport-2d-kit/main-ui（薄连接器：窗口外观 + 注册）
       └─ viewport-2d-kit/pixi（PixiViewport 渲染内核：pixi.js）
            └─ world 容器（业务 Graphics/Sprite，世界坐标）
```

- 内核数学（core）与 pixi 内核（pixi）是唯一推荐路径。
- `Viewport2DCanvas`（CSS transform + slot）与 `mode-lite`（react-infinite-viewer）、第三方 `pixi-viewport` 均为**历史兼容层**，新项目不要使用。

## 核心概念

- 世界空间（World space）：你内容的坐标系（游戏地图、绘图画布、棋盘等）
- 屏幕空间（Screen space）：视口容器内的像素坐标
- 相机模型：
  - `screen = pan + world * scale`
  - `pan` 以 **屏幕像素** 为单位
  - `scale` 为 **世界 -> 屏幕** 的缩放

## 重要注意事项

### overlay 默认不拦截交互

`Viewport2DCanvas` 的 overlay 会渲染在最上层（`position:absolute; inset:0`）。为避免覆盖底层内容层（canvas/svg）导致点击失效，
本库默认让 overlay 容器 `pointer-events: none`。

如果你的业务确实需要“在屏幕空间捕获 pointer 事件”（例如：棋盘游戏的点击落子需要按 camera 做 screen→world 映射），
请在你传入的 overlay 节点上显式设置：

- `style={{ pointerEvents: 'auto' }}`

这样既不会影响默认行为，也能实现可控的交互层。

## `Viewport2DCanvas`（Vue 组件）

`Viewport2DCanvas` 提供经过变换的内容层以及指针 / 滚轮交互：

- 平移：拖拽 / 触控板滚轮
- 缩放：Ctrl + 滚轮 / 触摸捏合
- 重置：`fitToCenter`

### 自定义交互

```ts
const interactions: ViewportInteractionMode = {
  // 类似绘图应用的缩放行为
  wheelZoomAnchor: 'cursor',
};
```

## 控制器（命令式指令 + 动画）

当你需要工具栏 / 快捷键 / 动画时：

- `createViewportController({ getCamera, setCamera, fitToCenter, getViewportCenterPx })`
- 内建命令：
  - `zoomIn()` / `zoomOut()` / `zoomTo(scale)`
  - `animateToCamera(target)`

提示：可以使用 `serializeCamera()` 持久化相机状态。

## 约束（Constraints）

- `constraints.panBounds.worldBounds`：将平移限制在一个世界矩形内
- `constraints.scale`：绝对的最小 / 最大缩放

## 虚拟化 / 性能

对于大型场景，请计算可见世界边界并仅渲染必要内容：

- `getVisibleWorldBox(camera, viewportPx)`

## 渲染器（多后端辅助）

- Canvas2D：`applyCameraToCanvas2D(ctx, camera)`
- SVG：`cameraToSvgMatrix(camera)`
- HiDPI 画布尺寸：`getHiDpiCanvasPixelSize(viewportPx, dpr)`

## 持久化

- `serializeCamera(camera)`
- `deserializeCamera(data)`

这些函数设计为跨版本保持稳定。
