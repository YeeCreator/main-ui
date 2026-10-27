# PRESET_VIEWS_GUIDE

> 官方视图模板库（preset-views）统一指南。对应模板库 `0.9.0`（`@main-ui/core` 0.8.0 / 内核主包 `main-ui` 0.9.0）。本文档随 `main-ui` 包分发（`node_modules/main-ui/docs/PRESET_VIEWS_GUIDE.md`）；每个模板包自身的 `README.md` 是安装后的第一入口，内容与本文一致。

## 1. 定位

官方视图模板库为下游宿主提供「开箱即用 + 可扩展」的通用业务视图，使宿主专注后端与业务。全部模板是成熟开源内核的**薄封装**，不重写内核。

模板红线（接入评审项，全部强制）：

1. 实现 `MainUiViewLifecycle` 全四成员（`viewType` / `getViewState` / `restoreViewState` / `onDestroy`，其中 `onDestroy` 必须幂等）；视图状态随布局保存/恢复。
2. 数据经 **Props 进**（含 `loading` / `error` / data 三态），操作经 **Emits 出**（意图由宿主裁决）。
3. 包内**零网络请求**（发布检查项：网络调用扫描零命中）。
4. 颜色一律消费 `--mui-*` 主题变量；密度消费 `--mui-row-height*` / `--mui-density-*`。
5. 根元素自适应 Surface 尺寸；不持有业务数据。

## 2. 包清单与安装

### 2.1 包清单

| 包 | 版本 | 内核 | 用途 |
| --- | --- | --- | --- |
| `@main-ui/view-tree` | 0.3.0 | 自研虚拟滚动 | 目录/项目/场景树：过滤、展开折叠、选中高亮 |
| `@main-ui/view-inspector` | 0.4.0 | schema 表单（`@main-ui/core` 基座） | 属性检视：对象 + schema，变更经 Emits 抛出 |
| `@main-ui/view-world` | 0.8.0 | `@main-ui/core/rendering`（pixi）+ 可插拔后端 | 世界视口：二维/三维两档共用同一模板；相机状态进 `getViewState` |
| `@main-ui/view-canvas` | 0.8.0 | `@main-ui/core/rendering`（DOM/SVG） | DOM/SVG 画布视口：宿主自绘内容 + 相机/交互；取代已废弃的 `viewport-2d-kit/vue` |
| `@main-ui/view-table` | 0.3.0 | 自研虚拟滚动 | 表格浏览/编辑：单元格编辑意图经 Emits 抛出 |
| `@main-ui/view-form` | 0.4.0 | schema 表单（`@main-ui/core` 基座） | 配置面板：含数组字段与条件显隐；提交/预设存取以意图抛出 |
| `@main-ui/view-node` | 0.4.0 | `@vue-flow/core`（peer `^1.48`） | 节点图/连线：视口与选中进 `getViewState` |
| `@main-ui/view-console` | 0.4.0 | 自研虚拟滚动 | 日志/控制台追加列表：过滤、自动跟随/锁滚 |
| `@main-ui/view-flow` | 0.5.0 | `@vue-flow/core`（peer `^1.48`）+ FSM 纯库 | 流程/状态机文档：类型化端口、数据流/控制流双边（三件套：内核 + `FlowCanvas` 组件 + 薄壳） |
| `@main-ui/view-sandbox` | 0.6.0 | 自研 `SandboxKernel`（无头纯 TS） | 自由沙盘画布（旗舰复合）：异构元素 + 嵌入任意 View + 嵌套保护 |
| `@main-ui/view-host-engine` | 0.6.0 | 无（纯 DOM 挂载点） | 外部引擎转播窗口：布局归我方、渲染归外部引擎 |
| `@main-ui/view-formula` | 0.1.0 | `katex`（peer） | 公式排版 + 变量级锚点（源自数学工坊收编） |
| `@main-ui/view-run-control` | 0.1.0 | 自研 | 运行控制：播放/暂停/步进/速度 |
| `@main-ui/view-timeline` | 0.1.0 | 自研 | 时间轴：刻度 + 游标 + 区间选中 |
| `@main-ui/view-storyboard` | 0.1.0 | 自研 | 分镜/序列板：卡片序列 + 拖拽排序意图 |
| `@main-ui/render-3d` | 0.1.0 | `three`（peer，`WebGPURenderer` + TSL） | **渲染后端（非模板）**：无 editorKind，只实现 `ViewportBackend`，被 `view-world` 解析 |
| `@main-ui/preset-views` | 0.9.0 | — | 聚合包：命名空间重导出（无逻辑） |

配套基座：`@main-ui/core`（0.7.0）为框架无关模板基座：表单基座（`FormFieldSchema` / `FormValues` / 校验纯函数，含**数组字段**与**条件显隐**）+ 虚拟滚动基座（`computeVirtualWindow` / `isNearBottom`）+ 嵌入 View 托管（`createEmbeddedViewHost` / `checkNestingDepth`）+ 渲染基础设施（`core/rendering`：`ViewportBackend` 契约、后端注册表、相机桥）+ 图元系统（`core/primitives`），供各模板共用，宿主亦可单独消费。

### 2.2 安装矩阵

所有模板包把 `main-ui`（`^0.9.0`）与 `vue` 声明为 peerDependency，重型内核留在各包 peer 中，需显式安装：

```bash
# 按需安装（示例：只要树和表格）
pnpm add @main-ui/view-tree @main-ui/view-table main-ui vue

# 全量安装
pnpm add @main-ui/view-tree @main-ui/view-inspector @main-ui/view-world @main-ui/view-canvas @main-ui/view-table \
         @main-ui/view-form @main-ui/view-node @main-ui/view-console \
         @main-ui/view-flow @main-ui/view-sandbox @main-ui/view-host-engine \
         @main-ui/view-formula @main-ui/view-run-control @main-ui/view-timeline @main-ui/view-storyboard main-ui vue

# 聚合包（仅重导出，仍建议显式安装模板包本体）
pnpm add @main-ui/preset-views

# 三维档（可选后端；只装二维时不装即可，视图不会报错也没有开关）
pnpm add @main-ui/render-3d three troika-three-text
```

