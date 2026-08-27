# main-ui

当前版本：`0.4.0`（开发分支 `dev-v0.5`）。本版本已生成本地版本包 `main-ui-0.4.0.tgz`，适合下游通过 pnpm 显式安装和维护；当前尚未发布到 npm registry。安装包内含 `docs/` 文档目录（含模板库指南 `PRESET_VIEWS_GUIDE.md`），安装后可从 `node_modules/main-ui/docs/README.md` 进入全部用户与开发文档。

仓库自 `0.2.0` 起为 pnpm workspace monorepo：主包位于 `packages/main-ui/`（包名仍为 `main-ui`），同仓管理表单基座 `@main-ui/core`、七个官方视图模板包（`@main-ui/view-*`）、聚合包 `@main-ui/preset-views`、视口能力层 `@main-ui/viewport-2d-kit` / `@main-ui/viewport-3d-kit` 与演示工程 `demo/`。

`main-ui` 是一套 Vue3 + framework-free core 工作台内核库。它不兼容旧 `main-ui-react`，也不包含任何宿主业务逻辑。

当前版本提供：

1. 纯 TypeScript core：工作台文档、split tree、浮动窗口、leaf group、tab（溢出收纳）、editor、overlay、Slot 类型化管理、视图生命周期契约、command/keybinding、menu、settings、contribution、reducer、persistence（v1→v2→v3 迁移）。
2. Vue3 官方渲染层：`MainUiProvider`、`WorkbenchShell`、MenuBar、Command Palette、Quick Open、Sidebar、Bottom Panel、FloatingWindowLayer、停靠引导指示器与 Ghost 预览、focus/error boundary。
3. 原生宿主编辑器组件：`ToolbarEditor` 与 `TreeEditor`。
4. 官方视图模板库：一期四模板（tree/inspector/2d/table）+ 二期三模板（form/node/console）+ 聚合包，详见 [docs/PRESET_VIEWS_GUIDE.md](docs/PRESET_VIEWS_GUIDE.md)。
5. 主题：light / dark / system 基础兜底 + `--mui-*` 变量 + `data-mui-theme` / `data-mui-density` 切换。
6. 中性 demo：五个 workspace（Demo、Inspector、Autodo、Matheshop、Yeegames）+ 七个官方模板的模拟后端适配层示范。

## 安装与文档

```bash
# 下游宿主（本地版本包）
pnpm add ../main-ui/main-ui-0.4.0.tgz
# 模板（按需或全量）
pnpm add @main-ui/view-tree @main-ui/view-table        # 示例：按需
pnpm add @main-ui/preset-views                          # 或聚合包
```

安装后文档位置：

| 内容 | 位置 |
| --- | --- |
| 文档总入口 | `node_modules/main-ui/docs/README.md` |
| 用户手册 / API 手册 / 开发者指南 | `node_modules/main-ui/docs/` |
| 视图模板库统一指南 | `node_modules/main-ui/docs/PRESET_VIEWS_GUIDE.md` |
| 各模板 API | `node_modules/@main-ui/view-*/README.md` |

旧版 `0.0.2` 的原始包未携带 docs；如需保持旧编译内容并补齐旧版手册，可使用仓库中的 `main-ui-0.0.2-with-docs.tgz`，详情见 [docs/RELEASE_ARCHIVE.md](docs/RELEASE_ARCHIVE.md)。

## 开发

```bash
pnpm install
pnpm typecheck      # 12 包
pnpm test           # 106 项
pnpm build
pnpm demo:build
pnpm run demo:dev   # http://127.0.0.1:4183/
pnpm test:e2e       # Playwright
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

1. `workspace-demo`（Demo）：基础工作台 smoke test。
2. `inspector-demo`（Inspector）：三栏 Inspector 布局。
3. `autodo-profile`（Autodo）：资料管理型宿主 fixture。
4. `matheshop-profile`（Matheshop）：强指针画布型宿主 fixture。
5. `yeegames-profile`（Yeegames）：游戏广场与多对局宿主 fixture。

七个官方模板编辑器经模拟后端适配层接入全部 host profile。适配草案见 [docs/HOST_ADAPTER_GUIDE.md](docs/HOST_ADAPTER_GUIDE.md)，验证记录见 [docs/HOST_PROFILE_VALIDATION.md](docs/HOST_PROFILE_VALIDATION.md)。

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

如果宿主只缺“顶部工具栏窗口”或“左/右树状窗口”，优先复用 `ToolbarEditor` 与 `TreeEditor`。

## 验证

当前主路径验证：

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm demo:build
pnpm test:e2e
```

浏览器验证路径：

1. 打开 demo，切换 `Matheshop`，点击 Formula canvas，确认 pointer 状态变化。
2. 切换 `Yeegames`，连续打开多个 game session。
3. 在 `Demo` workspace 中打开 `Adapter`，确认 external mount adapter 渲染和 pointer 状态变化。
4. 拖拽 tab 验证五向停靠引导；拖出浮动窗口验证拖动/缩放/拖回。
5. 打开七个官方模板编辑器，验证三态、意图回流与视图状态保存恢复。
