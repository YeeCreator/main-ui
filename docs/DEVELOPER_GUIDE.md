# DEVELOPER_GUIDE

## 当前版本与分发方式

当前工程版本为 `main-ui 0.4.0`（仓库为 pnpm workspace monorepo，主包位于 `packages/main-ui/`，包名仍为 `main-ui`，开发分支 `dev-v0.5`）。本版本已通过类型检查（12 包）、单元测试（106 项）、构建、demo 构建与 e2e（5 项），并生成 `.tgz` 供下游采用本地版本化方式安装。npm registry 发布尚未启用。

下游升级时使用 `pnpm add ../main-ui/main-ui-0.4.0.tgz` 或在 `package.json` 中更新对应 `file:` 路径；正在进行源码级联调时可保留 workspace 内链接。

## 架构边界

`main-ui` 分为四层（均位于 `packages/main-ui/src/`）：

1. `core/`：纯 TypeScript，禁止导入 Vue、DOM 组件库和业务服务。
2. `vue/`：官方 Vue3 renderer，只负责渲染、事件绑定和 provider 注入。
3. `adapters/`：外部内容挂载、图标、快捷键等通用契约。
4. `tokens/`：主题令牌。

## Monorepo 包地图

| 包 | 路径 | 说明 |
| --- | --- | --- |
| `main-ui` | `packages/main-ui` | 工作台内核（唯一对下游发布的主包） |
| `@main-ui/core` | `packages/core` | 框架无关表单基座（`FormFieldSchema` / `FormValues` / 校验纯函数） |
| `@main-ui/view-tree` | `packages/view-tree` | 模板：虚拟滚动树 |
| `@main-ui/view-inspector` | `packages/view-inspector` | 模板：schema 属性检视 |
| `@main-ui/view-2d` | `packages/view-2d` | 模板：2D 画布（基于 2d-kit） |
| `@main-ui/view-table` | `packages/view-table` | 模板：虚拟滚动表格 |
| `@main-ui/view-form` | `packages/view-form` | 模板：配置面板/表单 |
| `@main-ui/view-node` | `packages/view-node` | 模板：节点图（`@vue-flow/core` 薄封装） |
| `@main-ui/view-console` | `packages/view-console` | 模板：日志/控制台追加列表 |
| `@main-ui/preset-views` | `packages/preset-views` | 聚合包（仅命名空间重导出） |
| `@main-ui/viewport-2d-kit` | `packages/viewport-2d-kit` | 能力层：PixiJS 2D 视口 |
| `@main-ui/viewport-3d-kit` | `packages/viewport-3d-kit` | 能力层：Three.js 3D 视口（React 层为兼容层、非主线） |
| `main-ui-demo` | `demo` | 演示与验收工程（端口 4183） |

依赖铁律：`main-ui` 与 `@main-ui/core` 不依赖任何模板包、viewport kit 或重型渲染内核；模板包把 `main-ui`（与各自内核）声明为 peerDependency；聚合包只做重导出。

宿主业务不进入本仓库。`autodo`、`matheshop`、`yeegames` 等只在 demo fixture 中以中性 payload 表达。

## 目录地图（以 `packages/main-ui/` 为根）

