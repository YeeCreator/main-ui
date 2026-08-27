# 开发者指南（viewport-2d-kit）

> 本文档面向需要维护/扩展 `viewport-2d-kit` 的开发者。

## 1. 目标与定位

`viewport-2d-kit` 当前架构（2026-08-26 起，方案 B 定稿）：

1. **pixi 渲染内核（唯一官方渲染内核）** —— `src/pixi/PixiViewport.ts` 管理 `PIXI.Application` + world 容器并统一应用相机矩阵（`world.scale.set(scale)` + `world.position.set(pan)`）；`src/pixi/PixiViewportCanvas.ts` 是 Vue 薄封装；`src/react-pixi/PixiViewportReact.tsx` 是 React 薄封装。core（相机数学/坐标换算/约束/交互）保留为“视口外壳”纯函数，被内核复用。
2. **main-ui 薄连接器** —— `src/main-ui/mainUiEditor.ts`：只提供“能放进 main-ui 标签页的窗口外观”，内部挂载 pixi 内核；demo 内容以 Graphics 画进 world 容器。
3. 历史兼容层（不再扩展，仅存量迁移期使用）：`Viewport2D` / `Viewport2DCanvas`（CSS transform + slot）、`ViewportLite` / `ViewportModeHost`（react-infinite-viewer）、第三方 `pixi-viewport`。

常用于：轻量画布、地图编辑、游戏镜头、无限画布应用。

## 2. 坐标模型

本库统一使用：

- `screenPx = panPx + world * scale`

其中：

- `pan` 的单位是 **屏幕像素**
- `scale` 表示 **world → screen 的缩放倍率**

> 该模型与 DOM transform `translate(px) scale()` 一致。

## 3. 组件与核心模块

1. 兼容层（历史）：
	- `src/Viewport2D.tsx`
	- `src/useViewportCamera.ts`
	- `src/interactions.ts`
2. 模式层（历史兼容，引擎映射已指向 pixi 内核）：
	- `src/modes/contracts.ts`
	- `src/modes/engineSelector.ts`
	- `src/modes/ViewportModeHost.tsx`
3. `mode-lite`（历史兼容）：
	- `src/modes/modeLite/ViewportLite.tsx`
	- `src/modes/modeLite/createLiteModeController.ts`
4. `mode-game/map`（元信息，历史兼容）：
	- `src/modes/modeGame/index.ts`
	- `src/modes/modeMap/index.ts`
5. 工具层：
	- `src/viewportMath.ts`
	- `src/controller.ts`
	- `src/coordinateAdapters.ts`
6. **pixi 渲染内核（唯一内核）**：
	- `src/pixi/PixiViewport.ts`（PIXI.Application + world 容器 + 相机矩阵 + 交互 + viewBox/size/交互状态）
	- `src/pixi/PixiViewportCanvas.ts`（Vue 薄封装，`@ready` 暴露 PixiViewport）
	- `src/pixi/index.ts`（`viewport-2d-kit/pixi` 子入口）
7. **React 薄封装**：
	- `src/react-pixi/PixiViewportReact.tsx`
	- `src/react-pixi/index.ts`（`viewport-2d-kit/react-pixi` 子入口）
8. **main-ui 薄连接器**：
	- `src/main-ui/mainUiEditor.ts`（`ViewportMainUiEditor` + descriptor 工厂 + 注册函数）
	- `src/main-ui/index.ts`（`viewport-2d-kit/main-ui` 子入口）
9. Vue 宿主层（历史兼容壳）：
	- `src/vue/useViewportHostBridge.ts`
	- `src/vue/ViewportBusinessCanvasShell.ts`

## 3.1 入口分层

1. `src/index.ts`：统一入口（聚合 core/vue/main-ui/pixi）。
2. `src/core/index.ts`：内核数学子入口。
3. `src/pixi/index.ts`：pixi 渲染内核子入口。
4. `src/react-pixi/index.ts`：React 薄封装子入口。
5. `src/main-ui/index.ts`：main-ui 薄连接器子入口。
6. `src/vue/index.ts`：Vue 历史兼容层子入口。
7. `src/react-legacy/index.ts`：React 历史兼容层子入口。

