# DEVELOPER_GUIDE

## 当前版本与分发方式

当前工程版本为 `main-ui 0.1.1`。本版本已通过类型检查、核心测试和构建，并生成 `main-ui-0.1.1.tgz` 供下游采用本地版本化方式安装。npm registry 发布尚未启用。

下游升级时使用 `pnpm add ../main-ui/main-ui-0.1.1.tgz` 或在 `package.json` 中更新对应 `file:` 路径；正在进行源码级联调时仍可保留 `file:../main-ui`。

## 架构边界

`main-ui` 分为四层：

1. `src/core/`：纯 TypeScript，禁止导入 Vue、DOM 组件库和业务服务。
2. `src/vue/`：官方 Vue3 renderer，只负责渲染、事件绑定和 provider 注入。
3. `src/adapters/`：外部内容挂载、图标、快捷键等通用契约。
4. `src/tokens/`：主题令牌。

宿主业务不进入本仓库。`autodo-app`、`matheshop`、`yeegames` 只在 demo fixture 中以中性 payload 表达。

## 目录地图

1. `src/core/types.ts`：通用类型、Result、id/clock helper。
2. `src/core/editor/`：editor descriptor、instance、打开策略。
3. `src/core/layout/`：split tree 类型、布局 helper、纯操作函数。
4. `src/core/reducer.ts`：工作台状态机。
5. `src/core/runtime.ts`：registry、dispatch、订阅、persistence。
6. `src/vue/`：Vue provider、shell、layout renderer、editor host。
7. `src/adapters/`：mount adapter 等宿主扩展契约。
8. `demo/src/runtime/hostProfiles.ts`：阶段 K 的宿主 fixture。
9. `tests/core/`：核心行为和 host profile 契约测试。

## 开发顺序

推荐保持当前顺序：

1. 先改 core 类型和 reducer。
2. 用 `tests/core/` 固定行为。
3. 再改 Vue renderer。
4. 最后更新 demo fixture 与文档。

## 常用命令

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm demo:build
pnpm run demo:dev
```

说明：`main-ui` 作为基础工具包，不引入 `*:deps` 维度。联调时由上层业务项目通过 `dev:deps` / `build:deps` 统一调度。

## Reducer 规则

1. reducer 不访问 DOM。
2. reducer 不读写 localStorage。
3. reducer 不调用 Vue API。
4. 非法 action 返回 `Result` error。
5. layout tree 操作必须保持 groups、tabs、activeGroupId 一致。
6. 修改 tree 前先读取原始父子关系，再插入 replacement node。
7. 关闭 leaf 后要压缩空 split，避免 layout tree 留下悬空结构。

## Vue renderer 规则

1. 编辑器组件通过 `rendererKey` 注册。
2. 非 Vue 内容通过 `EditorMountAdapter` 注册。
3. 不在 Vue 层直接修改 core state。
4. UI 操作统一 dispatch action。
5. 强指针编辑器应放在 editor surface 内，不让 `main-ui` 知道具体渲染库。
6. provider 卸载时必须清理 runtime 订阅。
7. editor host 只读取 renderer registry，不导入业务 editor。
8. 真实业务设置页等大尺寸 overlay 应通过 `presentation.modalWidth` / `presentation.modalHeight` 声明建议尺寸，不在 renderer CSS 中硬编码全局弹窗宽度。
9. shell 字号由 `main-ui` 默认样式固定，宿主业务字号应限制在 editor renderer 内，避免污染 workbench chrome。

### Command 与快捷键

命令统一通过 `runtime.core.executeCommand(id, payload)` 执行。`when` 可以继续使用旧的函数形式，也可以使用简单的 context-key 表达式；快捷键通过 `registerKeybinding` 注册，权重更高的宿主绑定会优先解析。Vue provider 会安装全局 keydown 监听，并依据最近的 `data-main-ui-scope` 或输入控件自动设置 focus scope。

菜单通过 `registerMenu` 贡献，命令面板、Quick Open 和 context menu 都复用同一 command registry。菜单贡献是 opt-in 的；没有菜单注册时 shell 不显示空菜单栏。

### Settings

设置 schema 与业务状态隔离，持久化通过 `settingsPersistence` 单独注入。迁移函数接收独立 `SettingsSnapshot`，设置控件不得把业务实体写入 `WorkbenchDocument`；宿主可注册自己的 `SettingsEditor` 或 provider。

### Contributions

View/panel descriptor 只声明 `rendererKey`/`providerKey`，不把 Vue 或业务服务引入 core。`ContributionSurface` 会优先解析 Vue renderer，缺失时渲染明确空态。宿主可在自己的 renderer 中接入文件、搜索、终端、调试等 provider。

### Persistence 与 Tab

不要直接假设 `WorkbenchDocument.version === 1`；使用导出的 `migrateWorkbenchDocument` 或 runtime persistence 流程读取。新 tab 字段均为可选兼容字段，拖拽最终通过 reducer action 更新，宿主无需直接修改 layout tree。

### Accessibility 与 resilience

所有 renderer/adapter 都应允许错误边界接管；adapter 的 cleanup 必须幂等。需要将自定义焦点区标记为 `data-main-ui-scope`，并为 provider surface 提供 label。高对比度主题只覆盖语义 token，不要求宿主重写业务 editor 样式。

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

1. `workspace-demo`：基础 smoke test。
2. `inspector-demo`：三栏信息布局。
3. `autodo-profile`：资料管理型宿主。
4. `matheshop-profile`：画布型宿主。
5. `yeegames-profile`：游戏库与多对局宿主。

fixture 只验证抽象，不迁移宿主业务。

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
4. [HOST_ADAPTER_GUIDE.md](HOST_ADAPTER_GUIDE.md)
5. [HOST_PROFILE_VALIDATION.md](HOST_PROFILE_VALIDATION.md)
6. [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md)

## 浏览器调试

阶段 K/L 使用 VS Code 内置浏览器验证：

1. 启动 demo dev server。
2. 打开 `Demo` workspace，验证 Adapter editor。
3. 打开 `Matheshop` workspace，点击 Formula canvas。
4. 打开 `Yeegames` workspace，连续创建多个 game session。
5. 打开 Settings overlay，验证 dismiss/promote 不破坏 tab 状态。
