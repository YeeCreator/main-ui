# API_MANUAL

## 当前版本

本文档对应 `main-ui 0.13.0`（`@main-ui/core 0.12.0`，官方视图模板库 0.13.0）。API 以本地 `.tgz` 版本包交付。

本版新增：**缩略导航**（`@main-ui/view-minimap` 的 `Minimap` 组件；`core/rendering` 的 `minimapTransform` / `panToMinimapPoint` / `minimapViewportRect` / `contentWorldBounds` / `visibleWorldRectOfCamera`）。游戏小地图与画布导航**共用同一套坐标数学**，画法按 `kind` 分派。

本版移除：`view-canvas` 的 `cameraTransform` 插槽字段与 `cameraTransformOf` 函数（0.11.0 起标 deprecated，跨介质赋值静默失效的歧义源头；下游已全部改用 `svgTransform` / `cssTransform`）。

本版修复：`pixiViewport` 在组件于首帧前卸载时，rAF 兜底回调触发 `resize` 导致空引用崩溃；`destroy()` 现为幂等。

老版（0.12.0）新增：**视口双输出面**（`view-world` 的 `contentItems` + `content-layer` 插槽）、**内容层纯函数**（`projectContentLayer` / `cullContentLayer` / `prepareContentLayer` / `visibleWorldRect`）、**文字纹理档位**（`textResolutionFor` / `nextTextResolution`）、**引用三语义**（`RefRelation` / `refExpandsInline` / `checkEmbedChain`）、**白板编辑能力**（`view-sandbox` 拖拽/缩放/旋转/连线/内联编辑/撤销重做）与**轻内容元素**（`text` / `formula` / `link`）。

再前一版（0.11.0）新增：相机变换串分介质（`SvgTransform` / `CssTransform` 品牌类型、`cameraToSvgTransform` / `cameraToCssStyle`）、滚轮三维读数（`readWheel` / `zoomFactorOf`）、通用相机手势（`panOnMiddleDrag` / `panOnSpaceDrag` / `panOnShiftWheel`）、主题模式（`resolveThemeMode` / `useThemeMode` / `createSetThemeModeAction`）、设置页内置外观区块。

## 入口

- `main-ui/core`：核心模型与运行时。
- `main-ui/vue`：Vue3 渲染层。
- `main-ui/adapters`：外部内容挂载适配器。
- `main-ui/tokens`：主题令牌。
- `main-ui/styles.css`：默认样式。

## Core 类型

核心持久化状态是 `WorkbenchDocument`：

```ts
type WorkbenchDocument = {
  version: 1 | 2 | 3
  activeWorkspaceId: string
  workspaceStates: Record<string, WorkspaceState>
  theme: ThemeState
  settings: WorkbenchSettings
}
```

`WorkspaceState` 包含：

1. `layout`：split tree 与 leaf group。
2. `editors`：editor instance 轻量 payload。
3. `tabs`：tab surface。
4. `overlays`：临时 overlay session。
5. `recentlyClosed`：最近关闭 tab。
6. `focusHistory`：焦点记录。
7. `floatingWindows`（v0.3 新增）：`Record<FloatingWindowId, FloatingWindowState>`，每个浮动窗口持有独立布局子树、位置与尺寸。

## Registry

```ts
runtime.core.registerWorkspace(descriptor)
runtime.core.registerEditor(descriptor)
runtime.core.registerSlot({ viewType, constraints }) // 纯视图插槽登记（可选，editor 注册时自动叠加登记）
runtime.core.registerCommand(descriptor)
runtime.input.register({ commandId: 'demo.open', ...draftFromText('cmd+shift+press:KeyP') })
await runtime.core.executeCommand('demo.open')
runtime.core.registerMenu({ id: 'file.open', location: 'menubar', label: 'Open', commandId: 'demo.open' })
```

Command descriptor 的旧 `run(context)` 形式保持兼容。运行时会统一检查 `when`/`enablement`，记录最近执行命令，并将代码调用、菜单点击、快捷键、手势与命令面板全部归一到 `executeCommand`。

**输入与手势**：输入由 `@main-ui/core/input` 统一承接，`main-ui/core` 通过 `runtime.input` / `runtime.shortcuts` 暴露命令桥。旧式 `runtime.core.registerKeybinding({ commandId, keybinding: 'Ctrl+Shift+P' })` 仍然可用（解析层语法糖，语义不变），新代码建议用 `draftFromText` 或完整 `Binding` 表达更复杂的手势。

```ts
// 简单按键
runtime.input.register({ commandId: 'demo.open', ...draftFromText('press:KeyO') })
// 长按
runtime.input.register({ commandId: 'demo.hold', ...draftFromText('hold:Space:250') })
// 组合键（mac 上 cmd 即 ⌘，ctrl 映射到主修饰键）
runtime.input.register({ commandId: 'demo.save', ...draftFromText('cmd+press:KeyS') })
// 鼠标手势
runtime.input.register({ commandId: 'demo.erase', ...draftFromText('alt+drag:0:x:8') })
// 触控板
runtime.input.register({ commandId: 'demo.zoom', ...draftFromText('cmd+pinch:out') })
// 序列
runtime.input.register({ commandId: 'demo.go', ...draftFromText('press:KeyG then press:KeyG') })
```

`runtime.input` 接口：

| 成员 | 说明 |
| --- | --- |
| `register(registration)` | 注册绑定，返回 `bindingId`。接受完整 `Binding`、草稿 + `commandId`、或旧式 `{ commandId, keybinding }` |
| `unregister(idOrCommandId)` | 按绑定 id 或命令 id 注销 |
| `list()` | 当前生效绑定（默认 + 宿主 + 用户覆盖三层合并） |
| `pushScope(scope)` / `popScope(scope?)` | 输入作用域栈（`global` < `workspace` < `editor` < `canvas` < `modal`，深者优先） |
| `setInInput(boolean)` | 焦点是否在可编辑元素内（`allowInInput: false` 的绑定将不触发） |
| `captureOnce({ timeoutMs })` | 录制态：忽略既有绑定，返回首个识别出的手势草稿 |
| `cancelCapture()` | 取消录制 |
| `diagnose()` | 冲突 / 修饰键误用 / 不可达诊断；`conflict` 与 `modifier-press` 为阻断级 |
| `addProvider(provider)` | 注册原生输入源（Electron 桥扩展点） |
| `setUserOverride(id, { binding })` | 写用户覆盖；`binding: null` 表示解绑 |
| `resetUserOverride(id)` / `resetAll()` | 清除单个 / 全部覆盖 |
| `exportJson()` / `importJson(text)` | 导入导出；导入逐条校验，未知命令跳过并计数 |

