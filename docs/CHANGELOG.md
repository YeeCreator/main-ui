# CHANGELOG

按版本归并的对外变更记录。每版本只列**使用者可见**的契约变化。

## 0.11.0（`@main-ui/core` 0.10.0，`view-canvas` 0.9.0，`view-world` 0.9.0，`view-sandbox` 0.7.0，`view-node` 0.5.0，`view-flow` 0.6.0）

1. **相机变换串分介质**：`cameraToSvgTransform` → `SvgTransform`、`cameraToCssTransform` → `CssTransform`（品牌类型），新增 `cameraToCssStyle`（返回含 `transformOrigin` 的样式对象）。跨介质赋值在 `tsc` 阶段失败 —— 此前无单位串放进 `style.transform` 会被浏览器静默丢弃整条声明。
2. **`view-canvas` 插槽拆名**：`cameraTransform` → `svgTransform` / `cssTransform`（旧名保留 1 个 minor）。
3. **通用相机手势内置**：`panOnMiddleDrag` / `panOnSpaceDrag` / `panOnShiftWheel`（默认全开）；判定纯函数入 `@main-ui/core/input`（`camera-gestures`）。
4. **滚轮判型收敛为三维读数**：`readWheel` 返回 `device` / `intent` / `modifier`；新增 `detectWheelDevice` / `zoomFactorOf`。`classifyWheelIntent` 改为委托。修复「同一个鼠标在 `view-canvas` 与 `view-world` 上判型不同」，以及 `Ctrl/⌘ + 鼠标滚轮` 套用触控板灵敏度导致倍率爆炸。
5. **相机表示统一**：`SandboxCamera` 改为 `Camera2D`；新增 `normalizeSandboxCamera`（迁移存量 `{x,y,zoom}` 快照）；`view-node` / `view-flow` 增显式双向桥（形状不变）。
6. **`view-sandbox` 相机接入渲染**：此前相机是「只写不读」的死状态（拖拽/缩放对画面零影响）。
7. **设置页内置外观区块**：`SettingsEditor` 新增 `showAppearance` prop，内置「主题模式（浅色/深色/跟随系统）」；新增 `resolveThemeMode` / `THEME_MODES` / `isSystemThemeMode` / `matchAppearance`。补齐设置页四组 class 的样式（此前完全无样式，官方页面是裸 HTML）。
8. **入口纪律**：`view-canvas` 停止转发 `@main-ui/core/*` 符号 —— 同一概念只许一条取得路径。
9. **主题变量统一**：`view-canvas` 样式改用 `--mui-color-*` 真源（`--main-ui-*` 保留为兜底）。

> 迁移细节见 `MIGRATION_GUIDE_0.11.0.md`。

## 0.10.0（`@main-ui/core` 0.9.0）

1. **docking 结构性增量**：焦点服务正式化（`core/editor/focus-service.ts`，焦点由布局派生、不自持状态）；局部微件体系（`core/editor/auxiliary.ts`，条目绑 `commandId`、禁 inline 回调）；侧栏与活动栏分区能力；停靠引导增强。
2. **持久化快照 v4**：新增焦点与微件字段，`v3 → v4` 自动迁移。
3. **新模板 `@main-ui/view-asset`**：资产网格（缩略图契约 + 多选 + 拖拽入出）。
4. **模板增强**：`view-form` / `view-table` / `view-console` 若干 prop 增补。
5. 全量安装矩阵与 `PRESET_VIEWS_GUIDE` 同步。

## 0.9.0（`@main-ui/core` 0.8.0，`@main-ui/view-form` 0.5.0）

1. **`view-form` 数组字段**：`kind: 'array'` 在视图层落地（此前 schema 侧已定义、视图层未消费）。
2. **`view-form` 条件显隐**：`visibleWhen` 在视图层生效，字段联动显隐可用。
3. 副作用：配置面板类场景可走向生产级。

## 0.8.0（`@main-ui/core` 0.7.0，`@main-ui/view-world` 0.8.0，`@main-ui/render-3d` 0.1.0）

1. **应用面（Surface）编排原语**：`SurfaceHost` + `useSurfaceStack`，承接「顶层整屏切换」。此前无归属层，各宿主只能自堆 `AppMode` + `v-if`。
2. **统一输入与手势系统**：`@main-ui/core/input` 的 `createInputRouter` + 主包 `InputController`，覆盖键盘、鼠标、触控板；长按/轻点/序列由识别器合成。旧 `KeybindingRegistry` 移除，`registerKeybinding` 字符串写法作为解析层语法糖保留。
3. **渲染后端抽象**：`ViewportBackend` 接口抽出，`view-world` 不再绑定单一渲染实现。
4. **新包 `@main-ui/render-3d`**：第一个可插拔三维渲染后端（WebGPU/TSL）。三维能力是 `view-world` 的可插拔后端，**不新建 `view-3d` 模板**。