额外内核依赖：

| 模板 | 额外必装 |
| --- | --- |
| `view-world` | `@main-ui/core/rendering` + `pixi.js`（二维档）；三维档另装 `@main-ui/render-3d` |
| `view-canvas` | `@main-ui/core/rendering`（纯 DOM，无 pixi） |
| `view-node` | `@vue-flow/core@^1.48`（结构样式为包内 vendored，运行时自动注入，无需宿主处理） |
| `view-form` / `view-inspector` | `@main-ui/core`（peer） |
| `view-flow` | `@vue-flow/core@^1.48` + `@main-ui/core`（peer） |
| `view-sandbox` | `@main-ui/core`（peer，消费 EmbeddedViewHost/嵌套保护） |
| `view-formula` | `katex`（peer） |
| `view-host-engine` | 无（宿主自备外部引擎） |
| `render-3d` | `three`（`^0.186`）+ `troika-three-text`（均在包内 peer，由宿主显式安装） |

### 2.3 安装后文档位置

| 包 | 文档 |
| --- | --- |
| 各 `@main-ui/view-*` | `node_modules/@main-ui/view-*/README.md`（完整 Props/Emits/视图状态 API） |
| `@main-ui/preset-views` | `node_modules/@main-ui/preset-views/README.md` |
| `@main-ui/core` | `node_modules/@main-ui/core/README.md` |
| 统一指南（本文） | `node_modules/main-ui/docs/PRESET_VIEWS_GUIDE.md` |

## 3. 统一接入模式（三步）

每包统一结构：`types.ts`（数据契约 TS 类型）+ 主组件 + `register.ts`（一键注册）。

### 步骤 1：注册

```ts
import { registerTreeViewEditor } from '@main-ui/view-tree'

registerTreeViewEditor(runtime, { allowedWorkspaceIds: ['my-workspace'], title: 'Project Tree' })
```

- `options.allowedWorkspaceIds` 声明模板可出现的 workspace；同时需把模板 kind（`view-tree` / `view-inspector` / `view-world` / `view-canvas` / `view-table` / `view-form` / `view-node` / `view-console` / `view-flow` / `view-sandbox` / `view-formula` / `view-run-control` / `view-timeline` / `view-storyboard`）并入对应 `WorkspaceDescriptor.allowedEditorKinds`。
- 底层拆解可用：`createXxxEditorDescriptor(options)` 只生成 descriptor；`createXxxEditorRenderer(resolveProps?, extraProps?)` 只生成 renderer 适配器。

### 步骤 2：数据经 Props 进

`resolveProps(context)` 把宿主适配层数据转成模板契约（含 `loading` / `error` 三态）；模板不取数、不缓存。

### 步骤 3：意图经 Emits 出

`extraProps(context)` 转发模板事件；宿主裁决后回写自己的数据源，经受控回流更新视图。

完整示例：

```ts
registerTreeViewEditor(
  runtime,
  { allowedWorkspaceIds: ['my-workspace'], title: 'Project Tree' },
  // resolveProps：取数 → 转契约（三态）
  (context) => ({
    items: myStore.getItems(context.editor.id),
    loading: myStore.isLoading(context.editor.id),
    error: myStore.getError(context.editor.id),
  }),
  // extraProps：消费意图（Emits），裁决后回写
  (context) => ({ onSelect: (nodeId) => myStore.select(context.editor.id, nodeId) }),
)
```

聚合包用法：

```ts
import { tree, inspector, view2d, table, form, node, consoleView, flow, sandbox, hostEngine } from '@main-ui/preset-views'

tree.registerTreeViewEditor(runtime, { allowedWorkspaceIds: ['demo'] })
form.registerFormViewEditor(runtime, { allowedWorkspaceIds: ['demo'] })
node.registerNodeViewEditor(runtime, { allowedWorkspaceIds: ['demo'] })
consoleView.registerConsoleViewEditor(runtime, { allowedWorkspaceIds: ['demo'] })
flow.registerFlowViewEditor(runtime, { allowedWorkspaceIds: ['demo'] })
sandbox.registerSandboxViewEditor(runtime, { allowedWorkspaceIds: ['demo'] })
// hostEngine 无注册器（引擎与宿主强相关），直接消费组件：hostEngine.HostEngineView
```

## 4. 各模板 API

### 4.1 `@main-ui/view-tree`（虚拟滚动树）

组件 `TreeView`；注册 `registerTreeViewEditor`。数万节点只渲染可见切片。

Props：

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `items` | `ViewTreeNode[]` | 必填 | 树数据（`{ id, label, icon?, children? }`） |
| `loading` / `error` | `boolean` / `string \| null` | — | 加载三态 |
| `selectedId` | `string \| null` | `null` | 受控选中节点 |
| `expandedIds` | `string[] \| null` | `null` | 受控展开集合（`null` 不覆盖内部状态） |
| `filterable` | `boolean` | `true` | 是否显示过滤输入框 |
| `itemHeight` | `number` | `26` | 行高（虚拟滚动必需等行高） |
| `editorInstanceId` | `string \| null` | `null` | 传入则自动挂载视图生命周期 |

Emits：`select(nodeId)` / `toggle(nodeId, expanded)` / `filter-change(keyword)`。过滤为组件内部即时行为（命中路径自动展开），`filter-change` 供宿主做异步搜索扩展。

视图状态（`TreeViewState`）：`{ expandedIds, selectedId, filter, scrollTop }`。

### 4.2 `@main-ui/view-inspector`（schema 属性检视）

