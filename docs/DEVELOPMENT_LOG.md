# DEVELOPMENT_LOG

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
