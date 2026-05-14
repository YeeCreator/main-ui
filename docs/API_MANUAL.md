# API_MANUAL

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
  version: 1
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

## Registry

```ts
runtime.core.registerWorkspace(descriptor)
runtime.core.registerEditor(descriptor)
runtime.core.registerCommand(descriptor)
```

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
```

## Layout Helper

核心提供三种默认布局：

```ts
createSingleGroupLayout(options)
createTwoPaneLayout(options)
createThreePaneLayout(options)
```

宿主也可以直接构造 `LayoutDocument`。要求：

1. `rootNodeId` 必须指向现存节点。
2. 每个 leaf node 必须引用一个 `groups` 中存在的 group。
3. `activeGroupId` 必须存在。
4. `targetGroupId` 只能指向实际 group。

这些规则已由 `tests/core/hostProfiles.test.ts` 覆盖。

## Vue API

```ts
import {
  createMainUiRuntime,
  MainUiProvider,
  WorkbenchShell,
  useWorkbench,
  useActiveWorkspace,
  useActiveGroup,
  useActiveEditor,
} from 'main-ui/vue'
```

Renderer 注册：

```ts
runtime.vue.registerEditorRenderer('welcome-editor', WelcomeEditor)
runtime.vue.registerEditorMountAdapter('external-renderer', adapter)
```

`EditorMountAdapter` 不依赖任何外部框架，React、Canvas 或其他渲染库由宿主自行 mount / update / unmount。

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
4. `main-ui` 不把 React、p5、Konva、Three.js 作为依赖。

## Persistence

默认 persistence 是 localStorage adapter。宿主可以替换为自己的持久化层，只要实现 snapshot 的加载与保存。

`WorkbenchDocument` 是可序列化对象，适合写入 localStorage、IndexedDB、SQLite bridge 或云同步文档。宿主业务数据应只保存引用，例如 `documentId`、`sessionId`、`projectId`。

## Demo Fixture

阶段 K 的 host profile fixture 位于：

- `demo/src/runtime/hostProfiles.ts`

包含：

1. `hostProfileEditors`：中性 editor descriptor。
2. `hostProfileWorkspaces`：demo、autodo、matheshop、yeegames workspace。
3. `hostProfileValidationCases`：首批宿主验证表。

fixture 不是正式 API，但它是宿主接入的推荐参考写法。
