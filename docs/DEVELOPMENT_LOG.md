# DEVELOPMENT_LOG

## 2026-08-27 · 0.3.0 浮动窗口（Window 层）+ 一期官方视图模板 + 模拟后端适配层示范

功能交付：

1. P0-1 浮动窗口：`WorkspaceState` 新增 `floatingWindows`（每个窗口持独立布局子树，与主树同构）；新增 `floatingWindow/popout` / `dockBack` / `updateGeometry` / `close` 四个 action 与 `clampFloatingGeometry` 越界归位助手；持久化版本升 3（v2→v3 迁移函数 + 测试）；Vue 层新增 `FloatingWindowLayer`（可拖动/可缩放窗内浮动层）与拖出/拖回出入口，`allowFloatingWindow` 逐 editor 门控；视图状态收集覆盖浮动窗口内表面（`MainUiViewLifecycle` 全链串联）。
2. P1-1 一期四模板包：`@main-ui/view-tree`（虚拟滚动树：过滤/展开/选中）、`@main-ui/view-inspector`（schema 表单）、`@main-ui/view-2d`（2d-kit docking-ready 封装，相机进 `getViewState`）、`@main-ui/view-table`（虚拟滚动表格：排序/行内编辑意图）；四包统一实现 `MainUiViewLifecycle` 四成员、零网络请求、颜色消费 `--mui-*`；聚合包 `@main-ui/preset-views` 命名空间重导出。
3. 模板包 `register.ts` 提供 `createXxxEditorRenderer(resolveProps?, extraProps?)` 与 `registerXxxEditor` 一键注册：数据经 Props（含三态）进、意图经 Emits 出。
4. P2-1 demo 模拟后端适配层：新增 `demo/src/adapter/`（`mockApi` 异步取数 + 失败率、`presetViewStore` 响应式仓库三态管理、`registerPresetViewEditors` 四模板接入端），演示「取数 → 转契约 → props 注入 → 意图裁决回写」标准链路。
5. 测试：主包新增 `floatingWindow.test.ts`（14 项），主包总量 31→45；四模板包新增 10+9+7+9 项；e2e 新增模板链路用例（1 → 3 项）。

验证：`pnpm typecheck`、`pnpm test`（主包 45 + 模板包 35 全绿）、`pnpm build`、`pnpm demo:build`、`pnpm test:e2e`（3 passed）全部通过；网络依赖扫描对全部 `packages/*/src` 零命中；核心包未引入 pixi/three（pixi 仅在 2d-kit 与 view-2d）。

文档：API_MANUAL（浮动窗口 + 模板包章节）、HOST_INTEGRATION_GUIDE（§9 模板安装与接入）、HOST_ADAPTER_GUIDE（§7 浮动窗口能力边界）、MIGRATION_GUIDE_0.3.0、本日志。

## 2026-08-27 · 0.2.0 契约先行 + 工程底座（monorepo）

仓库结构变更（包名映射）：

1. 仓库根转 pnpm workspace：`src/` + 构建/测试配置迁入 `packages/main-ui/`，包名保持 `main-ui`，导出面与产物结构不变；`demo/` 转 workspace 成员 `main-ui-demo`。
2. 迁入外部生态项目：`viewport-2d-kit` → `packages/viewport-2d-kit`（包名 `@main-ui/viewport-2d-kit`，入口面不变）；`viewport-3d-kit` → `packages/viewport-3d-kit`（包名 `@main-ui/viewport-3d-kit`，React 依赖转 optional，README 标注 React 层为兼容层、非主线）。
3. 预留 `packages/view-*`、`packages/theme`、`packages/preset-views` 空位（v0.3 交付）。
4. demo 端口改 4183（4173 与其他项目冲突），Playwright 同步；新增 `scripts/copy-release-docs.mjs` 供发布前复制 docs。

功能交付：