## 0.7.0（`@main-ui/view-world` 0.7.0）

1. **鼠标键语义**：`WorldPointerPayload` 增 `button` / `modifiers`；`world-click` 默认仅左键，右键抛 `world-contextmenu`；新 prop `clickButtonPolicy`。
2. **滚轮/触控板分流**：新 prop `wheelMode`（`auto` / `zoom` / `pan`），core 新增 `classifyWheelIntent` / `wheelPanDelta` 纯函数。修复 macOS 触控板「双指平移失效」与「捏合无反应」。
3. **相机旋转**：`Camera2D` / `WorldCameraState` 增可选 `rotation`（向后兼容）；`screenToWorld` / `worldToScreen` / `zoomAtScreenPoint` 全面支持旋转；新增 `rotateAtScreenPoint` / `cameraRotation` / `rotateVec`。
4. **原生手势隔离内置**：`user-select:none` + pointerdown `preventDefault` + 右键菜单抑制 + `touch-action`，新 prop `nativeGestureGuard`。

## 0.6.0

1. **新模板 `@main-ui/view-sandbox`**：旗舰复合模板（外置引擎 + 沙盘视图）。
2. **新模板 `@main-ui/view-host-engine`**：外部引擎桥接（`ExternalEngineApi` 最小契约）。
3. 修复 `getViewState` 返回响应式 Proxy 导致 `structuredClone` 抛 `DataCloneError`（沙盘激活后下一次 dispatch 崩工作台）。
4. 修复 `view-table` 排序状态同类 Proxy 隐患。

## 0.5.0

1. **`view-flow` 三件套**：流程/状态机文档编辑器。
2. **虚拟滚动基座**：`view-table` / `view-tree` 大数据量可用。
3. **`EmbeddedViewHost`**：嵌入式视图宿主。
4. schema 扩展：新增若干 field kind。

## 0.4.0

1. **停靠引导拖拽**：五向停靠指示器 + Ghost 预览。
2. **二期三模板**：`view-form` / `view-node` / `view-console`。
3. **新包 `@main-ui/core`**：框架无关 core 从主包分出。
4. **主题密度变量**：`data-mui-density` 切换。

## 0.3.0

1. **浮动窗口（Window 层）**：拖出、拖动、缩放、拖回。
2. **一期四模板**：`view-tree` / `view-inspector` / `view-2d` / `view-table`。
3. **持久化 v3**：浮动窗口与分组位置纳入快照。

## 0.2.0

1. **monorepo 化**：主包迁入 `packages/main-ui/`，官方模板拆为 `@main-ui/view-*`。
2. **契约先行**：Slot 类型化管理、占位图、tab 溢出收纳。
3. 公开 API 只增不改。

## 0.1.1

1. MenuBar 扁平命令项修复。

## 0.1.0

1. Vue 3 渲染层首发：`MainUiProvider` / `WorkbenchShell` / MenuBar / Sidebar / Bottom Panel。
2. 工作台文档模型：split tree、tab、editor、overlay。
3. 持久化 v1 → v2 迁移。
4. 不兼容旧 `main-ui-react`。

## 0.0.4 — 0.0.8

1. **0.0.4**：Menu、Command Palette、Quick Open。
2. **0.0.5**：schema 驱动设置。
3. **0.0.6**：Sidebar、Panel 与 Contribution Registry。
4. **0.0.7**：布局持久化与 tab 体验。
5. **0.0.8**：无障碍与运行时韧性。

## 0.0.2 — 0.0.3

1. **0.0.2**：本地版本包与文档体系起步。
2. **0.0.3**：core command 与快捷键。

## pre-release（0.x 开发线）

1. 世界视口改用 `@main-ui/view-world`（内核 `@main-ui/core/rendering`）。
2. `@main-ui/view-canvas`：DOM/SVG 画布视口，与 PixiJS 路线互补。
3. `@main-ui/view-formula`：KaTeX 公式视图 + 变量级锚点。
4. `@main-ui/core/primitives` 新增 `polyline` 折线图元（开放折线一律只描边）。
5. `main-ui-contextmenu`：Web 端右键屏蔽 + 宿主可接管的上下文菜单事件。
6. app-壳 GUI 原语：`LandingView` / `GalleryView` / `StageView` + `WorkbenchShell` app 模式。
7. 控制视图三件套：`view-run-control` / `view-timeline` / `view-storyboard`。
8. `viewport-2d-kit` / `viewport-3d-kit` 移除，能力收编进官方模板。