组件 `InspectorView`；注册 `registerInspectorViewEditor`。

Props：

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `schema` | `InspectorSchema` | 必填 | 字段定义数组（顺序即呈现顺序；支持 string/number/boolean/select） |
| `values` | `InspectorValues \| null` | `null` | 受控值表；缺省字段回退 `defaultValue` 再按 kind 推导 |
| `loading` / `error` | — | — | 加载三态 |
| `editorInstanceId` | `string \| null` | `null` | 挂载视图生命周期（值表 + 滚动进快照） |

Emits：`change({ key, value, previous })`——数值自动钳制 `min`/`max`，select 只接受 schema 内选项，值未变化不抛出。

### 4.3 `@main-ui/view-world`（2D 世界可视化）

组件 `WorldView`；注册 `registerWorldViewEditor`（`WORLD_VIEW_RENDERER_KEY`）。内核为 `@main-ui/core/rendering` 的 `PixiViewport`（PixiJS WebGL）。消费通用 `EntitySnapshot`，不绑定 scene-kit。

Props：

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `snapshot` | `EntitySnapshot \| null` | `null` | 自动渲染模式：通用实体快照 |
| `grid` | `GridSpec \| null` | `null` | 自动渲染模式：网格/棋盘图元规格 |
| `textureResolver` | `TextureResolver \| null` | `null` | 精灵纹理键解析器（可选） |
| `viewBox` | `ViewBox \| null` | `null` | 世界范围（相机 fit 目标）；缺省从 grid/snapshot 推导 |
| `minScale` / `maxScale` | `number` | `0.2` / `8` | 缩放边界 |
| `paddingPx` | `number` | `40` | fit 留白 |
| `background` | `number \| null` | `null` | pixi 数值色；`null` 时读取 `--mui-color-panel` 换算（主题跟随） |
| `antialias` | `boolean` | `false` | 抗锯齿 |
| `interactive` | `boolean` | `true` | 是否启用 InteractionLayer（点击/拖拽命中） |
| `panOnDrag` | `boolean` | `false` | 左键拖拽是否平移相机；棋类通常为 false |
| `zoomOnWheel` | `boolean` | `true` | 滚轮是否缩放（保留兼容；优先看 `wheelMode`） |
| `wheelMode` | `'auto' \| 'zoom' \| 'pan'` | `'auto'` | 滚轮/触控板分流：`auto`=捏合缩放·双指平移；`zoom`=一律缩放；`pan`=一律平移 |
| `clickButtonPolicy` | `'left' \| 'any'` | `'left'` | `world-click` 抛出策略：`left`=仅左键（右键抛 `world-contextmenu`）；`any`=旧行为（任意键） |
| `nativeGestureGuard` | `boolean` | `true` | 内置原生手势隔离（`user-select:none` / pointerdown `preventDefault` / 抑制右键原生菜单 / `touch-action`） |
| `rotateOnGesture` | `boolean` | `false` | 是否启用双指旋转手势（“单指按住 + 另一指拖动”） |
| `tapTolerancePx` | `number \| null` | `null`（自动） | 轻点容差（CSS 像素）：松手位移 ≤ 该值才算 `world-click`。缺省为**自动**——`panOnDrag=true` 取 4px，`panOnDrag=false` 取「不参与判别」（棋类轻点落子的原行为）。编辑器「拖拽移动实体」传 4；触摸端棋盘可传 10–12 |
| `rotateStep` | `number` | `π/12` | 旋转步长（弧度），供宿主自行绑定快捷键时复用默认值 |
| `loading` / `error` | `boolean` / `string \| null` | — | 加载三态 |
| `editorInstanceId` | `string \| null` | `null` | 挂载视图生命周期（相机进快照） |
| `dimension` | `2 \| 3` | `2` | 呈现维度：二维档（Pixi，缺省）或三维档（需注入 `@main-ui/render-3d`）。**切换时组件实例不销毁，相机态连续** |
| `backends` | `ViewportBackend[]` | `[]` | 额外注册的渲染后端（宿主注入 `createThreeBackend()` 即可获得三维档） |
| `backendKey` | `string \| null` | `null` | 指定后端键；`null` 时按 `dimension` 由注册表自动选择 |

Emits：`ready(api)`（手动模式逃生舱，返回**后端无关**最小句柄：画布尺寸 / 根容器 / `requestRender`；Pixi Application 与 three Scene 这类专属对象由各自后端包在自己公开面提供）/ `camera-change(camera)` / `world-pointerdown` / `world-pointerup` / `world-click`（默认仅左键）/ `world-contextmenu`（右键） / `cell-pointerdown` / `cell-click` / `cell-contextmenu` / `dimension-change(dimension)`。

自动渲染图元：Grid / Sprite / Text / Polygon / **Polyline**；`screen→world` 命中由 InteractionLayer 提供，抛出 world/cell 意图。

**Polygon 与 Polyline 的分工**（易混，务必按语义选）：

| 图元 | `EntityGeometry` | 语义 | 默认 `closed` | 典型用途 |
| --- | --- | --- | --- | --- |
| Polygon | `'polygon'` | **面**（闭合填充） | — | 区域、势力范围、命中区 |
| Polyline | `'polyline'` | **线 / 网络**（开放描边） | `false` | 折线网络、路径、连线 |

`PolylineItem` 字段：`points`（`number[]` 扁平数组或 `{x,y}[]`，与 Polygon 一致）· `stroke` · `strokeWidth` · `closed` · `vertexRadius` · `vertexColor` · `fill`（**仅 `closed === true` 生效**）· `fillAlpha`。

> 开放折线刻意**只描边、不填充**：把网络填充会把整张图连成一片，语义错误。
> 需要填充的闭合轮廓请用 `Polygon`。

批量数据来源示例（结构网络，位置列是弧长 `t` 而非 `x/y`）：