命令上下文新增 `trigger` 字段：`{ bindingId, source, gesture, phase, delta? }`。连续手势（`mode: 'stream'`）会按 `begin → update* → end` 回调，`end` 的 `delta` 是累计位移。

`EditorDescriptor` 的关键字段：

1. `kind`：业务无关的编辑器类型。
2. `rendererKey`：Vue renderer 或 mount adapter 的注册键。
3. `capability`：是否允许多开、关闭、移动、overlay。
4. `presentation`：默认以 tab 或 modal overlay 打开，可声明 modal overlay 的建议宽高。
5. `availability`：允许出现的 workspace。

`WorkspaceDescriptor` 的关键字段：

1. `id`：稳定工作区 id。
2. `title`：显示名称。
3. `icon`：activity bar 使用的短标识。
4. `allowedEditorKinds`：本工作区可打开的 editor kind 白名单。
5. `createDefaultLayout`：返回默认 `LayoutDocument`。
6. `defaultOpenRequests`：首次进入工作区时打开的 editor 请求。

`EditorPresentationPolicy` 的关键字段：

1. `defaultSurface`：默认打开到 `tab` 或 `modal-overlay`。
2. `modalVariant`：modal overlay 的显示形态，当前支持 `centered-modal` 与 `anchored-popover`。
3. `modalWidth` / `modalHeight`：modal overlay 的建议尺寸，渲染层会再用视口最大尺寸约束。
4. `canPromoteModalToTab`：overlay 是否允许提升为普通 tab。

## Action

所有状态修改通过 `dispatch`：

```ts
await runtime.core.dispatch({ type: 'layout/splitLeaf', leafNodeId, direction: 'right' })
await runtime.core.dispatch({ type: 'editor/open', request: { editorKind: 'welcome' } })
await runtime.core.dispatch({ type: 'overlay/open', request: { editorKind: 'settings' } })
```

已实现 action 覆盖：

1. split leaf。
2. resize split。
3. close leaf。
4. maximize / restore。
5. open / close / activate / reopen editor tab。
6. move tab。
7. open / dismiss / promote overlay。
8. switch / reset workspace。
9. set theme mode。
10. floating window popout / dock back / update geometry / close（v0.3 新增）。
11. move tab to new split（v0.4 新增，停靠引导边缘落点）。

常用 action 类型：

```ts
type WorkbenchAction =
  | { type: 'workspace/switch'; workspaceId: string }
  | { type: 'workspace/reset'; workspaceId: string }
  | { type: 'editor/open'; request: EditorOpenRequest }
  | { type: 'tab/close'; tabId: string }
  | { type: 'tab/reopenRecentlyClosed'; groupId?: string }
  | { type: 'tab/move'; tabId: string; targetGroupId: string; targetIndex?: number }
  | { type: 'layout/splitLeaf'; leafNodeId: string; direction: 'left' | 'right' | 'up' | 'down' }
  | { type: 'layout/resizeSplit'; splitNodeId: string; firstRatio: number }
  | { type: 'layout/toggleMaximize'; nodeId: string }
  | { type: 'overlay/open'; request: EditorOpenRequest }
  | { type: 'overlay/dismiss'; overlayId: string }
  | { type: 'overlay/promoteToTab'; overlayId: string; targetGroupId?: string }
  | { type: 'floatingWindow/popout'; groupId: GroupId; tabIds?: TabId[]; position?: { x: number; y: number }; size?: { width: number; height: number } }
  | { type: 'floatingWindow/dockBack'; windowId: FloatingWindowId; targetGroupId?: GroupId }
  | { type: 'floatingWindow/updateGeometry'; windowId: FloatingWindowId; position?: { x: number; y: number }; size?: { width: number; height: number } }
  | { type: 'floatingWindow/close'; windowId: FloatingWindowId }
  | { type: 'editor/moveTabToNewSplit'; fromGroupId: GroupId; targetLeafNodeId: LayoutNodeId; tabId: string; direction: SplitDirection; floatingWindowId?: FloatingWindowId }
```

## 拖拽停靠引导（v0.4）

tab 拖拽至目标叶子组时，呈现五向落点指示器与 Ghost 预览，落点确认后一步落 action：

1. **五向落点纯函数**（`main-ui/core` 导出）：
   - `resolveDropZone(rect, point, edgeRatio?)`：根据指针位置解析 `top | bottom | left | right | center`；边缘带宽度 = 对应边长 × `edgeRatio`（默认 0.22），四角归入先命中的水平方向。
   - `dropZoneToSplitDirection(zone)`：边缘落点映射为分割方向（`up/down/left/right`），中心落点返回 `null`（组内堆叠）。
2. **action**：边缘落点经 `editor/moveTabToNewSplit`（携带 `floatingWindowId` 时作用于浮动窗口子树）；中心落点仍走既有 `tab/move`。
3. **渲染层**：Vue 层维护拖拽会话状态，渲染五向指示器与 Ghost 预览；能力仲裁沿用 Slot 能力方法。
4. **红线**：指示器与预览仅为视觉提示，不修改布局树中间态；只有落点确认（drop）才落 action，取消拖拽（Escape / 拖出释放）布局树零残留。

## 浮动窗口（Window 层）

tab 可拖出为浮动窗口，与主布局树同构（每个浮动窗口持有完整 split/leaf/group 子树）；布局快照只存引用，业务实例不重建。

1. **能力门控**：`EditorCapabilityPolicy.allowFloatingWindow` 为 `false` 的 editor 不出现拖出入口；标记查询经 Slot 能力方法统一走。
2. **动作**：`floatingWindow/popout`（目标 tab 连同 editor 实例从主树移入浮动窗口树）、`floatingWindow/dockBack`（逆操作，可指定目标 group）、`floatingWindow/updateGeometry`（拖动/缩放回写）、`floatingWindow/close`（窗口关闭，tab 回主树）。
3. **持久化**：浮动窗口位置、尺寸进入 `WorkbenchDocument`（version 3）；v2 → v3 迁移函数补齐 `floatingWindows: {}`。
4. **多显示器坑**：恢复时经 `clampFloatingGeometry(window, viewport)` 把越出当前视口的坐标/尺寸归位主视口内（至少保留 32px 标题栏可见）。
5. **渲染**：浏览器环境实现为「窗内浮动层」（绝对定位的可拖动、可缩放容器，`FloatingWindowLayer`）；升级为真实顶层窗口（Electron 宿主）的能力边界见 `HOST_ADAPTER_GUIDE.md`。
6. **视图状态串联**：保存布局时收集各活跃表面（含浮动窗口内）的 `getViewState()` 写入实例旁 `viewState` 槽；恢复时调用 `restoreViewState`。

