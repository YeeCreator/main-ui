# API手册

## 包入口

- 根入口：`viewport-2d-kit`
  - 聚合导出 `core`、`vue`、`main-ui`、`pixi`。
- 核心入口：`viewport-2d-kit/core`
  - 包含相机、交互、约束、渲染辅助、坐标换算等与框架无关能力（内核数学）。
- **pixi 渲染内核入口：`viewport-2d-kit/pixi`**
  - `PixiViewport`（PIXI.Application + world 容器 + 相机 + 交互）+ `PixiViewportCanvas`（Vue 薄封装）。**当前推荐入口。**
- **React 薄封装入口：`viewport-2d-kit/react-pixi`**
  - `PixiViewportReact` + `createPixiViewportReact`，服务于 React 宿主。
- Vue 入口：`viewport-2d-kit/vue`
  - 导出 `Viewport2D`、`Viewport2DCanvas`、`ViewportBusinessCanvasShell` 与宿主 bridge 能力（**历史兼容层**）。
- main-ui 入口：`viewport-2d-kit/main-ui`
  - 导出薄连接器 `ViewportMainUiEditor`、descriptor 工厂与 runtime 注册函数。

## 核心入口（`viewport-2d-kit` / `viewport-2d-kit/core`）

### `createViewportController`

创建命令式控制器，可用于工具栏、快捷键和动画。

### 相机与坐标函数

- `cameraToCssTransform`
- `fitCameraToViewBox`
- `panBy`
- `zoomAtScreenPoint`
- `screenToWorld`
- `worldToScreen`
- `clamp`

### 约束与渲染辅助

- `constrainCamera`
- `applyCameraToCanvas2D`
- `cameraToSvgMatrix`
- `getVisibleWorldBox`
- `normalizeViewportPxRect`
- `screenDeltaToWorldDelta`
- `getHiDpiCanvasPixelSize`

### 控制器序列化与动画

- `serializeCamera`
- `deserializeCamera`
- `animateCamera`
- `easeInOutCubic`
- `easeOutCubic`

### 其他工具

- `installPreventPageZoom`
- `camera2DToLegacy`
- `legacyToCamera2D`
- `localCssToWorld`
- `worldToLocalCss`
- `worldToLocalCssWithScroll`
- 其余 `coordinateAdapters` 导出函数

## pixi 渲染内核入口（`viewport-2d-kit/pixi`）

架构对齐 V3D（three.js 内核 + 薄壳）：pixi 内核负责全部渲染与交互，业务侧只向 `world` 容器添加世界坐标内容。

### `PixiViewport`

`new PixiViewport(container: HTMLElement, options)` + `await viewport.init()`。

options 字段：
- `viewBox: { x, y, width, height }`（必填）
- `minScale?: number`（默认 `0.2`）
- `maxScale?: number`（默认 `8`）
- `paddingPx?: number`（默认 `40`）
- `background?: number`（默认 `0xf5f2e9`）
- `antialias?: boolean`（默认 `false`，点阵风格无需 MSAA）
- `resolution?: number`（默认 `devicePixelRatio`）
- `autoDensity?: boolean`（默认 `true`）
- `preserveDrawingBuffer?: boolean`（默认 `false`）
- `disablePan?: boolean`（默认 `false`）

实例成员：
- `app: PIXI.Application`
- `world: PIXI.Container`（世界坐标容器，相机已应用，业务内容加到这里）

实例方法：
- `init(): Promise<void>`
- `getCamera(): Camera2D` / `setCamera(camera: Camera2D)`
- `fitToBounds(viewBox?)`（默认当前 viewBox）
- `setViewBox(viewBox)`（更新世界范围并自动 fit）
- `getViewBox(): ViewBox` / `getSize(): { width, height }`
- `panBy(deltaScreen: Vec2)` / `zoomAtScreenPoint(factor, anchorScreen: Vec2)`
- `screenToWorld(point: Vec2): Vec2` / `worldToScreen(point: Vec2): Vec2`
- `resize(width, height)` / `destroy()`
- `isInteracting(): boolean`

实例回调：
- `onCameraChange(cb)` / `onInteractingChange(cb)`

### `PixiViewportCanvas`（Vue 组件）

props：`viewBox`、`minScale`、`maxScale`、`paddingPx`、`background`、`antialias`、`resolution`、`preserveDrawingBuffer`、`disablePan`。

事件：
- `@ready(viewport)`：内核就绪，向 `world` 添加内容
- `@camera-change(camera)` / `@zoom-percent-change(value)` / `@interacting-change(value)`

expose：`getViewport`、`getWorld`、`getCamera`、`getSize`、`fitToBounds`、`setViewBox`、`screenToWorld`、`worldToScreen`、`panBy`、`zoomAtScreenPoint`、`isInteracting`。