1. P0-1 Slot 正名与类型化：新增 `core/editor/slot.ts`（`SlotDescriptor` / `SlotLookup` / `slotCan` / `SlotRegistry`），editor 注册时自动叠加登记插槽，`resolve` 永不抛错、缺失返回显式 `missing`；既有 `rendererKey` 契约不变。
2. P0-2 快照降级占位：新增 `MissingViewSurface`，`EditorSurfaceHost` 接入 Slot 查找，未注册视图类型/缺失 renderer 时渲染「视图不可用（类型缺失）」占位，保留原标题、payload 与 restoreKey，提供关闭命令。
3. P0-3 Tab 溢出收纳：`LeafGroupRenderer` 重写，提供左右滚动按钮、溢出下拉菜单（点击切换隐藏 tab）、活动 tab 自动滚动，ResizeObserver 响应宽度变化。
4. P1-2 视图生命周期契约：新增 `core/editor/lifecycle.ts`（`MainUiViewLifecycle` 四成员契约 + `ViewLifecycleRegistry` 状态收集槽），runtime 暴露 `viewLifecycles`；完整串联随 v0.3 浮动窗口落地。
5. P2-1 前后端边界成文：API_MANUAL 新增「纯 UI 边界与数据契约」章节；HOST_INTEGRATION_GUIDE 新增「附录 A：对接后端」（四层分工、HTTP/WS 分工、长任务范式、Pydantic→OpenAPI→TS）；网络扫描基线零命中并列入发布检查项。
6. P3-1 主题变量规范：`main-ui.css` 重构为 `--mui-*` 规范令牌（`--main-ui-*` 与 `main-ui-theme--*` 保留兼容），`WorkbenchShell` 输出 `data-mui-theme` 根属性，`MainUiProvider` 以 matchMedia 监听作为 system 模式唯一解析来源；DEVELOPER_GUIDE 成文强制规范。
7. P4-1 插件契约预埋：`contribution/types.ts` 新增 `DockingViewContribution` / `PluginContributes` 纯类型，无任何运行时调度。
8. 新增 `slotLifecycle.test.ts`（9 项），测试总量 22→31。

验证：`pnpm typecheck`、`pnpm test`（31 passed）、`pnpm build`、`pnpm demo:build`、`pnpm test:e2e` 全部通过；网络依赖扫描（`fetch(` / `axios` / `XMLHttpRequest` / `WebSocket`）零命中；硬编码色值仅存于令牌定义区。

## 2026-08-25 · 0.1.1 MenuBar Flat Command Fix

1. 修复 `MenuBar` 顶层扁平命令项（无 `submenu`、直接挂 `commandId`）点击仅切换展开、不执行命令的问题；改为无子菜单时直接执行命令。
2. 新增 `menuRegistry` 单元测试，锁定「扁平 menubar 命令项是可执行命令项」契约。
3. 更新 README、API/developer/user/migration 文档与版本号到 0.1.1。
4. 通过 `pnpm typecheck`、`pnpm test`、`pnpm build` 验证，并生成 `main-ui-0.1.1.tgz`。

## 2026-08-24 · 0.1.0 Compatibility Release

1. 汇总 command/keybinding、Menu/Palette/Quick Open、schema settings、Sidebar/Panel contributions、layout v2 migration、tab drag/drop、accessibility/resilience 能力。
2. 更新 public exports、API/developer/user/host 文档，新增 migration guide、host example 与 upgrade checklist 基线。
3. 旧接入 API 与 persistence v1 自动迁移保持兼容；新能力全部 opt-in。
4. 通过 `pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm demo:build` 与 e2e 验证。
5. 发布包补充完整 `docs/` 目录与文档入口，安装后可从 `node_modules/main-ui/docs/README.md` 直接阅读。

## 2026-08-24 · 0.0.8 Accessibility 与 Runtime Resilience

1. 增加 EditorErrorBoundary、adapter timeout/异常隔离/cleanup 与 retry。
2. Overlay 增加 dialog ARIA、Escape dismiss、focus trap；tab strip 增加 roving tabindex/方向键导航。
3. 新增 `FeedbackHost` notification/confirm/progress 组件和 high-contrast token。
4. 通过 `pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm demo:build` 验证。