## Layout Helper

核心提供四种默认布局：

```ts
createSingleGroupLayout(options)
createTwoPaneLayout(options)
createThreePaneLayout(options)
createFiveZoneLayout({ weights?, withSides? })   // 上 / 中 / 下 / 左 / 右
```

`createFiveZoneLayout` 生成的是一份**普通的 `LayoutDocument`**（不是特殊机制）：装配后与用户手工拖出来的布局完全等价，同样可拖拽、可持久化、可重置。

```ts
const layout = createFiveZoneLayout({ weights: { top: 0.1, bottom: 0.2 } })
layout.activeGroupId;   // 'five-group-center'
LAYOUT_TEMPLATES;       // [{ id: 'single' }, { id: 'three-zone' }, { id: 'five-zone' }]
```

宿主也可以直接构造 `LayoutDocument`。要求：

1. `rootNodeId` 必须指向现存节点。
2. 每个 leaf node 必须引用一个 `groups` 中存在的 group。
3. `activeGroupId` 必须存在。
4. `targetGroupId` 只能指向实际 group。

这些规则已由 `tests/core/hostProfiles.test.ts` 覆盖。

## 焦点服务（FocusService）

**焦点是唯一的事实源，且由布局派生** —— 不自持状态，因此不可能出现「布局关了页签但焦点还指着它」。

```ts
runtime.getFocus()        // FocusSnapshot（同步、无副作用）
runtime.onFocusChange((next, previous) => { ... })
runtime.leaveFocus()      // 焦点离开工作台（进入宿主自有面板）
```

`FocusSnapshot`：`{ viewInstanceId, viewType, groupId, tabId, workspaceId, reason }`。`reason` 取值 `'click' | 'programmatic' | 'close' | 'restore' | 'leave'`。

纯函数：`deriveFocus(document)`。

**订阅时不立即回调**（与 `runtime.subscribe` 刻意不同）：订阅者通常在挂载时才需要变更通知，首帧焦点由布局渲染自行处理；立即回调会造成「挂载即触发一次假变更」。

**keybinding 的 `when` 上下文已并入同一焦点源**，新增两个 key：

```
focusedView        // 当前焦点的编辑实例 id
focusedViewType    // 当前焦点的视图类型（= editor kind）
```

```ts
runtime.registerKeybinding({ commandId: 'world.reset', keybinding: 'F5', when: "focusedViewType == 'view-world'" })
```

## 实例绑定查询（宿主校验）

```ts
runtime.listSlotBindings(workspaceId?)          // 全部绑定（主树 + 浮动子树）
runtime.findBindingsByInstance(instanceId)      // 同一实例的多个表面
runtime.findBindingsByViewType('view-world')    // 同类型已打开的全部实例
runtime.checkInstanceQuota('view-world', 1)     // { status: 'ok' } | { status: 'duplicated', existing }
```

`SlotBinding`：`{ viewInstanceId, viewType, groupId, tabId, workspaceId, floating }`。

纯函数同名导出（`listSlotBindings` / `findBindingsByInstance` / `findBindingsByViewType` / `checkInstanceQuota`），可脱离 runtime 使用。

## 局部微件（视图附属部件）

视图可选实现 `ViewAuxiliaryContract`，向外输出**声明式数据模型**（不是 DOM、不是回调）：

```ts
const aux: ViewAuxiliaryContract = {
  getAuxiliaryItems: () => ({
    toolbar: [{ id: 'zoom-in', commandId: 'world.zoomIn', label: '放大', group: 0 }],
    status:  [{ id: 'zoom', commandId: 'world.showZoom', label: '100%' }],
  }),
}
```

`AuxiliaryItem` 字段：`id` · `commandId`（**唯一行为入口，禁 inline 回调**）· `label?` · `icon?` · `enabled?` · `checked?` · `danger?` · `group?` · `order?` · `tooltip?`。

纯函数：`normalizeAuxiliaryModel(model)`（去无效、去重、按 group/order 排序）· `mergeAuxiliaryModels(entries)`（多视图合并，id 冲突加视图前缀）。

**微件是展示，不是能力** —— 若某东西需要自己的注册表、生命周期、调度，它是 contribution，不是微件。

配置持久化（进布局快照）：

```ts
runtime.getAuxiliaryConfig()                  // AuxiliaryConfig | undefined
runtime.setAuxiliaryConfig({ toolbar: { visible: false } })
```

## 宿主透传元数据

```ts
runtime.getMeta<{ projectId: string }>()
runtime.setMeta({ projectId: 'p1' })
```

红线：**main-ui 不解释、不读取、不校验其内容**。一旦内核逻辑依赖其中字段，它就不再是「宿主元数据」而变成了内核契约。

## 视图尺寸回调

`MainUiViewLifecycle` 新增**可选**成员：

```ts
onResize?(width: number, height: number): void
```

不实现则行为完全不变。尺寸由 Vue 层的 `EditorSurfaceResizeBoundary` 统一观察（content box）并经 `runtime.notifyViewResize()` 下发 —— 视图不必自挂 `ResizeObserver`（那会造出 N 个观察器，且首次尺寸与布局计算存在竞态）。

纯渲染层也可直接调 `runtime.notifyViewResize(instanceId, width, height)`。

## Vue API

```ts
import {
  createMainUiRuntime,
  MainUiProvider,
  WorkbenchShell,
  ToolbarEditor,
  TreeEditor,
  useWorkbench,
  useActiveWorkspace,
  useActiveGroup,
  useActiveEditor,
} from 'main-ui/vue'
```

宿主若需要快速构建“顶部工具栏窗口”或“树状导航窗口”，可直接复用 `ToolbarEditor` 与 `TreeEditor`。其中 `ToolbarEditor` 默认按横向滚动工具栏条带渲染，并带基础点击激活态；宿主再在 wrapper 中补点击后的业务跳转。

Renderer 注册：

```ts
runtime.vue.registerEditorRenderer('welcome-editor', WelcomeEditor)
runtime.vue.registerEditorMountAdapter('external-renderer', adapter)
```

`EditorMountAdapter` 不依赖任何外部框架，React、Canvas 或其他渲染库由宿主自行 mount / update / unmount。

## 应用面（Surface，v0.8）

Surface 是 **Docking 布局树之外**的一层：决定「此刻整窗显示哪一整屏」。它与 Workspace **正交** —— Workspace 管同一份内容内部换哪些工具。

```ts
import {
  createSurfaceStack,
  useSurfaceStack,
  SurfaceHost,
  SurfaceShell,
  type SurfaceDescriptor,
  type SurfacePayload,
  type SurfaceStackApi,
} from 'main-ui/vue'
```