1. `src/core/types.ts`：通用类型、Result、id/clock helper。
2. `src/core/editor/`：editor descriptor、instance、打开策略；`slot.ts`（SlotDescriptor / SlotLookup / slotCan / SlotRegistry 类型化插槽）；`lifecycle.ts`（`MainUiViewLifecycle` 视图契约与 `ViewLifecycleRegistry` 状态收集槽）；`viewModels.ts`。
3. `src/core/layout/`：split tree 类型、布局 helper、纯操作函数；`createLayout.ts`（三种默认布局）；`dropZone.ts`（`resolveDropZone` / `dropZoneToSplitDirection` 五向落点纯函数，v0.4）。
4. `src/core/floatingWindow.ts`：浮动窗口模型与 `clampFloatingGeometry` 越界归位（v0.3）。
5. `src/core/actions.ts` + `reducer.ts`：全部 action 定义与工作台状态机。
6. `src/core/runtime.ts`：registry（含 `slots`、`viewLifecycles`）、dispatch、订阅、persistence。
7. `src/core/persistence/`：adapters、migrations（v1→v2→v3）、types。
8. `src/core/{command,menu,settings,contribution,overlay,workspace,theme}/`：各领域类型与注册表；`feedback.ts` 反馈模型；`quickOpen.ts`。
9. `src/vue/`：provider、runtime、composables（`useWorkbench` / `useViewLifecycle`）、`dockingDrag.ts`（拖拽会话状态，v0.4）。
10. `src/vue/components/`：`WorkbenchShell`、`WorkbenchLayoutRenderer`、`LayoutNodeRenderer`、`LeafGroupRenderer`（溢出收纳）、`EditorSurfaceHost`、`EditorErrorBoundary`、`MissingViewSurface`（快照降级占位）、`FloatingWindowLayer`（v0.3）、`OverlayLayer`、`ActivityBar`、`TitleBar`、`MenuBar`、`CommandPalette`、`QuickOpen`、`ContextMenu`、`Sidebar`、`BottomPanel`、`StatusBar`、`FeedbackHost`、`IconToken`、`SettingsEditor`、`EmptyGroupLauncher`、`ExternalMountHost`、`ToolbarEditor`、`TreeEditor`。
11. `src/vue/styles/main-ui.css`：全部样式与 `--mui-*` 令牌定义区。
12. `src/adapters/`：mount adapter 等宿主扩展契约。
13. `tests/core/`：12 个核心行为测试文件；`tests/e2e/workbench.spec.ts`：Playwright e2e（5 项）。

模板包结构统一为：`src/types.ts`（数据契约）+ `src/<Name>View.ts`（主组件）+ `src/register.ts`（一键注册）+ `tests/`。

demo 关键目录：`demo/src/runtime/`（hostProfiles fixture、createDemoRuntime）、`demo/src/adapter/`（模拟后端适配层：`mockApi` + `presetViewStore` + `registerPresetViewEditors`）、`demo/src/editors/`（演示编辑器组件）。

## 开发顺序

推荐保持当前顺序：

1. 先改 core 类型和 reducer。
2. 用 `tests/core/` 固定行为。
3. 再改 Vue renderer。
4. 最后更新 demo fixture 与文档。

## 常用命令

```bash
pnpm dev          # 主包 dev
pnpm build        # workspace 构建（主包 + 2d-kit + core + 全部 view-* + preset-views）
pnpm typecheck    # 12 包类型检查
pnpm test         # 全部单元测试（106 项）
pnpm demo:dev     # demo（端口 4183）
pnpm demo:build
pnpm test:e2e     # Playwright e2e
pnpm analyze:dist # 主包产物体积报告
pnpm release:pack # build + 复制 docs 到包内 + pnpm pack
```

发布检查项（必须全绿）：

```bash
grep -rE "fetch\(|axios|XMLHttpRequest|WebSocket" packages/main-ui/src   # 必须零命中
grep -rE "fetch\(|axios|XMLHttpRequest|WebSocket" packages/*/src         # 必须零命中
```

## Reducer 规则

1. reducer 不访问 DOM。
2. reducer 不读写 localStorage。
3. reducer 不调用 Vue API。
4. 非法 action 返回 `Result` error。
5. layout tree 操作必须保持 groups、tabs、activeGroupId 一致。
6. 修改 tree 前先读取原始父子关系，再插入 replacement node。
7. 关闭 leaf 后要压缩空 split，避免 layout tree 留下悬空结构。
8. 浮动窗口子树与主树同构，布局操作函数应同时适用于两者（经 `floatingWindowId` 寻址）。

## Vue renderer 规则

1. 编辑器组件通过 `rendererKey` 注册。
2. 非 Vue 内容通过 `EditorMountAdapter` 注册。
3. 不在 Vue 层直接修改 core state。
4. UI 操作统一 dispatch action。
5. 强指针编辑器应放在 editor surface 内，不让 `main-ui` 知道具体渲染库。
6. provider 卸载时必须清理 runtime 订阅。
7. editor host 只读取 renderer registry，不导入业务 editor。
8. 大尺寸 overlay 应通过 `presentation.modalWidth` / `presentation.modalHeight` 声明建议尺寸，不在 renderer CSS 中硬编码全局弹窗宽度。
9. shell 字号由 `main-ui` 默认样式固定，宿主业务字号应限制在 editor renderer 内。
10. 拖拽会话（v0.4）只做视觉提示：指示器与 Ghost 预览不修改布局树中间态，只有落点确认才落 action，取消零残留。