## 2026-08-24 · 0.0.7 Layout Persistence 与 Tab Experience

1. 新增 WorkbenchDocument v1→v2 迁移，补齐 chrome、tab history、recent workspace/editor。
2. 新增 pinned/preview/dirty/reorder tab action，Vue tab strip 支持拖拽排序与跨 group 移动。
3. 新增 `layout/setChromeState`，为 Sidebar/Bottom Panel 尺寸与显隐恢复提供持久化入口。
4. 通过 `pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm demo:build` 验证。

## 2026-08-24 · 0.0.6 Sidebar、Panel 与 Contribution Registry

1. 新增 view/panel/activity/status contribution 类型与 `ContributionRegistry`。
2. 新增 `Sidebar`、`BottomPanel`、`ContributionSurface`，支持默认可见、折叠、尺寸调节和 provider 缺失空态。
3. `WorkbenchShell` 自动承载 contribution 容器，2D/3D editor 仍通过原有 renderer/adapter 接入。
4. 通过 `pnpm typecheck`、`pnpm test` 验证。

## 2026-08-24 · 0.0.5 Schema-driven Settings

1. 新增独立版本化 `SettingsStore`、schema、scope 合并、校验、搜索、重置和 persistence adapter。
2. `MainUiCoreRuntime` 支持 `settingsPersistence`、迁移函数与 `registerSettingSchema`，旧 `WorkbenchDocument` 结构保持兼容。
3. 新增通用 Vue `SettingsEditor`，支持 string/number/boolean/enum/color 控件与错误提示。
4. 通过 `pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm demo:build` 验证。

## 2026-08-24 · 0.0.4 Menu、Command Palette 与 Quick Open

1. 新增 `MenuRegistry` 与 menu contribution 类型，支持一级菜单、子菜单、分隔符、排序和 `when`。
2. 新增 `CommandPalette`、`QuickOpen`、`ContextMenu` Vue 组件，统一调用 command。
3. `WorkbenchShell` 接入 `MenuBar` 与 `Ctrl/Cmd+Shift+P`、`Ctrl/Cmd+P` 快捷入口；无贡献时不渲染空菜单栏。
4. 通过 `pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm demo:build` 验证。

## 2026-08-24 · 0.0.3 Core Command 与快捷键

1. 为 `CommandRegistry` 增加统一 `executeCommand`、`when`/`enablement` 判断、异常结果和最近使用记录。
2. 新增 `KeybindingRegistry`，支持组合键解析、macOS 映射、权重覆盖和冲突检测。
3. Vue `MainUiProvider` 接入全局键盘监听与输入 focus scope；旧 command descriptor 无需修改。
4. 通过 `pnpm typecheck`、`pnpm test` 验证。

## 2026-08-23 · 0.0.2 本地版本包

1. 将 package version 从 `0.0.1` 更新为 `0.0.2`。
2. 通过 `pnpm typecheck`、`pnpm test`、`pnpm build` 验证。
3. 使用 `pnpm pack` 生成 `main-ui-0.0.2.tgz`，用于下游本地版本化安装。
4. 通过 relay updates outbox 向 autodo、complex-system-gallery、matheshop、scene-studio、yeegames 发布升级通知。
5. 本次采用本地 `.tgz` 分发，不等同于 npm registry 发布；下游升级为自愿、显式操作。

## 2026-04-30

完成 `main-ui` 从旧 React 壳层组件库到 Vue3 + core 工作台内核的首轮开发。

变更摘要：