### `SurfaceDescriptor`

```ts
type SurfaceDescriptor = {
  id: string
  title: string
  component: Component      // 普通 Vue 组件，不是 IView
  root?: boolean            // 栈根，back() 不越过它
  description?: string
}
```

### `createSurfaceStack` / `useSurfaceStack`

```ts
const stack = createSurfaceStack({ initial: 'hall' })

stack.active.value            // 当前面 id，恒等于 stack.stack 末项
stack.stack.value             // 历史栈
stack.payloads.value          // 各面最近一次参数（运行期，不落盘）
stack.canBack.value           // 栈深 > 1
stack.open('options', { itemId: 'x' })
stack.back()
stack.reset()                 // 回栈根
```

`useSurfaceStack()` 在 `<SurfaceHost>` 内部 `inject` 同一实例，因此在面组件里可直接取用，无需层层传 props。在 `<SurfaceHost>` 之外调用会抛错（避免「点了没反应」难以定位）。

### `<SurfaceHost>`

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `surfaces` | `SurfaceDescriptor[]` | `[]` | 全部可用面 |
| `initial` | `string` | `''` | 初始面；缺省取第一个 `root` 面，再缺省取第一个面 |
| `transition` | `'none' \| 'fade' \| 'slide'` | `'none'` | 切换动效 |
| `keepAlive` | `boolean` | `false` | 是否缓存已访问面。默认切面即卸载 |
| `stack` | `SurfaceStackApi` | `null` | 外部注入的栈；缺省自建 |

| Emit | 载荷 | 说明 |
| --- | --- | --- |
| `change` | `(id, payload?)` | 面已切换 |
| `back` | `()` | 栈深减小时触发 |

| Slot | 说明 |
| --- | --- |
| `default` | 接管渲染：`({ descriptor, payload }) => VNode` |
| `missing` | 当前 id 无对应 descriptor 时的兜底：`({ id }) => VNode` |

### `<SurfaceShell>`

通用壳：标题 + 副标题 + 返回按钮 + 右侧操作区 + 主体。**不内置任何业务表单**。

| Prop | 说明 |
| --- | --- |
| `title` / `subtitle` | 标题区文本；都为空且无 `onBack`、无 `actions` 时不渲染标题栏 |
| `onBack` | 传入才渲染返回按钮并在此回调；不传则不渲染 |
| `backLabel` | 返回按钮文案，默认「返回」 |
| `theme` | 脱离 `WorkbenchShell` 独立渲染时同步 `data-mui-theme` |

| Slot | 说明 |
| --- | --- |
| `default` | 主体 |
| `actions` | 右侧操作区 |

### 关键约束

1. Surface **不进** Docking 布局树，**不实现** `MainUiViewLifecycle`，**不参与**布局快照。
2. `<SurfaceHost>` 一次只挂载一个面；切面即旧面 `unmount`（依赖此点释放渲染循环或连接的宿主可正常工作）。
3. Surface 的 `payload` 是**运行期传参**，不落盘 —— 与 editor 的持久化 `payload` 语义不同。
4. 原语**域无关**：多步向导、结账流程、配置流程与游戏大厅等价可用。
5. 单屏宿主不 import 即零影响。

## Mount Adapter

```ts
export type EditorMountAdapter = {
  mount: (container: HTMLElement, context: EditorRenderContext) => void | (() => void)
  update?: (container: HTMLElement, context: EditorRenderContext) => void
  unmount?: (container: HTMLElement) => void
}
```

生命周期：

1. `mount`：editor surface 首次进入 DOM 时调用。
2. `update`：同一个 tab payload、active 状态或 context 变化时调用，并传入当前容器。
3. `unmount`：tab 关闭、renderer 替换或 surface 卸载时调用。

注意：

1. adapter 返回的 cleanup 与 `unmount` 都会被尊重。
2. adapter 应自行管理第三方渲染库实例。
3. adapter 不应该把大型业务对象写入 `EditorInstance.payload`。
4. `main-ui` 主包与 `@main-ui/core` 不将任何渲染库作为**强制**运行时依赖；`@main-ui/view-*` 与 `@main-ui/render-*` 各自声明其渲染后端（四条判据见 `HOST_INTEGRATION_GUIDE.md`）。

## 官方视图模板包（@main-ui/view-*）

官方模板共 **15 个**模板包 + 1 个聚合包 + 1 个渲染后端包，均为独立 npm 包，`main-ui`（`^0.9.0`）为 peerDependency。**模板库的安装矩阵、接入三步与全量 Props/Emits/视图状态 API 见 [PRESET_VIEWS_GUIDE.md](PRESET_VIEWS_GUIDE.md)**；下表为速览：

| 包 | 内核 | 用途 |
| --- | --- | --- |
| `@main-ui/view-tree` | 自研虚拟滚动 | 目录/项目/场景树：过滤、展开折叠、多选 |
| `@main-ui/view-inspector` | schema 驱动表单 | 属性检视：`readonly` 字段、分组 schema，变更经 Emits 抛出 |
| `@main-ui/view-world` | `@main-ui/core/rendering`（pixi）+ 可插拔后端 | 世界视口：二维/三维两档共用同一模板，`dimension` 开关切换 |
| `@main-ui/view-canvas` | `@main-ui/core/rendering`（DOM/SVG） | DOM/SVG 画布视口：宿主自绘内容 + 相机/交互 |
| `@main-ui/view-table` | 自研虚拟滚动 | 表格浏览/编辑：多选 + 列宽拉伸 + 行内编辑意图 |
| `@main-ui/view-asset` | 自研网格虚拟滚动 | 资产网格 / 列表：缩略图由宿主注入（零网络）、搜索过滤、布局切换 |
| `@main-ui/view-form` | schema 驱动表单（`@main-ui/core` 基座） | 配置面板：含数组字段与条件显隐；提交/预设存取以意图抛出 |
| `@main-ui/view-node` | `@vue-flow/core`（peer `^1.48`） | 节点图/连线：视口与选中进 `getViewState`，移动/连线以意图抛出 |
| `@main-ui/view-console` | 自研虚拟滚动 | 日志/控制台追加列表：等级/文本过滤、自动跟随/锁滚、清空意图 |
| `@main-ui/view-flow`（v0.5） | `@vue-flow/core` + FSM 纯库 | 流程/状态机文档：类型化端口、双边（三件套：内核 + `FlowCanvas` + 薄壳） |
| `@main-ui/view-sandbox`（v0.6） | 自研 `SandboxKernel` | 自由沙盘画布（旗舰复合）：异构元素 + 嵌入任意 View + 嵌套保护 |
| `@main-ui/view-host-engine`（v0.6） | 无（纯 DOM 挂载点） | 外部引擎转播窗口：布局归我方、渲染归外部引擎 |
| `@main-ui/view-formula` | `katex`（peer） | 公式排版 + 变量级锚点 |
| `@main-ui/view-run-control` | 自研 | 运行控制（播放/暂停/步进） |
| `@main-ui/view-timeline` | 自研 | 时间轴 |
| `@main-ui/view-storyboard` | 自研 | 分镜/序列板 |
| `@main-ui/render-3d`（渲染后端，非模板） | `three`（peer） | 三维渲染后端：**无 editorKind**，只实现 `ViewportBackend`，被 `view-world` 解析 |
| `@main-ui/preset-views` | — | 聚合包：命名空间重导出（无逻辑） |