```ts
// 宿主适配层把结构本体解析成折线点列后，按 polyline 批次交付
batches.road = {
  kind: 'road',
  count: 1,
  geometry: 'polyline',
  columns: { points: [[0, 0, 40, 0, 40, 40, 0, 40, 0, 0]], stroke: [0x9aa4b2], strokeWidth: [1.5] },
};
```

#### 4.3.1 Web 手势隔离与鼠标键语义（游戏宿主推荐配置）

下游游戏宿主（实时战略 / 棋类 / 沙盘）推荐用如下配置，即可获得“左键选中 / 右键下令 / 触控板三手势”，无需逐浏览器逐平台自写兑底：

```vue
<WorldView
  :snapshot="snapshot"
  :view-box="viewBox"
  :interactive="true"
  :pan-on-drag="true"
  wheel-mode="auto"
  click-button-policy="left"
  :native-gesture-guard="true"
  :rotate-on-gesture="true"
  @world-click="onSelect"
  @world-contextmenu="onCommand"
  @ready="onReady"
/>
```

| 宿主意图 | 依赖能力 | 写法 |
| --- | --- | --- |
| 左键选中 | `world-click` 默认仅左键 | 监听 `@world-click`，`payload.button === 0` |
| 右键下令 | 右键走专用事件、不误触 `world-click` | 监听 `@world-contextmenu`（已屏蔽原生菜单） |
| 触控板捏合缩放 / 双指平移 | `wheelMode` skips | 默认 `auto`，无需额外代码 |
| 双指旋转 | 相机 `rotation` + `rotateOnGesture` | 开 prop 即用；或经 `ready.api.rotateAtScreenPoint()` 命令式控制 |
| 区分鼠标键 | `WorldPointerPayload.button` + `modifiers` | 读 `payload.button`（0/1/2）与 `payload.modifiers` |

**兼容性提示（v0.7.0 行为变更）**：`world-click` 默认从“任意键抛”改为“仅左键抛”。旧宿主若依赖右键也抛 `world-click`，传 `click-button-policy="any"` 可恢复旧行为；详见 `MIGRATION_GUIDE_0.7.0.md`。

**相机旋转**：`WorldCameraState` / `Camera2D` 增可选 `rotation`（弧度，缺省 0，向后兼容），已进 `getViewState` / `restoreViewState` 快照契约（旧快照无此字段照常工作）。

**与输入系统的关系**：滚轮/平移/捏合判型已上移到 `@main-ui/core/input`（`classifyWheel`），画布模板与宿主的快捷键系统共用同一口径，不再各自判 `deltaX` / `ctrlKey`。画布内手势（平移、缩放、旋转）仍由模板自身处理；若要把某个手势改绑到命令，用 `runtime.input.register` 并在 `scope: 'canvas'` 下声明。

#### 4.3.2 三维档（可插拔渲染后端）

三维能力**不是新模板**：`view-world` 是唯一的世界视口模板、唯一 editorKind、唯一组件实例，二维与三维是它的**两个可插拔后端**。维度是**后端属性**，不是包名属性 —— 因此不设 `view-3d`。

```ts
import { WorldView, registerThreeBackend } from '@main-ui/view-world'
import { createThreeBackend, configureTextRendering } from '@main-ui/render-3d'

// 1) 三维档使用文字前必须先指定字体来源（国内网络下若不指定会走 CDN，导致整帧崩）
configureTextRendering({ defaultFontURL: '/fonts/label.ttf', unicodeFontsURL: null })

// 2) 把三维后端交给模板；只装二维时不注册，视图不会报错、也不会出现开关
const backends = [createThreeBackend()]
```

```vue
<WorldView :snapshot="snapshot" :grid="grid" :backends="backends" :dimension="dimension" />
```

| 要点 | 说明 |
| --- | --- |
| 能力探测在运行时 | 维度开关由**已安装后端**的 `capabilities` 决定；只装二维的宿主自动没有开关，不会出现「声明支持三维但包没装」的假声明 |
| 切换不销毁实例 | 拨开关时组件实例不销毁，**相机状态天然连续**；宿主只注册一次 |
| 二维档是预设，非兼容层 | 二维档在三维后端里是写死的六条预设（正交投影 · 无光照 unlit · 线条禁贴图 · `devicePixelRatio` 对齐 · 网格命中 `col`/`row` 优先 · 悬停反馈专门规定）。**永久一等公民，不得标注为「兼容层」或「待废弃」** |
| 数据契约升维 | `EntitySnapshot.dimensions?: 2 \| 3`；`EntityBatch.columns` 支持可选 `z`（缺省 0）；图元项支持 `z` / `extrude`（缺省 0）。**全部可选**，旧快照完全兼容 |
| 文字分档 | 三维档走**公告牌二维贴片**（Canvas 2D 栅格化 → `CanvasTexture` → 平面 + 每帧对齐相机），二维档走 MSDF。两档互不替代 |
| 文字朝向 | `TextItem.billboard?: 'full' \| 'axis' \| 'none'`（缺省 `full`：完全面向相机） |

**宿主接入形态**：

| 宿主形态 | 做法 |
| --- | --- |
| 快照驱动型 | 注册三维后端 + `dimension` 开关；条目输出 `EntitySnapshot` 即自动获得两档 |
| 双轨存量 | 存量内容保持二维档不变，用户可拨到三维档（同一实例、相机连续） |
| 新条目 | 直接用 `createWorldStageRenderer` 建 `world-stage` 条目，3D-first，不留二维轨 |
| 手动模式自绘 | 若渲染走自有绘制而非快照，则**声明 2D-only**（不显示开关、不复制 `-2d` 目录） |

### 4.3.3 `@main-ui/view-canvas`（DOM/SVG 画布视口）

组件 `ViewportCanvas`（画布视口）+ `ViewportCanvasShell`（三栏业务壳）+ `useViewportHostBridge`（宿主自绘坐标桥）。内核为 `@main-ui/core/rendering` 的**相机纯函数**（**纯 DOM/SVG，不依赖 PixiJS**）。

