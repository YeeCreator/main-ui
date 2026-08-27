# main-ui

当前版本：`0.4.0`。Vue3 + framework-free core 工作台内核库：多 workspace、递归分屏布局、浮动窗口、tab 全生命周期（溢出收纳/拖拽/停靠引导）、overlay、Slot 类型化管理、视图生命周期契约、command/快捷键/菜单/命令面板、schema 设置、contribution、持久化（v1→v2→v3 自动迁移）、light/dark/system 主题（`--mui-*` 变量）。纯 UI 层：零网络请求、不持业务状态、不绑定任何后端。

## 文档（随包提供）

安装后从 **`docs/README.md`** 进入（即本包目录下的 `docs/`）：

| 文档 | 内容 |
| --- | --- |
| `docs/README.md` | 文档总入口与角色导读 |
| `docs/USER_MANUAL.md` | 用户手册（界面区域、操作、浮动窗口、停靠引导） |
| `docs/API_MANUAL.md` | API 手册（Core 类型、Registry、Action、Vue API、Mount Adapter、数据契约） |
| `docs/PRESET_VIEWS_GUIDE.md` | 官方视图模板库统一指南（七模板安装矩阵 + 全量 Props/Emits/视图状态 API） |
| `docs/DEVELOPER_GUIDE.md` | 开发者指南（架构边界、目录地图、开发约定） |
| `docs/HOST_INTEGRATION_GUIDE.md` | 宿主接入指南（接入顺序、模板接入、附录 A 对接后端） |
| `docs/HOST_ADAPTER_GUIDE.md` | 外部 renderer/adapter 契约 |
| `docs/DEVELOPMENT_LOG.md` | 完整开发记录（0.0.2 → 0.4.0） |
| `docs/MIGRATION_GUIDE_*.md` | 各版本迁移指南 |

官方视图模板包（`@main-ui/view-*`）的文档随各包 README 分发（`node_modules/@main-ui/view-*/README.md`）。

## 快速开始

```ts
import { createLocalStoragePersistenceAdapter, createSingleGroupLayout, defaultEditorCapability, defaultTabPresentation } from 'main-ui/core'
import { createMainUiRuntime, MainUiProvider, WorkbenchShell } from 'main-ui/vue'
import 'main-ui/styles.css'

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
  defaultOpenRequests: [{ editorKind: 'welcome' }],
  createDefaultLayout: () => createSingleGroupLayout(),
  allowUserReset: true,
})
```

```vue
<template>
  <MainUiProvider :runtime="runtime">
    <WorkbenchShell />
  </MainUiProvider>
</template>
```

## 导出入口

1. `main-ui`：一站式入口。
2. `main-ui/core`：core 类型、reducer、registry、runtime、persistence。
3. `main-ui/vue`：Vue runtime、provider、components、composables。
4. `main-ui/adapters`：外部内容挂载适配器契约。
5. `main-ui/tokens`：主题 token。
6. `main-ui/styles.css`：默认工作台样式。

## 生态包

- 官方视图模板：`@main-ui/view-tree` / `view-inspector` / `view-2d` / `view-table` / `view-form` / `view-node` / `view-console`，聚合包 `@main-ui/preset-views`（指南见 `docs/PRESET_VIEWS_GUIDE.md`）。
- 表单基座：`@main-ui/core`（框架无关，宿主自定义表单亦可单独消费）。
- 视口能力层：`@main-ui/viewport-2d-kit`（PixiJS）/ `@main-ui/viewport-3d-kit`（Three.js）。

## 边界

`main-ui` 不内置业务逻辑、数据库桥接或第三方渲染运行时；宿主只注册 workspace、editor、renderer/adapter、command/menu/contribution、persistence 与轻量 payload，全部网络通信留在宿主适配层（见 `docs/HOST_INTEGRATION_GUIDE.md` 附录 A）。