设计约束：
1. 新增能力优先落在 pixi 内核层（`src/pixi/`），不再扩展 `Viewport2D` / `Viewport2DCanvas` 的 CSS transform 渲染路径。
2. **渲染内核唯一化**：`pixi.js` 是 peerDependency（tsup external），业务侧安装；`Viewport2DCanvas` 的 CSS `cameraTransform` + slot 模式不再用于对局视口。
3. 对外协议保持稳定：`getCamera`、`setCamera`、`fitToBounds`、`panBy`、`zoomAtScreenPoint`、`screenToWorld`、`worldToScreen`。
4. 薄连接器（`src/main-ui/`）不得承载业务渲染，只做窗口外观与注册。

## 3.2 coordinateAdapters 设计边界

`coordinateAdapters` 用于承载“坐标语义转换”和“旧项目迁移兼容”能力，避免业务仓库重复维护同类工具。

- 包含：
	- `camera2DToLegacy` / `legacyToCamera2D`
	- `clientToLocalCssPoint` / `localCssToWorld` / `worldToLocalCss`
	- `clientToWorldPoint` / `clientEventToWorldPoint`
	- `worldToLocalCssWithScroll`（过渡兼容）
	- `getDprScaleFromCanvas` / `localCssPxToCanvasPx` / `canvasPxToLocalCssPx`
- 不包含：
	- 业务领域对象（cell/edge/formula）
	- 具体应用交互状态机

## 3.3 Vue 宿主壳边界

`ViewportBusinessCanvasShell` 与 `useViewportHostBridge` 用于承载“宿主编辑器样板”，目标是减少业务仓库重复维护以下结构：

1. 左右侧栏 + 中央 stage 的三栏布局。
2. stage toolbar 的 leading / center / trailing 样板。
3. `client -> world`、`screen delta -> world delta`、`viewBox -> SVG/world style` 这类桥接胶水。

它们不负责：

1. 业务节点/边模型。
2. 业务面板字段。
3. 业务命令总线、服务容器、状态仓库。

## 4. 关于历史兼容层

1. `Viewport2D` 作为历史实现继续可用，但定位为兼容层。
2. 兼容层允许修复问题，不再承接新特性迭代。
3. 新模块请直接接入 pixi 内核（`src/pixi/`）或薄连接器（`src/main-ui/`）。
4. `resolveViewportEngine` 已统一返回 `engine: 'pixi'`；旧第三方引擎可用 `listLegacyViewportEngines()` 查询。

## 5. 关于 overlay 是否可交互（非常重要）

`Viewport2D` 的 overlay 在屏幕空间渲染（不随相机变换）。

为了避免 overlay 覆盖底层内容层（canvas/svg）导致点击失效，本库默认让 overlay 容器：

- `pointer-events: none`

如果业务需要“在 overlay 捕获点击”（例如棋类落子：需要依据 camera 把 screen→world 做命中），请在传入的 overlay 节点上显式设置：

- `style={{ pointerEvents: 'auto' }}`

## 6. 本地开发

- `pnpm install`
- `pnpm dev`（tsup --watch）
- `pnpm build`
- `pnpm typecheck`

说明：`viewport-2d-kit` 作为基础工具包，不提供 `dev:deps` / `build:deps`。依赖它的业务项目通过各自的 `dev:deps` 与 `build:deps` 统一调度。

构建产物将包含：

1. `dist/index.*`
2. `dist/core/index.*`
3. `dist/pixi/index.*`
4. `dist/react-pixi/index.*`
5. `dist/main-ui/index.*`
6. `dist/vue/index.*`
7. `dist/react-legacy/index.*`

## 7. 作为 file 依赖被引用时

本包对外只导出 `dist/`。

推荐联调：

1. 在本项目 `pnpm dev` 持续输出 `dist/`
2. 在使用者项目启动 dev server 并刷新