**定位**：与 `view-world` 互补 —— `view-world` 面向「图元自动渲染 / 手动 PixiJS」，`view-canvas` 面向「**宿主自绘 SVG/DOM**」；后者取代已废弃的 `viewport-2d-kit/vue`。

`ViewportCanvas` Props：

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `viewBox` | `ViewBox` | 必填 | 世界范围（相机 fit 目标） |
| `minScale` / `maxScale` | `number` | `0.2` / `4` | 缩放边界 |
| `paddingPx` | `number` | `40` | fit 留白 |
| `disablePan` | `boolean` | `false` | 禁止左键拖拽平移（宿主用左键做框选等时置 true） |
| `zoomOnWheel` | `boolean` | `true` | 是否启用滚轮缩放 |

Emits：`zoomPercentChange(percent)` / `interactingChange(boolean)` / `cameraChange(camera, { width, height })`。

默认插槽回传：`{ width, height, cameraTransform, scale, camera }` —— 宿主在插槽内自绘 SVG/DOM，用 `cameraTransform` 施加相机变换。

Exposes（模板 ref）：`fitToBounds()` / `zoomIn()` / `zoomOut()` / `getCamera()` / `setCamera(camera)` / `screenToWorld(point)` / `worldToScreen(point)` / `getSize()`。

```vue
<ViewportCanvas
  ref="viewportRef"
  :view-box="viewBox"
  :min-scale="0.2" :max-scale="2.8" :padding-px="70"
  :disable-pan="marqueeActive"
  @zoom-percent-change="(v) => (zoomPercent = v)"
  @camera-change="(camera, size) => { cameraState = camera; viewportSize = size }"
>
  <template #default="{ width, height, cameraTransform }">
    <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`">
      <rect :width="width" :height="height" @click="clearSelection" />
      <g :transform="cameraTransform">
        <circle v-for="n in nodes" :key="n.id" :cx="n.x" :cy="n.y" :r="n.r" />
      </g>
    </svg>
  </template>
</ViewportCanvas>
```

`ViewportCanvasShell` Props：`leftPanelWidth` / `rightPanelWidth` / `toolbarHeight` / `collapseEmptySidePanels`；插槽：`left` / `default`（舞台主体）/ `right` / `toolbarLeading` / `toolbarCenter` / `toolbarTrailing`。

> **迁移提示**：从 `viewport-2d-kit/vue` 迁移只需把 `Viewport2DCanvas`→`ViewportCanvas`、`Viewport2DCanvasExpose`→`ViewportCanvasExpose`、`ViewportBusinessCanvasShell`→`ViewportCanvasShell`，API 完全兼容。

### 4.4 `@main-ui/view-table`（虚拟滚动表格）

组件 `TableView`；注册 `registerTableViewEditor`。

Props：

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `columns` | `TableColumn[]` | 必填 | 列定义（`key` / `title` / `width?` / `align?` / `sortable?`） |
| `rows` | `TableRow[]` | 必填 | 行数据（键值表） |
| `loading` / `error` | — | — | 加载三态 |
| `rowKey` | `string` | `'id'` | 行标识字段（缺省回退行索引） |
| `selectedRowId` | `string \| null` | `null` | 受控选中行 |
| `sort` | `TableSort` | `null` | 受控排序（`{ key, direction } \| null`） |
| `editable` | `boolean` | `true` | 双击单元格是否进入行内编辑 |
| `rowHeight` | `number` | `28` | 行高（虚拟滚动必需等行高） |
| `editorInstanceId` | `string \| null` | `null` | 挂载视图生命周期（滚动/选中/排序进快照） |

Emits：`row-select(rowId)` / `sort-change(sort)` / `cell-edit-intent({ rowId, columnKey, value })`（Enter/失焦提交，Esc 取消）。

### 4.5 `@main-ui/view-form`（配置面板，v0.4）

组件 `FormView`；注册 `registerFormViewEditor`。schema 驱动（`@main-ui/core` 基座），支持平铺字段与分组字段（分组优先）。

**`FormSchema` 是 `{ fields }` 或 `{ groups }` 对象，不是数组。** 完整示例：

```ts
import type { FormSchema, FormValues } from '@main-ui/core'