1. 删除旧 React 源码、旧 demo 源码、旧 docs demo 与旧 demo-dist。
2. 包名改为 `main-ui`，移除 React peer/runtime 依赖。
3. 新增 `src/core/`：类型模型、layout helpers、reducer、registry、runtime、persistence。
4. 新增 `src/vue/`：runtime、provider、composables、WorkbenchShell、split renderer、leaf group、overlay layer、样式。
5. 新增 `src/adapters/` 与 `src/tokens/`。
6. 新增 Vue demo 与 host profile fixture。
7. 新增 core 单元测试。
8. 同步 README、API 手册、开发者指南、用户手册。

阶段 K/L 追加摘要：

1. 抽离 `demo/src/runtime/hostProfiles.ts`，集中维护 demo 与首批宿主 fixture。
2. 增加 `external-mount-demo`，通过 `EditorMountAdapter` 验证非 Vue 内容挂载路径。
3. 为 `matheshop-profile` 的 canvas placeholder 增加 pointer/focus 可观察反馈。
4. 增加 `tests/core/hostProfiles.test.ts`，校验 workspace/editor/default open request 的一致性。
5. 新增 [HOST_ADAPTER_GUIDE.md](HOST_ADAPTER_GUIDE.md) 记录 autodo-app、matheshop、yeegames 的接入草案。
6. 新增 [HOST_PROFILE_VALIDATION.md](HOST_PROFILE_VALIDATION.md) 记录阶段 K 验证范围、步骤和结论。
7. 扩写 README、API 手册、开发者指南、用户手册，完成阶段 L 文档同步。

Autodo 承接反馈补齐摘要：

1. Vue renderer 增加轻量 `IconToken` 渲染层，支持 workspace/editor descriptor 使用 `database`、`table`、`detail`、`graph`、`tex`、`settings` 等稳定图标 token。
2. Activity bar 增加底部 settings 入口，可把宿主注册的设置 editor 作为 overlay 打开。
3. Leaf tab group 补齐 `＋` editor selector、`↺` reopen recently closed、四向 split、close leaf 与 maximize/restore controls。
4. Status bar 改为 VSCode 式蓝色状态栏，显示设置入口、workspace/group/tab/theme 状态以及主题/布局快捷操作。
5. 默认 CSS 从 demo card 风格调整为更平直紧凑的 workbench 风格。
6. 空 leaf group 改为真正空白态，不再自动渲染推荐 editor launcher；宿主需通过该 leaf 顶部的 `＋` 明确打开 editor。

验证记录：

1. `pnpm typecheck` 通过。
2. `pnpm test` 通过，覆盖 core reducer 与 host profile fixture。
3. `pnpm build` 通过。
4. `pnpm demo:build` 通过。
5. VS Code 内置浏览器验证通过：Demo、external mount adapter、Matheshop pointer canvas、Settings overlay、Yeegames game-session 多实例均可交互。
6. VS Code 内置浏览器验证 autodo-app 承接版通过：activity bar `⚙`、status bar `⚙` 与 leaf `＋` selector 均可打开 settings overlay。

已知说明：

1. 阶段 H 的完整 command palette、菜单和快捷键映射未纳入本轮用户指定阶段。
2. 阶段 K 的真实宿主适配代码未纳入本轮，只完成中性 fixture 与接入草案验证。
3. 若 pnpm 对 `demo:dev` 脚本解析异常，可直接用本地 Vite 绝对路径启动 demo。

## 2026-05-01

新增 `viewport-2d-kit` 作为 editor foundation 的 demo 验证路径。

变更摘要：

1. `main-ui` demo 增加 `ViewportFoundationEditor.vue`，通过 `viewport-2d-kit/vue` 渲染可平移、缩放和 fit 的中性 2D 视口。
2. `hostProfiles.ts` 增加 `viewport-foundation` editor kind，并用于 `autodo-profile`、`matheshop-profile`、`yeegames-profile` 的图谱、公式画布与棋盘底座 fixture。
3. demo Vite 配置增加 `viewport-2d-kit` 源码 alias，保持 `main-ui/core` 不依赖 viewport 包。
4. README、用户手册、host adapter 草案与 host profile 验证记录同步到 viewport foundation 口径。