另：`@main-ui/core` 为框架无关的模板基座包，提供表单基座（含**数组字段** `kind: 'array'` 与**条件显隐** `visibleWhen`）、虚拟滚动基座、EmbeddedViewHost/嵌套保护、渲染基础设施（`core/rendering`）与图元系统（`core/primitives`），供全部模板共用，宿主自定义表单亦可单独消费。

每包统一结构：`types.ts` 数据契约（TS 类型）+ 主组件（`MainUiViewLifecycle` 四成员全实现）+ `register.ts` 一键注册：

```ts
import { registerTreeViewEditor } from '@main-ui/view-tree'

registerTreeViewEditor(
  runtime,
  { allowedWorkspaceIds: ['my-workspace'], title: 'Project Tree' },
  // resolveProps：把宿主数据转成模板契约（含 loading / error 三态）经 Props 注入
  (context) => ({ items: myStore.getItems(context.editor.id), loading: myStore.isLoading(context.editor.id) }),
  // extraProps：消费模板抛出的意图（Emits），裁决后回写宿主数据 → 受控回流
  (context) => ({ onSelect: (nodeId) => myStore.select(context.editor.id, nodeId) }),
)
```

红线：模板包不持有业务数据、不发起网络请求、颜色一律消费 `--mui-*` 变量；只消费 main-ui 公开面（注册契约、主题变量、视图状态契约）。宿主适配层职责（取数 → 转契约 → props 注入 → 意图裁决）见 `HOST_INTEGRATION_GUIDE.md` 与各包 README。

## 视口双输出面（v0.12）

GPU 视口缩放是对**已光栅化**内容整体放大，不重绘 —— 文字与公式因此放大即糊（光栅化固有性质，非参数问题）。修法是加一层浏览器绘制的内容面，两面**共用同一台相机**。

### `@main-ui/core/rendering` · content-layer

| 导出 | 说明 |
| --- | --- |
| `ContentLayerItem` | 内容项：`id` / `kind` / `anchor`（世界坐标 + 对齐）/ `size` / `data`（透传） |
| `visibleWorldRect(camera, size)` | 屏幕四角反算可见世界矩形（旋转取包围盒） |
| `projectContentLayer(camera, items)` | world→screen 投影，含锚点对齐 `offset` |
| `cullContentLayer(camera, size, items)` | 按世界坐标裁剪（**必须调用**） |
| `prepareContentLayer(camera, size, items)` | 裁剪 + 投影一步完成 |
| `ProjectedContentItem` / `WorldRect` / `ContentAnchor` | 相关类型 |

`view-world` 的 `contentItems` prop 消费上述契约，`content-layer` 插槽回传 `{ camera, size, visibleWorldRect, items }`。

**三条硬约束**：内容层不接收指针（命中统一走交互覆盖层，否则两套命中）；内容项不再施加相机变换（已算成屏幕坐标）；内容层恒在几何面之上（要交错需按带拆分）。

### `@main-ui/core/rendering` · text-resolution

| 导出 | 说明 |
| --- | --- |
| `TEXT_RESOLUTION_LADDER` | 档位阶梯 `[1, 2, 4, 8, 16]` |
| `TEXT_RESOLUTION_UP_FACTOR` / `TEXT_RESOLUTION_DOWN_FACTOR` | 升降档阈值（不等，构成滞回带） |
| `textResolutionTarget(scale, dpr)` | 目标倍数 |
| `textResolutionFor(scale, dpr)` | 无滞回档位（首帧用） |
| `nextTextResolution(current, scale, dpr)` | 带滞回的档位迁移 |

## 引用三语义（v0.12）

`@main-ui/core` 导出：

| 导出 | 说明 |
| --- | --- |
| `RefRelation` | `'embed' \| 'link' \| 'drill'` |
| `refExpandsInline(relation)` | 只有 `embed` 展开内容 |
| `checkEmbedChain(rootRefIds, resolveEmbeds, maxDepth?)` | 只沿 `embed` 边递归，**同时报告超深与成环** |
| `DEFAULT_MAX_EMBED_DEPTH` | 默认内联上限 `3` |

**存储是图、展开是树**：引用允许成环（双链必然成环），展开层负责检测并降级。

## 白板模板（`@main-ui/view-sandbox`，v0.12）

### 元素类型

| 档 | 类型 | 说明 |
| --- | --- | --- |
| 原生轻内容 | `shape` / `text` / `formula` / `link` | 模板直接渲染，**无需注册视图** |
| 资源 | `image` | 资源由宿主 provider 注入 |
| 嵌入视图 | `embed-view` | 引用已注册 `viewType`，走 `EmbeddedViewHost` |

### 内核（`SandboxKernelInstance`）

| 成员 | 说明 |
| --- | --- |
| `moveElement` / `resizeElement` / `rotateElement` | 几何变换 |
| `updateElementContent(id, patch)` | 只覆盖内容载荷，不动位置/尺寸（撤销粒度不同） |
| `addConnection` / `removeConnections` | 连线 |
| `canUndo` / `undo` / `redo` / `clearHistory` | 撤销重做（**只存文档，不存相机与选中态**） |
| `checkNesting` | 本层嵌入数量保护 |
| `toJSON` / `fromJSON` | 序列化（`fromJSON` 会清空历史） |

### 插槽与事件

| 名称 | 说明 |
| --- | --- |
| `embed-view` 插槽 | 回传 `{ elementId, viewType, payload, width, height }`，宿主据此渲染真实子视图；不提供时降级占位 |
| `element-edit-intent` | 进入内联编辑（供宿主接管为富文本/公式编辑器） |
| `open-ref-intent` | 请求打开另一内容，携带 `{ elementId, refId, relation }`。**跳转由宿主执行**（MUI 不懂文件系统） |

### 交互