// ✅ 正确：schema 是对象，含 fields 或 groups
const schema: FormSchema = {
  groups: [
    {
      id: 'basic',
      title: 'Basic Settings',
      fields: [
        { kind: 'string', key: 'name', label: 'Name', required: true, minLength: 2 },
        { kind: 'number', key: 'hp', label: 'HP', min: 1, max: 999, defaultValue: 10 },
        { kind: 'boolean', key: 'visible', label: 'Visible', defaultValue: true },
        { kind: 'select', key: 'tier', label: 'Tier',
          options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
        { kind: 'textarea', key: 'notes', label: 'Notes', maxLength: 200 },
      ],
    },
    {
      id: 'advanced',
      title: 'Advanced',
      fields: [
        { kind: 'string', key: 'code', label: 'Code', pattern: '^[A-Z]{3}$' },
      ],
    },
  ],
}

// 或平铺模式（无分组）：
const flatSchema: FormSchema = {
  fields: [
    { kind: 'string', key: 'title', label: 'Title', required: true },
    { kind: 'boolean', key: 'active', label: 'Active' },
  ],
}

// ❌ 错误：schema 不是数组
// const wrong: FormSchema = [{ kind: 'string', key: 'x', label: 'X' }]

// 初始值（宿主侧单一事实源）
const values: FormValues = { name: 'Unit', hp: 10, visible: true, tier: 'a', notes: '' }
```

Props：

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `schema` | `FormSchema` | 平铺字段或分组字段 |
| `values` | `FormValues \| null` | 宿主侧单一事实源 |
| `loading` / `error` | — | 三态 |
| `presets` | `string[]` | 预设模板名称列表（宿主注入，视图不接触存储） |
| `presetsEnabled` | `boolean` | 预设条开关（默认开） |
| `submitLabel` | `string` | 提交按钮文案（默认 `Submit`） |
| `editorInstanceId` | `string \| null` | 挂载视图生命周期（表单草稿进快照） |

Emits：`change(FormChangePayload)`（单字段变更，含旧值）/ `submit({ values, valid, errors })` / `save-preset-intent` / `apply-preset-intent`（预设存取均走意图，存储介质由宿主决定）。

#### 4.5.1 数组字段（`kind: 'array'`）

数组字段渲染为「可增删的行列表」，每行内嵌 `itemFields` 定义的子控件：

```ts
const schema: FormSchema = {
  fields: [
    {
      kind: 'array', key: 'edges', label: 'Edges',
      minItems: 1, maxItems: 8,                       // 项数约束（触界时按钮禁用，不产生意图）
      itemFields: [
        { kind: 'string', key: 'from', label: 'From', required: true },
        { kind: 'string', key: 'to', label: 'To', required: true },
        { kind: 'number', key: 'weight', label: 'Weight', min: 0, max: 100, defaultValue: 1 },
      ],
    },
  ],
}
```

| 行为 | 说明 |
| --- | --- |
| 追加 / 删除 | 由视图内「＋ 添加一项」/「删除」按钮触发，受 `minItems` / `maxItems` 限制 |
| 意图形状 | **整体折叠为一次 `change`** —— `{ key: 'edges', value: 新数组, previous: 旧数组 }`，宿主无需为数组字段写第二套消费逻辑 |
| 越界 | 触界时按钮 `disabled`，且纯函数 `applyArrayIntent` 返回原引用（不产生意图） |
| 子字段显隐 | 子字段同样支持 `visibleWhen`，判断基准是**该行自身的值** |
| 嵌套数组 | 不支持（避免无限递归）；需要嵌套时由宿主拆成独立字段 |

校验语义：隐藏的子字段不参与校验；数组项数触界报 `min` / `max` 错误码。

#### 4.5.2 条件显隐（`visibleWhen`）

任意字段（含数组子字段、分组）可声明条件显隐：

```ts
{
  kind: 'string', key: 'proxyUrl', label: 'Proxy URL',
  visibleWhen: { field: 'useProxy', equals: true },      // 依赖字段值匹配时可见
}
{
  kind: 'string', key: 'note', label: 'Note',
  visibleWhen: { field: 'mode', equals: ['a', 'b'] },    // 数组 = 任一匹配
}
{
  kind: 'string', key: 'legacy', label: 'Legacy',
  visibleWhen: { field: 'mode', equals: 'v1', negate: true },  // 取反：匹配时隐藏
}
```

**校验联动（重要）**：条件隐藏的字段**不参与校验**。理由是用户看不见的必填项不应阻断提交 —— 否则表单会陷入「报错却找不到出错位置」的死局。此语义在 `validateFormValues` 与数组子字段校验中一致。

纯函数（`@main-ui/core` 直接可用）：`evaluateVisibility(field, values)`。

标准链路：提交 → 宿主校验裁决 → 落库（可异步）→ 经数据源回写回填。参考实现：`demo/src/adapter/registerPresetViewEditors.ts`。

### 4.6 `@main-ui/view-node`（节点图，v0.4）

组件 `NodeGraphView`；注册 `registerNodeViewEditor`。`@vue-flow/core` 薄封装；节点/边只接收纯 JSON，悬空边自动剪除；结构样式经运行时 `<link>` 幂等注入（带 document 守卫，SSR 自动跳过）。

Props：

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `nodes` | `NodeGraphData[]` | 节点（`id` / `label` / `position` / `data` 透传载荷） |
| `edges` | `NodeGraphEdgeData[]` | 连边（`source` / `target` / `label`） |
| `loading` / `error` | — | 三态 |
| `editable` | `boolean` | 是否允许拖拽节点/拉线（默认 `true`；选择恒可用） |
| `editorInstanceId` | `string \| null` | 挂载视图生命周期（视口/选中进快照，按实例隔离画布） |

Emits：`node-move-intent(NodeMoveIntentPayload)` / `node-connect-intent({ source, target })` / `selection(NodeSelectionPayload)`。

### 4.7 `@main-ui/view-console`（日志/控制台，v0.4）

组件 `ConsoleView`；注册 `registerConsoleViewEditor`。自研虚拟滚动追加列表。

Props：

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `entries` | `ConsoleEntry[]` | 日志条目（`id` / `level` / `message` / `timestamp?`，追加式） |
| `loading` / `error` | — | 三态 |
| `clearEnabled` | `boolean` | 是否呈现清空按钮（默认 `true`） |
| `rowHeight` | `number` | 行高（虚拟滚动定高，默认 20） |
| `editorInstanceId` | `string \| null` | 挂载视图生命周期（过滤/跟随态进快照） |

Emits：`clear-intent`（请求宿主清空数据源，是否执行由宿主裁决）。

呈现行为（视图本地）：等级/文本过滤、自动跟随/锁滚（手动上滚锁滚，贴底恢复跟随）、上限截断由宿主数据源承担。

### 4.8 `@main-ui/view-flow`（流程/状态机文档，v0.5）

组件 `FlowView`（L3 薄壳）/ `FlowCanvas`（L1 可嵌入组件）；注册 `registerFlowViewEditor`。`@vue-flow/core` 内核；与 `view-node` 的硬分界 = 类型化端口 + 数据流/控制流双边 + `node_type`/`content` 节点模型。包内附框架无关 FSM 纯库（`createMachine` / `interpret` / `machineToFlowDocument` 等），执行运行时不进包。

Props：

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `document` | `FlowDocument` | 流程文档（`nodes` 含 `node_type` 与类型化 `ports`；`edges` 分 `data`/`control` 信号；`node_layouts` 布局） |
| `loading` / `error` | — | 三态 |
| `editable` | `boolean` | 是否允许拖拽/连线（默认 `true`） |
| `editorInstanceId` | `string \| null` | 挂载视图生命周期（视口/选择进快照） |

Emits：`node-move-intent(FlowMoveNodeIntent)` / `connect-intent(FlowConnectIntent)` / `selection(FlowSelectionIntent)`。

视图状态（`FlowViewState`）：`{ viewport, selectedNodeIds, selectedEdgeIds }`。

### 4.9 `@main-ui/view-sandbox`（自由沙盘画布，旗舰复合模板，v0.6）

组件 `SandboxView`；注册 `registerSandboxViewEditor`；内核 `createSandboxKernel`（无头纯 TS，可 Node 单测）。2D 视口 + 异构元素（`shape` / `image` / `embed-view`）+ 连线；嵌入子 View 一律经 `@main-ui/core` 的 `EmbeddedViewHost`，嵌套深度保护默认 8 层（超限降级占位）；`onDestroy` 级联销毁全部子实例。不重新实现流程/节点逻辑（嵌入只走数据引用）。

Props：

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `document` | `SandboxDocument` | 沙盘文档（`elements` + `connections`；元素含 `shape` / `image` / `embedViewRef` 三类载荷） |
| `loading` / `error` | — | 三态 |
| `editable` | `boolean` | 是否允许拖拽/缩放/连线（默认 `true`） |
| `maxNestingDepth` | `number` | 最大嵌套深度（默认 `8`） |
| `editorInstanceId` | `string \| null` | 挂载视图生命周期 |

Emits：`element-move-intent` / `element-remove-intent` / `element-add-intent` / `connect-intent` / `selection`。

视图状态（`SandboxViewState`）：`{ camera, selectedElementIds, embeddedRefs }`（嵌入只存引用，不深拷贝子 View 数据）。

### 4.10 `@main-ui/view-host-engine`（外部引擎桥接，v0.6）

组件 `HostEngineView`（无一键注册器：引擎与宿主强相关，宿主自行组装注册）。第三方引擎「转播窗口」：模板零渲染零业务，只提供纯净 DOM 挂载点 + `ResizeObserver` 尺寸通知 + 标准视图生命周期。

Props：

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `engine` | `ExternalEngineApi \| null` | 外部引擎实现（`mount(container)` / `onResize(w, h)` / `destroy()`，宿主提供） |
| `loading` / `error` | — | 三态 |
| `editorInstanceId` | `string \| null` | 挂载视图生命周期（视图状态为容器尺寸） |

无 Emits（引擎交互归宿主）。**`onResize` 契约**：模板只通知尺寸变化，宿主引擎自行处理 resize 后重绘（如 p5 `resizeCanvas()` 会重置画布内容，pixi `renderer.resize()` 同理，宿主须在 resize 后重新渲染）。面向整屏外部渲染与任意外部渲染嵌入场景。

### 4.11 `@main-ui/view-formula`（公式视图 + 变量级锚点，v0.1）

组件 `FormulaView`；内核 `katex`（peer）。**本包不提供 `register.ts`**：它导出组件、契约与纯函数，由宿主自行组装注册（与 `view-host-engine` 同类）。

Props：

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `latex` | `string` | 必填 | 公式源（LaTeX） |
| `displayMode` | `boolean` | `true` | 行内 / 独立行公式 |
| `anchors` | `FormulaVarAnchor[]` | `[]` | 可锚定变量声明：`{ name, symbolId, occurrence?, hint? }` |
| `throwOnError` | `boolean` | `false` | 解析失败是否抛错（缺省渲染错误态） |

Emits：`anchor-hover(FormulaAnchorIntent)` / `anchor-click(FormulaAnchorIntent)` —— 载荷含 `name` / `symbolId` / `occurrence` / `clientX` / `clientY`（宿主据此定位弹窗）。

配套纯函数：`scanner.ts`（扫描 token 序列）、`anchor.ts`（锚点命中）。**符号解析与规范化由宿主（后端）完成，本包只消费映射结果。**

视图状态（`FormulaViewState`）：`{ expandedSymbolIds: string[] }`。

### 4.12 `@main-ui/view-run-control`（运行控制，v0.1）

组件 `RunControlView`；注册 `registerRunControlViewEditor`。播放 / 暂停 / 单步 / 重置 / 速率。**全部术语为通用仿真/控制语义（status / rate / tick），不含任何领域专属概念。**

Props：

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `status` | `'idle' \| 'running' \| 'paused'` | `'idle'` | 当前运行状态 |
| `rate` | `number` | `1` | 速率（tick/s，语义由宿主定义） |
| `tick` | `number` | `0` | 当前帧/步计数 |
| `connected` | `boolean` | `true` | 连接态（断开时禁用操作） |
| `canReset` | `boolean` | `true` | 能否重置 |
| `rateEditable` | `boolean` | `true` | 速率可否编辑 |
| `rateBounds` | `Partial<RunControlRateBounds>` | `{ min: 0.1, max: 1000, step: 1 }` | 速率输入边界 |
| `availability` | `RunControlAvailability \| null` | `null` | 显式覆盖各按钮可用性 |
| `statusLabel` | `string \| null` | `null` | 状态文案（宿主本地化） |
| `loading` / `error` | — | — | 三态 |
| `editorInstanceId` | `string \| null` | `null` | 挂载视图生命周期 |

Emits：`play` / `pause` / `step` / `reset` / `rate-change(rate)`。

视图状态（`RunControlViewState`）：`{ rateDraft: string }`（未提交的速率草稿）。

### 4.13 `@main-ui/view-timeline`（时间轴，v0.1）

组件 `TimelineView`；注册 `registerTimelineViewEditor`。帧序列时间轴 + 定位游标；**不自持播放时钟**，只呈现与抛出定位意图。

Props：

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `frames` | `TimelineFrame[]` | `[]` | 帧序列（`{ tick, time, label? }`，按时间递增） |
| `currentIndex` | `number \| null` | `null` | 当前定位帧索引；`null` = 实时（跟随最新帧） |
| `totalTicks` | `number \| null` | `null` | 总 tick 数（缺省由 `frames` 推导） |
| `liveLabel` | `string` | `'实时'` | 「实时」位置的显示文案 |
| `loading` / `error` | — | — | 三态 |
| `editorInstanceId` | `string \| null` | `null` | 挂载视图生命周期 |

Emits：`seek(index)`（提交定位）/ `scrub(index)`（拖拽中定位）/ `live`（切回实时）。

视图状态（`TimelineViewState`）：`{ currentIndex: number \| null }`。

### 4.14 `@main-ui/view-storyboard`（分镜/序列板，v0.1）

组件 `StoryboardView`；注册 `registerStoryboardViewEditor`。分镜卡片序列 + 注释编辑 + 导出。**截图由宿主在 `add-card` 意图回调中生成并回填，视图不自行截图。**

Props：

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `cards` | `StoryboardCard[]` | `[]` | 卡片列表（`{ id, tick, note, image? }`；`image` 为宿主生成的 data URL） |
| `draftNote` | `string` | `''` | 新增卡片的注释草稿（受控） |
| `addEnabled` | `boolean` | `true` | 新增按钮开关 |
| `exportEnabled` | `boolean` | `true` | 导出按钮开关 |
| `addLabel` / `exportLabel` / `draftPlaceholder` | `string` | — | 文案可覆写（宿主本地化） |
| `loading` / `error` | — | — | 三态 |
| `editorInstanceId` | `string \| null` | `null` | 挂载视图生命周期 |

Emits：`add-card(StoryboardCardDraft)`（仅含注释，`tick`/`image` 由宿主补全）/ `remove-card(id)` / `update-note(id, note)` / `update-draft(note)` / `export(StoryboardCard[])`。

视图状态（`StoryboardViewState`）：`{ draftNote: string }`。

### 4.15 `@main-ui/render-3d`（三维渲染后端，**不是模板**）

**命名 lane：`render-*` 无 `editorKind`、不可注册为编辑器、只实现 `ViewportBackend`**；被 `view-world` 解析，不被宿主直接挂载。

```ts
import { createThreeBackend, configureTextRendering } from '@main-ui/render-3d'
const backend = createThreeBackend()          // 交给 view-world 的 backends prop
configureTextRendering({ defaultFontURL: '/fonts/label.ttf', unicodeFontsURL: null })
```

主要导出：`createThreeBackend` / `configureTextRendering` / `createWorldStageRenderer` / `createSpriteText` / 保真对照判据（`render-3d/fidelity`）/ 外接两档契约（`render-3d/external`）。

硬规矩（违反即返工）：不写 GLSL、不用 `onBeforeCompile`（自定义着色器一律 TSL）· 同类实体必须共享原型几何再实例化 · 线不得独立成几何贴在平面上 · **文字不出现在 `core` 与主包的公开签名里**（three 类型止于本包内部）。

## 5. 宿主适配层职责（模板不承担）

1. 取数、缓存、三态管理（参考实现：`demo/src/adapter/` 的 `mockApi` + `presetViewStore` + `registerPresetViewEditors`）。
2. 编辑意图的校验/裁决与后端提交（含 `view-form` 的提交落库与回填）。
3. `view-world` 的世界内容绘制（自动渲染消费 `EntitySnapshot`；手动模式经 `onReady` 拿到 `PixiViewport`）。
4. 日志/条目流的生产与上限管理（`view-console`）、预设的存储介质（`view-form`）。
5. 编辑器实例关闭时的数据清理（可选，防内存增长）。
6. 停靠引导为内核内置交互，无需宿主接入；若宿主自实现拖拽，可复用 `main-ui/core` 的 `resolveDropZone` / `dropZoneToSplitDirection` 纯函数。

## 6. 扩展模式

1. **配置式**：经 props 开关行为（如 `filterable` / `editable` / `presetsEnabled`）。
2. **包装式**：在宿主侧包一层组件，组合模板与业务控件。
3. **自绘**：契约公开，宿主可直接实现 `MainUiViewLifecycle` 自绘任意视图并注册为 editor。

禁止修改模板源码；模板语义缺口应经反馈信道（反馈通道）回流。

## 7. 顺延与规划

- `view-asset`（资产网格）：v0.5 / v0.6 两度顺延（缩略图契约待下游信箱回执），继续顺延。
- 既有模板剩余增强（table 列拉伸/冻结/多选、tree 多选/懒加载、inspector 嵌套/数组、node 小地图、console 换行/导出等）与 `view-flow` 增强（diff/invert 撤销、反向 FSM 解析、自动布局、小地图）：见任务文档顺延清单。
- **三维能力 = `view-world` 的可插拔后端**（`render-*` lane）。不新建 `view-3d` 模板包：维度是**后端属性**，不是包名属性；模板永远只有 `view-world` 一个 editorKind。首个三维后端为 `@main-ui/render-3d`（three.js），二维档是它内部写死的预设（正交 · 无光照 · 线条禁贴图 · DPR 对齐 · 网格命中优先 · 悬停反馈规定）。详见 `design-main-ui-20260922-001` **§十九** 与 `HOST_INTEGRATION_GUIDE.md` 的包边界四条判据。
- 长期候选：`view-dashboard` / `view-chat` / `view-whiteboard` / `view-terminal`，按需求信号滚动（`view-timeline` / `view-storyboard` 已交付，见 §4.13 / §4.14）。