## react-pixi 入口（`viewport-2d-kit/react-pixi`）

### `PixiViewportReact(props)`

props：`viewBox`（必填）+ `PixiViewportOptions` + `style` / `className` + `onReady` / `onCameraChange` / `onZoomPercentChange` / `onInteractingChange`。

`onReady(viewport)` 中向 `viewport.world` 添加 Graphics/Sprite。

### `createPixiViewportReact(hostRef, options)`

受控场景辅助函数：在 host ref 就绪后创建 `PixiViewport`，调用方负责 `destroy()`。

## Vue 入口（`viewport-2d-kit/vue`）

### `Viewport2DCanvas(props)`

Vue 3 视口组件，支持平移、缩放、适配居中与 overlay。

字段：
- `viewBox: { x: number; y: number; width: number; height: number }`
- `width?: number | string`（默认 `100%`）
- `height?: number | string`（默认 `100%`）
- `background?: string`（默认 `#0f172a`）
- `minScale?: number`（默认 `0.25`）
- `maxScale?: number`（默认 `4`）
- `paddingPx?: number`（默认 `16`）

插槽：
- 默认插槽：`{ width, height, camera, cameraTransform, fitToCenter }`
- `overlay` 插槽：`{ width, height, camera, fitToCenter }`

暴露：
- `fitToCenter(): void`
- `getCamera(): Camera2D`
- `setCamera(next: Camera2D): void`

### `ViewportBusinessCanvasShell(props)`

通用 Vue 业务画布壳，负责三栏布局、toolbar 样板和 viewport body 承载。

字段：
- `leftPanelWidth?: number | string`（默认 `210`）
- `rightPanelWidth?: number | string`（默认 `320`）
- `toolbarHeight?: number | string`（默认 `36`）
- `collapseEmptySidePanels?: boolean`（默认 `true`）

插槽：
- `left`
- `toolbarLeading`
- `toolbarCenter`
- `toolbarTrailing`
- 默认插槽：viewport/stage body
- `right`

### `useViewportHostBridge(hostRef, viewBox)`

Vue 宿主 bridge，用于减少业务仓库重复维护 viewport 胶水。

返回：
- `viewBoxText`
- `worldStyle`
- `clientEventToWorld(camera, event)`
- `screenDeltaToWorld(camera, deltaScreen)`

## main-ui 入口（`viewport-2d-kit/main-ui`）

薄连接器：只提供“能放进 main-ui 标签页的窗口外观”，内部挂载 pixi 渲染内核（`PixiViewportCanvas`），demo 节点/边以 Graphics 绘制进 world 容器。

### 常量

- `VIEWPORT_MAIN_UI_EDITOR_KIND`
- `VIEWPORT_MAIN_UI_RENDERER_KEY`

### `ViewportMainUiEditor`

可直接用于 `runtime.vue.registerEditorRenderer` 的 Vue 薄连接器组件。

payload 字段：
- `title?: string`
- `description?: string`
- `viewBox?: { x: number; y: number; width: number; height: number }`
- `minScale?: number`
- `maxScale?: number`
- `paddingPx?: number`
- `nodes?: Array<{ id, label, x, y, width, height, tone? }>`（绘制进 pixi world）
- `edges?: Array<{ source, target }>`（绘制进 pixi world）

### `createViewportMainUiEditorDescriptor(options)`

生成与 `main-ui` 兼容的 editor descriptor。

`options` 关键字段：
- `allowedWorkspaceIds: string[]`（必填）
- `kind?: string`
- `title?: string`
- `description?: string`
- `icon?: string`
- `rendererKey?: string`
- `defaultPayload?: ViewportMainUiEditorPayload`

### `registerViewportMainUiEditor(runtime, options)`

一步完成 descriptor 与 renderer 注册。

行为：
- 调用 `runtime.core.registerEditor(descriptor)`
- 调用 `runtime.vue.registerEditorRenderer(descriptor.rendererKey, ViewportMainUiEditor)`

## 迁移说明

**当前推荐路径**：`core`（内核数学）+ `pixi`（渲染内核）+
`main-ui`（薄连接器）/ `react-pixi`（React 薄封装）。

历史兼容层（可用但不再推荐，新项目不要使用）：
- `viewport-2d-kit/vue` 的 `Viewport2D` / `Viewport2DCanvas`（CSS transform + slot）
- `viewport-2d-kit/modes` 的 `mode-lite`（react-infinite-viewer）与第三方 `pixi-viewport`（`listLegacyViewportEngines()` 可查）

以下旧入口不再作为公开 API：
- `viewport-2d-kit/react`
- `viewport-2d-kit/modes`
- `viewport-2d-kit/mode-lite`
- `viewport-2d-kit/mode-game`
- `viewport-2d-kit/mode-map`
- `viewport-2d-kit/ui`