拖拽移动 / 角柄缩放 / 圆柄旋转 / 拖端口连线 / 双击内联编辑（`Ctrl/Cmd+Enter` 提交、`Esc` 取消）/ `Ctrl/Cmd+Z` 撤销、`Ctrl/Cmd+Shift+Z` 或 `Ctrl/Cmd+Y` 重做 / `Delete` 删除 / `Shift` 多选。

## 缩略导航 / 小地图（v0.13）

「游戏小地图（质点法）」与「画布导航（缩放法）」除**简化画法**外每一步都相同：
算世界范围、世界↔缩略图映射、画视口矩形、点击跳转。而「点」在几何上就是
零宽高的矩形，故**共用一套坐标数学**，画法按 `kind` 分派 —— 不建两套实现
（那会得到两个世界↔小图换算，是同一件事两处实现的典型失败形态）。

**组件不重绘场景**：不复用 GPU 后端、不复制 DOM 节点，只画简化图元。
把文字与节点缩小重画一遍会带来双份显存与双份 DOM，是白板类应用最常见的
性能事故形态。

### `@main-ui/core/rendering` · minimap

| 导出 | 说明 |
| --- | --- |
| `contentWorldBounds(rects)` | 多项合并为外接矩形；空输入返回 `null`；退化时给最小 1 单位尺寸 |
| `minimapTransform(world, size, padding?)` | 世界↔缩略图映射，含 `worldToMinimap` / `minimapToWorld` / `worldRectToMinimap` / `minimapRectToWorld` |
| `minimapViewportRect(transform, viewport)` | 视口框绘制矩形（含最小可见尺寸，中心不变） |
| `panToMinimapPoint(transform, click, viewportSize, scale)` | 点击跳转的目标 `pan` |
| `visibleWorldRectOfCamera(camera, size)` | 由相机反算可见世界矩形 |
| `MINIMAP_VIEWPORT_MIN_SIZE` | 视口框最小绘制尺寸（`6`） |
| `MinimapTransform` / `MinimapSize` | 相关类型 |

**等比适配**：取两方向比例的**较小**值，宁可留白也不拉伸；内容在世界范围与
视口矩形的**并集**内居中。

**`pan` 符号方向极易写反**，故 `panToMinimapPoint` 由 core 统一提供，
宿主不要自己推公式。

### `@main-ui/view-minimap`

```ts
import { Minimap } from '@main-ui/view-minimap';
import '@main-ui/view-minimap/styles.css'; // 样式需宿主显式引入
```

| Prop | 说明 |
| --- | --- |
| `items` | `MinimapItem[]`：`{ id, world, kind?, points?, group?, highlighted? }` |
| `world` | **世界的固定范围**（世界坐标）。**强烈建议提供**：不给时范围退化为「内容包围盒 ∪ 视口」，内容为空（空场景、新建画布）时范围由视口决定，视口框会恒等于整块小图，看起来「框不动」 |
| `viewport` | 当前视口矩形（世界坐标）。与 `camera` 二选一，**前者优先** |
| `camera` / `viewportSize` | 不给 `viewport` 时由相机反算可见范围 |
| `shape` | `'rect'`（缺省）或 `'circle'`。世界是圆形时用 `circle`：内容按 `clipPath` 裁成圆，四角不再显示「实际不存在的区域」。形状只影响可视裁切与边框，坐标映射恒按世界范围等比适配 |
| `width` / `height` / `padding` | 缩略图尺寸与内留白（默认 180 / 120 / 6） |
| `panOnClick` | 点击是否抛 `navigate`（默认 `true`） |
| `renderContent` | 自定义内容绘制，回传 `{ transform, items, viewport }` |

| 事件 / 插槽 | 说明 |
| --- | --- |
| `navigate` | 载荷 `{ pan, world }`。**相机归宿主所有**，组件只算目标值不改状态 |
| `overlay` 插槽 | 自定义叠加层（比例尺、图例），回传 `{ transform }` |

**三种画法**：`point`（画圆，半径固定为像素值，缩放缩略图尺寸时点不变大）、
`rect`（按比例画框）、`path`（折线）。缺省按 `world` 是否零宽高自动判为
`point`。

## 视口操作手势（v0.13）

视口类模板内置两套并行的操作体系，**互不冲突**：

### 鼠标 + 键盘：`Alt + 三键`

| 组合 | 操作 |
| --- | --- |
| `Alt + 左键拖拽` | 旋转 |
| `Alt + 中键拖拽` | 平移 |
| `Alt + 右键拖拽` | 缩放 |

`Alt` 在 macOS 上即 `Option`。**未按 Alt 时三键语义完全不变** —— 左键仍是选择、
右键仍弹上下文菜单。按住 Alt 等于「临时进入视图操作模式」，松开即回到普通语义。

**为什么是「修饰键 + 三键」而非「中键 + 三个修饰键」**：三个鼠标键物理并排，
左中右 ↔ 旋转/平移/缩放 是**连续的空间映射**，靠本体感觉即可操作，不必低头
确认按对了哪个键；修饰键是离散切换，每次都要目视确认。这是 DCC 类软件的通用范式。

若宿主不需要这套（例如左键有强语义、不希望被 Alt 改写），设 `:alt-view-gestures="false"` 关闭。

### 触控板：双指

| 手势 | 操作 |
| --- | --- |
| 双指拖动 | 平移 |
| 双指捏合 | 缩放 |
| **双指扭转** | 旋转 |

**触控板扭转与桌面 Alt 旋转共用同一个落点**：两者最终都调
`rotateAtScreenPoint`，只是角度来源不同（前者取双指连线角度变化，后者取水平位移）。

> **平台差异须知**：双指扭转在**触屏**（`TouchEvent` 有真实多点坐标）可用；
> **macOS 触控板拿不到多指角度** —— 浏览器只给 `wheel` 的 `deltaX/deltaY`
> 与修饰键，这是平台限制而非实现缺失。故桌面上请用 `Alt + 左键` 旋转。

### `@main-ui/core/input` 的判定纯函数

| 导出 | 说明 |
| --- | --- |
| `altMouseGesture({ button, altKey })` | 判定 Alt + 鼠标键 → `'rotate' \| 'pan' \| 'zoom' \| 'none'` |
| `rotateDeltaFromDrag(deltaX, radiansPerPixel?)` | 水平位移 → 旋转弧度（缺省 0.01 rad/px） |
| `zoomFactorFromDrag(deltaY, perPixel?)` | 垂直位移 → 缩放倍率（指数映射，缺省 0.005） |
| `pinchRotateDelta(prevAngle, currAngle)` | 双指角度 → 旋转增量（±π 归一，避免跨界大跳） |
| `CameraGestureIntent` | 意图类型 |

三个换算函数都在 core 而非模板里，理由与 `panToMinimapPoint` 相同：
**符号方向极易写反**，收敛到一处才能单测锁死。