### Slot 与视图生命周期

1. `runtime.core.slots`（`SlotRegistry`）类型化管理叶子插槽；`resolve(viewType)` 永不抛错，缺失返回显式 `{ status: 'missing' }`。
2. editor 注册自动叠加插槽登记；纯视图可经 `registerSlot` 单独登记。
3. 视图实现 `MainUiViewLifecycle` 后经 `runtime.core.viewLifecycles` 登记；布局保存时统一收集 `getViewState()`，恢复时调用 `restoreViewState`；`onDestroy` 必须幂等。

### Command 与快捷键

命令统一通过 `runtime.core.executeCommand(id, payload)` 执行。`when` 支持函数形式与 context-key 表达式；快捷键通过 `registerKeybinding` 注册，权重更高的宿主绑定优先解析。Vue provider 安装全局 keydown 监听，依据最近的 `data-main-ui-scope` 或输入控件自动设置 focus scope。

菜单通过 `registerMenu` 贡献；命令面板、Quick Open 和 context menu 复用同一 command registry。菜单贡献是 opt-in 的；没有菜单注册时 shell 不显示空菜单栏。

### Settings

设置 schema 与业务状态隔离，持久化通过 `settingsPersistence` 单独注入。迁移函数接收独立 `SettingsSnapshot`，设置控件不得把业务实体写入 `WorkbenchDocument`；宿主可注册自己的 `SettingsEditor` 或 provider。

### Contributions

View/panel descriptor 只声明 `rendererKey`/`providerKey`，不把 Vue 或业务服务引入 core。`ContributionSurface` 优先解析 Vue renderer，缺失时渲染明确空态。宿主可在自己的 renderer 中接入文件、搜索、终端、调试等 provider。

### Persistence 与 Tab

不要直接假设 `WorkbenchDocument.version === 1`；使用导出的 `migrateWorkbenchDocument` 或 runtime persistence 流程读取（自动经 v1→v2→v3 迁移）。tab 拖拽最终通过 reducer action 更新，宿主无需直接修改 layout tree。

### Accessibility 与 resilience

所有 renderer/adapter 都应允许错误边界接管；adapter 的 cleanup 必须幂等。需要将自定义焦点区标记为 `data-main-ui-scope`，并为 provider surface 提供 label。高对比度主题只覆盖语义 token，不要求宿主重写业务 editor 样式。

### 主题变量规范（强制）

1. 所有样式必须消费 `--mui-` 前缀的 CSS 变量（定义于 `packages/main-ui/src/vue/styles/main-ui.css` 头部 `:root`）；核心与内置组件不写死颜色（`#xxx`、`rgb(`），确需写死的须在 PR 中登记豁免理由。
2. `--main-ui-*` 变量与 `main-ui-theme--*` 类名仅为历史兼容保留，新代码一律使用 `--mui-*` 与 `data-mui-theme`。
3. 主题切换的唯一机制：`WorkbenchShell` 根元素输出 `data-mui-theme`（`light` / `dark` / `high-contrast`）属性，`[data-mui-theme='dark'|'high-contrast']` 选择器覆写变量；`system` 模式由 `MainUiProvider` 监听 `matchMedia('(prefers-color-scheme: dark)')` 解析并同步 `resolvedMode`。禁止在组件内自行读写主题类名或媒体查询。
4. 密度切换经 `data-mui-density="compact"`；尺寸消费 `--mui-row-height` / `--mui-row-height-dense` / `--mui-density-gap` / `--mui-control-height` / `--mui-toolbar-height` / `--mui-font-mono`。
5. 新增令牌时：先在 `:root` 与两套 `data-mui-theme` 覆写中同步定义，再在样式中消费；三套取值需同时补齐，避免暗色下漏改。
6. 发布审计基线：`main-ui.css` 中除令牌定义区（`:root` 与 `[data-mui-theme]` 覆写）外，不应再出现硬编码色值；模板包内联样式同样审计。

