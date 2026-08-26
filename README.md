# main-ui

当前版本：`0.1.1`。本版本已生成本地版本包 `main-ui-0.1.1.tgz`，适合下游通过 pnpm 显式安装和维护；当前尚未发布到 npm registry。安装包内含 `docs/` 文档目录，可直接查看用户手册、API 手册和迁移指南。

`main-ui` 是一套全新的 Vue3 + framework-free core 工作台内核库。它不兼容旧 `main-ui-react`，也不包含任何宿主业务逻辑。

当前版本提供：

1. 纯 TypeScript core：工作台文档、split tree、leaf group、tab、editor、overlay、command/keybinding、menu、settings、contribution、reducer、persistence。
2. Vue3 官方渲染层：`MainUiProvider`、`WorkbenchShell`、MenuBar、Command Palette、Quick Open、Sidebar、Bottom Panel、focus/error boundary。
3. 原生宿主编辑器组件：`ToolbarEditor` 与 `TreeEditor`，用于宿主快速搭建横向滚动工具栏窗口和树状窗口。
4. 中性 demo：覆盖通用工作台、Inspector 布局、`autodo-app`、`matheshop`、`yeegames` 三组 host profile fixture，并提供 `viewport-2d-kit` 编辑器底座示例。
5. 主题令牌：light / dark / system 基础状态与 CSS variables。

## 当前阶段

已完成阶段 A/B/C/D/E/F/G/I/J/K/L 及 0.1.0 兼容升级任务：

1. A：旧 React 壳层清点与删除边界确认。
2. B：Vue3 + core 项目骨架重建。
3. C/D/E：core 类型、reducer、registry、runtime、persistence。
4. F/G/I：Vue provider、split renderer、leaf group、overlay、主题样式。
5. J：中性 demo 与 host profile fixture。
6. K：三类宿主适配草案、外部 mount adapter 示例与验证记录。
7. L：README 与 docs 四件套同步到新版口径。
8. 0.1.0：command/keybinding、菜单/面板/设置 schema、布局迁移/tab 体验、可访问性与韧性边界。
9. 0.1.1：修复 MenuBar 扁平命令项点击不执行的问题（无 `submenu`、直接挂 `commandId` 的 menubar 项现在点击即执行命令）。

## 安装与开发

安装后文档位置：`node_modules/main-ui/docs/`。本地 `.tgz` 安装包也包含同一目录。

旧版 `0.0.2` 的原始包未携带 docs；如需保持旧编译内容并补齐旧版手册，可使用仓库中的 `main-ui-0.0.2-with-docs.tgz`，详情见 [docs/RELEASE_ARCHIVE.md](docs/RELEASE_ARCHIVE.md)。

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm demo:build
pnpm run demo:dev
```

如果本地 pnpm 对带冒号脚本解析异常，可直接运行：

```bash
./node_modules/.bin/vite --config demo/vite.config.ts --host 127.0.0.1
```

## 导出入口

```ts
import { createMainUiCoreRuntime } from 'main-ui/core'
import { createMainUiRuntime, MainUiProvider, WorkbenchShell, ToolbarEditor, TreeEditor } from 'main-ui/vue'
import { mainUiLightTokens } from 'main-ui/tokens'
```

包导出：

1. `main-ui`：一站式入口。
2. `main-ui/core`：core 类型、reducer、registry、runtime、persistence。
3. `main-ui/vue`：Vue runtime、provider、components、composables。
4. `main-ui/adapters`：外部内容挂载适配器契约。
5. `main-ui/tokens`：主题 token。
6. `main-ui/styles.css`：默认工作台样式。

## Host Profile

Demo 内置五个 workspace：

1. `workspace-demo`：基础工作台 smoke test。
2. `inspector-demo`：三栏 Inspector 布局。
3. `autodo-profile`：资料管理型宿主 fixture。
4. `matheshop-profile`：强指针画布型宿主 fixture。
5. `yeegames-profile`：游戏广场与多对局宿主 fixture。

适配草案见 [docs/HOST_ADAPTER_GUIDE.md](docs/HOST_ADAPTER_GUIDE.md)。验证记录见 [docs/HOST_PROFILE_VALIDATION.md](docs/HOST_PROFILE_VALIDATION.md)。

## 最小接入

```ts
import { createLocalStoragePersistenceAdapter, createSingleGroupLayout, defaultEditorCapability, defaultTabPresentation } from 'main-ui/core'
import { createMainUiRuntime } from 'main-ui/vue'

const runtime = createMainUiRuntime({
  persistence: createLocalStoragePersistenceAdapter('example-workbench'),
})

runtime.core.registerEditor({
  kind: 'welcome',
  title: 'Welcome',
  rendererKey: 'welcome-editor',
  capability: defaultEditorCapability,
  presentation: defaultTabPresentation,
  availability: { allowedWorkspaceIds: ['workspace-demo'] },
})

runtime.core.registerWorkspace({
  id: 'workspace-demo',
  title: 'Demo',
  allowedEditorKinds: ['welcome'],
  recommendedEditorKinds: ['welcome'],
  defaultOpenRequests: [{ editorKind: 'welcome' }],
  createDefaultLayout: () => createSingleGroupLayout(),
  allowUserReset: true,
})
```

Vue 入口：

```vue
<script setup lang="ts">
import { MainUiProvider, WorkbenchShell } from 'main-ui/vue'
import 'main-ui/styles.css'
</script>

<template>
  <MainUiProvider :runtime="runtime">
    <WorkbenchShell />
  </MainUiProvider>
</template>
```

## 边界

`main-ui` 不内置文献、数学引擎、游戏规则、数据库桥接或 React 兼容层。Demo 可以组合 `viewport-2d-kit` 验证 2D editor foundation，但 `main-ui/core` 不把任何 Canvas/viewport 库作为必需依赖。宿主应用只注册 workspace、editor、renderer、command/menu/keybinding/contribution、persistence 与业务 payload；所有新能力均为 opt-in。

如果宿主只缺“顶部工具栏窗口”或“左/右树状窗口”，优先复用 `ToolbarEditor` 与 `TreeEditor`。其中 `ToolbarEditor` 默认渲染为横向滚动工具栏条带，宿主再在 wrapper 中补动作跳转和业务详情逻辑。

## 验证

当前主路径验证：

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm demo:build
```

VS Code 内置浏览器验证路径：

1. 打开 demo。
2. 切换 `Matheshop`，点击 Formula canvas，确认 pointer 状态变化。
3. 切换 `Yeegames`，连续打开多个 game session。
4. 在 `Demo` workspace 中打开 `Adapter`，确认 external mount adapter 渲染和 pointer 状态变化。