## Persistence

默认 persistence 是 localStorage adapter。宿主可以替换为自己的持久化层，只要实现 snapshot 的加载与保存。

`WorkbenchDocument` 是可序列化对象，适合写入 localStorage、IndexedDB、SQLite bridge 或云同步文档。宿主业务数据应只保存引用，例如 `documentId`、`sessionId`、`projectId`。

## 纯 UI 边界与数据契约

`main-ui` 是纯 UI 层：内核与视图模板不持有业务状态、不发起网络请求。与宿主/后端的边界规则：

1. **editor payload 为纯 JSON**：`EditorInstance.payload` 只存轻量引用与展示参数（如 `documentId`、`viewMode`），必须可被 `structuredClone` 与 JSON 序列化；禁止放入函数、DOM 节点、大对象。
2. **视图数据经 Props 进**：视图所需的业务数据由宿主适配层取数后经 Props/上下文注入，视图自身需声明式处理 `loading / error / data` 三态；`main-ui` 内置的 `EditorErrorBoundary` 与 `MissingViewSurface` 只兜底渲染层异常，不兜底业务数据。
3. **意图经 Emits 出**：视图内的业务操作（保存、提交、跳转）以事件/回调形式向外声明意图，由宿主适配层执行；视图不直接调用后端接口。
4. **禁止视图内网络请求**：`packages/main-ui/src` 对 `fetch(` / `axios` / `XMLHttpRequest` / `WebSocket` 的扫描必须零命中，该扫描列入发布检查项。
5. **Slot 契约**：叶子插槽经 `runtime.core.slots`（`SlotRegistry`）类型化管理，`resolve(viewType)` 永不抛错，未注册类型返回显式 `{ status: 'missing' }`，由 `MissingViewSurface` 渲染「视图不可用（类型缺失）」占位，保留原标题、payload 与 restoreKey，类型重新注册后可恢复。
6. **视图状态收集**：模板库视图可自愿实现 `MainUiViewLifecycle`（`getViewState` / `restoreViewState` / `onDestroy`），经 `runtime.core.viewLifecycles` 登记；布局保存时宿主可经收集槽统一收集视图内部状态（相机、展开节点、滚动等）。

## 图元与几何类型（`@main-ui/core/primitives`）

列式 `EntitySnapshot` 的每个批次声明一种 `geometry`：

| `EntityGeometry` | 图元项 | 语义 |
| --- | --- | --- |
| `'point'` | `SpriteItem`（`shape: 'circle'`） | 点 |
| `'sprite'` | `SpriteItem` | 精灵 / 矩形 |
| `'text'` | `TextItem` | 文字 |
| `'polygon'` | `PolygonItem` | **面**（闭合填充） |
| `'polyline'` | `PolylineItem` | **线 / 网络**（开放描边） |
| `'texture-quad'` | `TextureQuadItem` | **离屏纹理面片**（图像贴片，见下节） |

**`polygon` 与 `polyline` 不可混用**：前者用于区域/范围，后者用于折线网络与路径。
`polyline` 的填充只对 `closed === true` 生效——开放折线刻意只描边，避免把网络连成一片。

```ts
import {batchToPolylineItems, snapshotToItems} from '@main-ui/core/primitives';

const items = snapshotToItems(snapshot);   // → {texts, sprites, polygons, polylines}
```

渲染层（`@main-ui/view-world`）自动模式会为 `polylines` 批次建 `createPolylineLayer`。
`PolylineItem` 字段：`points` · `stroke` · `strokeWidth` · `closed` · `vertexRadius` ·
`vertexColor` · `fill` / `fillAlpha`（仅闭合生效）。

> 结构网络（位置列是弧长 `t` 而非 `x/y`）的宿主适配层需先解析出折线点列，
> 再按 `polyline` 批次交付；**不要**按「有 label 无坐标 → 文本」推断几何。

### 离屏纹理面片（`'texture-quad'`）：把二维栅格内容搬进三维视口

一张**二维图像**贴到三维空间的一个平面上。用于「大量实体、本质是一张二维栅格」的内容。

| 场景 | 策略 |
| --- | --- |
| 少量实体，需要真的立体感（个体有厚度、可各自倾斜） | 逐格图元 |
| **大量实体，本质是一张二维栅格**（元胞自动机、像素场、位图、大网格） | **`texture-quad`** |

判据是**开销与格数是否解耦**：64×64 元胞自动机有 4096 格，逐格提交 4096 组实例矩阵；
而它的语义本就是「一张会变的位图」，拆成 4096 个独立 3D 物体是过度建模。
用一个面片贴一张整图，**开销与格数无关**。

`TextureQuadItem` 字段：

| 字段 | 必填 | 语义 |
| --- | --- | --- |
| `x` · `y` | 是 | 世界平面坐标（中心点） |
| `width` · `height` | 是 | 面片尺寸（世界单位） |
| `texture` | 是 | **纹理键字符串**，由宿主解析器解析成图像源；空串视为无内容、整项跳过 |
| `z` | 否 | 离地高度，用于避免与地面图元共面闪烁 |
| `opacity` | 否 | 不透明度，缺省 `1` |
| `billboard` | 否 | 是否始终面向相机，缺省 `true`（悬空屏幕）；`false` 时**躺平贴地** |

**纹理源由宿主提供**，经 `createThreeBackend({ textureResolver })` 注入
（`@main-ui/view-world` 对应 prop 为 `quadTextureResolver`）。解析器签名
`(key: string) => QuadTextureSource | null`，源可为 `HTMLCanvasElement` /
`HTMLImageElement` / `ImageBitmap`。

**未提供解析器时不渲染任何面片** —— 宁可不出，也不画一块纯色板：
后者会让宿主误判为「内容已加载但显示不对」，而真实原因只是缺了图像源。

```ts
const backend = createThreeBackend({
  textureResolver: (key) => (key === 'board' ? boardCanvas : null),
});
```

动态内容（元胞自动机下一代）的约定：**解析器始终返回同一块 canvas 对象**，
改完画布内容后重新 `applySnapshot` 即可。渲染层按「源对象标识」判断是否复用纹理，
故不要每帧新建 canvas —— 那会让纹理持续重传。

## Menu、Command Palette 与 Quick Open