## 模板包开发规则（新增/修改 `@main-ui/view-*` 时）

1. 强制实现 `MainUiViewLifecycle` 四成员（`onDestroy` 幂等）。
2. 数据经 Props 注入（含 `loading` / `error` 三态），操作经 Emits 抛出；模板不取数、不缓存、零网络请求。
3. 颜色只消费 `--mui-*` 变量；密度消费 `--mui-row-height*` / `--mui-density-*`。
4. 保持每包统一结构：`types.ts` + 主组件 + `register.ts`（`createXxxEditorDescriptor` / `createXxxEditorRenderer` / `registerXxxEditor`）。
5. 修改契约后同步更新：包内 README、`docs/PRESET_VIEWS_GUIDE.md`、`docs/API_MANUAL.md`、demo adapter 接入。

## Mount Adapter 开发规则

外部 mount adapter 用于承载非 Vue 内容，包括宿主保留的 React 组件、Canvas 引擎、游戏画面或数学画布。

实现建议：

1. 在宿主项目创建 adapter，不在 `main-ui` 内创建业务 adapter。
2. `mount` 内创建第三方 renderer root，并把 cleanup 作为函数返回。
3. `update` 只同步轻量 context，不重建整个业务实例。
4. `unmount` 释放事件监听、renderer root、动画循环和业务订阅。
5. pointer 密集型 surface 自行处理 pointer capture、focus、keyboard shortcut 范围。

Demo 中的 `external-mount-demo` 是原生 DOM smoke test，用于证明契约本身不依赖框架。

## Host Profile Fixture

当前 demo 包含：

1. `workspace-demo`（Demo）：基础 smoke test。
2. `inspector-demo`（Inspector）：三栏信息布局。
3. `autodo-profile`（Autodo）：资料管理型宿主。
4. `matheshop-profile`（Matheshop）：画布型宿主。
5. `yeegames-profile`（Yeegames）：游戏库与多对局宿主。

七个官方模板编辑器经 `demo/src/adapter/registerPresetViewEditors.ts` 注册到全部 host profile workspace。fixture 只验证抽象，不迁移宿主业务。

新增 host profile 时需要：

1. 在 `hostProfileEditors` 增加 editor descriptor。
2. 在 `hostProfileWorkspaces` 增加 workspace descriptor。
3. 若是首批宿主验证对象，在 `hostProfileValidationCases` 增加检查项。
4. 为所有 default open request 设置有效 `targetGroupId`。
5. 运行 `pnpm test`，确认 `hostProfiles.test.ts` 通过。

## 文档同步规则

改变公开 API、host profile、adapter 契约或 demo 行为时，同步检查：

1. [API_MANUAL.md](API_MANUAL.md)
2. [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
3. [USER_MANUAL.md](USER_MANUAL.md)
4. [PRESET_VIEWS_GUIDE.md](PRESET_VIEWS_GUIDE.md)（涉及模板时）
5. [HOST_INTEGRATION_GUIDE.md](HOST_INTEGRATION_GUIDE.md)
6. [HOST_ADAPTER_GUIDE.md](HOST_ADAPTER_GUIDE.md)
7. [HOST_PROFILE_VALIDATION.md](HOST_PROFILE_VALIDATION.md)
8. [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md)

## 浏览器调试

1. 启动 demo dev server（`pnpm demo:dev`，端口 4183）。
2. 打开 `Demo` workspace，验证 Adapter editor。
3. 打开 `Matheshop` workspace，点击 Formula canvas。
4. 打开 `Yeegames` workspace，连续创建多个 game session。
5. 打开 Settings overlay，验证 dismiss/promote 不破坏 tab 状态。
6. 拖拽 tab 验证五向停靠指示器与 Esc 取消零残留。
7. 拖出浮动窗口，验证拖动/缩放/拖回/持久化恢复。
8. 打开七个模板编辑器，验证三态、意图回流与视图状态保存恢复。
