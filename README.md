# main-ui

`main-ui` 是一套全新的 Vue3 + framework-free core 工作台内核库。它不兼容旧 `main-ui-react`，也不包含任何宿主业务逻辑。

当前版本提供：

1. 纯 TypeScript core：工作台文档、split tree、leaf group、tab、editor、overlay、registry、reducer、persistence。
2. Vue3 官方渲染层：`MainUiProvider`、`WorkbenchShell`、activity bar、title bar、split renderer、leaf tab group、overlay layer。
3. 中性 demo：覆盖通用工作台、Inspector 布局、`autodo-app`、`matheshop`、`yeegames` 三组 host profile fixture，并提供 `viewport-2d-kit` 编辑器底座示例。
4. 主题令牌：light / dark / system 基础状态与 CSS variables。

## 当前阶段

已完成阶段 A/B/C/D/E/F/G/I/J/K/L 的首轮实现：

1. A：旧 React 壳层清点与删除边界确认。
2. B：Vue3 + core 项目骨架重建。
3. C/D/E：core 类型、reducer、registry、runtime、persistence。
4. F/G/I：Vue provider、split renderer、leaf group、overlay、主题样式。
5. J：中性 demo 与 host profile fixture。
6. K：三类宿主适配草案、外部 mount adapter 示例与验证记录。
7. L：README 与 docs 四件套同步到新版口径。

## 安装与开发

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
import { createMainUiRuntime, MainUiProvider, WorkbenchShell } from 'main-ui/vue'
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

`main-ui` 不内置文献、数学引擎、游戏规则、数据库桥接或 React 兼容层。Demo 可以组合 `viewport-2d-kit` 验证 2D editor foundation，但 `main-ui/core` 不把任何 Canvas/viewport 库作为必需依赖。宿主应用只注册 workspace、editor、renderer、command、persistence 与业务 payload。

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