通过 `registerMenu` 注册 `menubar`、`editor/tab`、`workspace`、`view`、`panel` 或 `context` 入口；菜单项的 `when` 和 command enablement 与输入绑定共享同一上下文。Vue 层导出 `MenuBar`、`CommandPalette`、`QuickOpen`、`ContextMenu` 与 `ShortcutEditor`。`WorkbenchShell` 通过**默认绑定**提供 `⌘/Ctrl+Shift+P` 命令面板与 `⌘/Ctrl+P` Quick Open（不再是硬编码键位，用户可在快捷键面板改绑或解绑）。宿主只需注册 command/menu contribution 即可获得入口。`menubar` 顶层项若未配置 `submenu` 而是直接挂 `commandId`，会渲染为可直接点击执行的命令按钮（点击即触发命令）；配置 `submenu` 的项则展开为下拉子菜单。

## Settings schema

`runtime.core.registerSettingSchema({ id, title, type, defaultValue, scope })` 注册通用设置。`runtime.core.settings` 提供 `get`、`set`、`reset`、`search`、`validate`、独立版本化 snapshot 和可选 `SettingsPersistenceAdapter`；user/workspace/profile 按 profile > workspace > user > default 合并。Vue 导出 `SettingsEditor`，没有 schema 时不会改变旧的宿主设置 editor。

## Sidebar、Panel 与 Contributions

宿主可通过 `registerViewContribution`、`registerPanelContribution`、`registerActivityContribution` 和 `registerStatusContribution` 声明工作区辅助视图。Vue `WorkbenchShell` 自动提供 `Sidebar` 与 `BottomPanel` 容器；视图没有注册 renderer/provider 时显示稳定空态，不会让 shell 崩溃。Sidebar/BottomPanel 支持折叠、默认可见、尺寸调节和宿主在 workspace 切换时恢复自己的 active 状态。

### 侧栏：一次只显示一个 view

`Sidebar` 是 rail + 内容区，**只渲染当前激活的那一个 view**。注册的 view 多起来时，
用户靠点 rail 切换，而不是把所有面板竖着堆成一列（那会让侧栏高度失控）。

宿主可受控指定激活项与宽度：

| Props | 作用 |
| --- | --- |
| `activeViewId` | 宿主的**建议**面板（通常是「当前视角默认看哪块」） |
| `scopeKey` | 作用域键（一般传 workspace id）。变化时清空用户手动选择，使建议重新生效 |
| `preferredWidth` | 建议宽度（px）；用户拖动过分隔条后以用户宽度为准 |

分权规则由纯函数 `resolveSidebarActiveViewId` 决定，顺序不可调换：

1. **用户在当前作用域内点过 → 听用户的**。若让建议值永久优先，表现为「rail 点了没反应」；
2. 否则用 `activeViewId` 建议；
3. 再否则 `defaultVisible` / 首个。

`Sidebar` 与 `WorkbenchShell` 分别暴露 `activeViewId` / `sidebarViewId`、
`scopeKey` / `sidebarScopeKey`、`preferredWidth` / `sidebarWidth` 三对同名 prop。

### 侧栏宽度：边界分隔条 + 代码层收敛

宽度由**骑在侧栏与主区分界线上的分隔条（sash）**调整，不是栏内的滑块：

- 命中区 6px（向两侧各溢出 3px），视觉上只有悬停/聚焦时出现的 2px 高亮线，
  避免 6px 的分隔条被读成「栏里的一个控件」；
- 光标 `col-resize`，拖动期间锁 `body` 光标与选区（否则越过主区会顺带选中内容）；
- 可聚焦（`role="separator"` + `tabindex="0"`）：方向键 ±16px、`Shift` ±48px、`Home`/`End` 直达上下界；
- 双击恢复宿主的建议宽度；
- 侧栏收起态不渲染分隔条 —— 此时没有可调的边界。

宽度范围由 `SIDEBAR_WIDTH_MIN`（240）与 `SIDEBAR_WIDTH_MAX`（560）定义，
`clampSidebarWidth` 在**值进入状态时**收敛，并由 `Sidebar` 与 `WorkbenchShell` 共用。

> **不要在 CSS 里再加 `max-width` 兜底**。历史上侧栏样式写过 `max-width: 320px`，
> 后果是宿主传 460 时：声明是 460、`aria-valuenow` 报 460、实际渲染 320 ——
> 排查时看到的状态全是「对」的，只有量像素才发现被截。
> 收敛只应有一处，且在代码里。

### 活动栏分区：`WorkspaceDescriptor.pinToBottom`

活动栏分上下两区：上半区是**主视角**（共享同一份文档的不同布局预设），
下半区是**辅助入口**（文件、分析等）与设置。

若不分区、全部并列，活动栏会读成「一堆并列的 App」。设 `pinToBottom: true`
即可把某个 workspace 归入下半区。`IconToken` 已补齐 `math` / `folder` / `chart` /
`grid` / `layers` 等领域图标——缺映射时会退化成渲染原始英文串，与中文标题并列时很突兀。

## Layout persistence 与 tabs

持久化读取会自动将 `WorkbenchDocument.version: 1` 迁移到 v2，保留原 layout、tabs、editor payload，并补齐 chrome 状态、tab history、recent workspace/editor。新增 `editor/setTabState`（pinned/preview/dirty）、`editor/reorderTab` 和 `layout/setChromeState` action；tab 支持原生拖拽排序与跨 group 移动。

## Accessibility 与 resilience

Editor surface 具备 loading/error/retry boundary；`EditorMountAdapter` 的 mount/update/unmount 异常会被隔离并执行 cleanup，支持 `timeoutMs`。Overlay 使用 dialog/aria-modal、Escape dismiss 和 focus trap；tab strip 使用 roving tabindex 与方向键导航。`FeedbackHost` 提供 notification、confirm、progress 的可访问交互，样式包含 high-contrast token。

## Demo Fixture

阶段 K 的 host profile fixture 位于：

- `demo/src/runtime/hostProfiles.ts`

包含：

1. `hostProfileEditors`：中性 editor descriptor。
2. `hostProfileWorkspaces`：`workspace-demo`、`inspector-demo`、`docs-workspace`、`canvas-workspace`、`matches-workspace` 五个 workspace。
3. `hostProfileValidationCases`：首批宿主验证表。

fixture 不是正式 API，但它是宿主接入的推荐参考写法。

v0.3 起 demo 新增「模拟后端适配层」示范（`demo/src/adapter/`）：

1. `mockApi.ts`：模拟异步取数（延迟 + 可配失败率），产出领域数据。
2. `presetViewStore.ts`：响应式仓库（按编辑器实例隔离，三态管理）。
3. `registerPresetViewEditors.ts`：一期 + 二期共七个模板的接入端（取数 → 转契约 → props 注入 → 意图裁决回写）。
4. v0.4 补充：配置面板链路示范（view-form 提交 → 宿主校验裁决 → 模拟落库 → `patchViewData` 回填）、预设存储（存取以意图抛出）、日志流模拟（定时器追加 + 上限截断）。
