# DOWNSTREAM_FE_GUIDE

> **MUI 下游前端开发建议规范**（**建议性，非强制**）。
> 用途：新下游引入 MUI 时，按此规范开发前端 UI，对双方都合适——下游少走弯路，MUI 契约保持单一。
> 定位说明：这是**推荐做法**，下游可偏离；偏离时请在自身 `docs/` 记录理由，便于后续对齐。

## 0. 为什么有这份规范

MUI 是「L∞ 统一 UI 框架 + 视图模板库」，下游 6 家（`画布型宿主` · `多资料管理型宿主` · `某下游宿主` · `场景编辑型宿主` · `对局宿主` · `画廊型宿主`）共用。若各仓自行其是，会反复出现：

- 每个下游各写一套「防缩放 / 防右键 / 防拖影」；
- 每个下游各自判断「是否在 Electron 里」；
- 模板能力被逐组件配置，下游重复劳动。

本规范把**已验证的做法**沉淀为建议，使下游「一次接对」。

## 1. 分层职责（建议）

```
MUI 提供：视图模板 · 交互语义 · 环境抽象 · 键位适配
下游提供：数据取数 · 业务裁决 · 原生能力实现（preload）
```

| 层 | 谁做 | 内容 |
| -- | ---- | ---- |
| 视图模板 | **MUI** | `view-world` / `view-canvas` / `view-tree` … 及交互语义 |
| 交互语义 | **MUI** | 点击/拖拽/滚轮/手势/鼠标键 的归一化 |
| 环境差异 | **MUI** | `@main-ui/core/environment`（探测 + 策略 + 桥合约） |
| 键位适配 | **MUI** | `detectPlatform` + `normalizeKeybinding` |
| 取数与三态 | 下游 | `resolveProps(context)` 转契约（含 `loading` / `error`） |
| 业务裁决 | 下游 | 消费 Emits，回写自身数据源 |
| 原生能力 | 下游 | `electron/preload` 实现 MUI 桥合约 |

## 2. 接入清单（建议逐项落实）

- [ ] **环境探测**：应用入口调用 `installShellPolicy(resolveShellPolicy(detectEnvironment()))`
- [ ] **preload 合约**（若用 Electron）：暴露 `window.__mainUiRuntime`（见 `ENVIRONMENT_GUIDE`）
- [ ] **不自行判断环境**：不写 `if (isElectron)` 分支；改问 `getNativeBridge()` / `ShellPolicy`
- [ ] **不自行实现手势屏蔽**：不写全局 `preventDefault`/`user-select`；交给 `installShellPolicy`
- [ ] **画布手势**：不逐组件传 `nativeGestureGuard`；用模板缺省（取自 ShellPolicy）
- [ ] **模板注册**：走 `registerXxxEditor`（`HOST_INTEGRATION_GUIDE` 三步）
- [ ] **取数分离**：模板不取数、不缓存；数据经 Props 进、意图经 Emits 出
- [ ] **依赖形态**：workspace 内用 `workspace:*`；跨仓用 `file:`；不锁定旧版本

## 3. 反模式（建议避免）

| 反模式 | 为什么不好 | 建议做法 |
| ------ | ---------- | -------- |
| 各仓自写 `isElectron` 探测 | 命名不一、口径漂移 | 用 `detectEnvironment()` |
| 各仓自写防缩放/防右键 | 重复劳动、行为不一致 | 用 `installShellPolicy` |
| 逐组件传手势开关 | 下游重复配置、易漏 | 用模板缺省（ShellPolicy） |
| 组件内直接取数 | 模板承担宿主职责 | `resolveProps` 注入 |
| 直接改 `node_modules` 或包源码 | 违反单一真相源 | 走上游反馈（channel） |
| 侧信道改模板 DOM | 模板升级即碎 | 用公开 prop/Emits/插槽 |

## 4. 版本与升级（建议）

| 项 | 建议 |
| -- | ---- |
| 升级前 | 读对应 `MIGRATION_GUIDE_<ver>.md` |
| 破坏性变更 | 关注 `updates/inbox/main-ui/` 通知信 |
| 验证 | `pnpm install && pnpm typecheck && pnpm build`（fresh install 才可靠） |
| 发现缺陷 | 写 `feedback/outbox/main-ui/` 反馈信（不要直接改上游） |

## 5. 最小接入样板

```ts
// src/main.ts
import { createApp } from 'vue'
import { detectEnvironment, installShellPolicy, resolveShellPolicy } from '@main-ui/core/environment'
import { createMainUiRuntime } from 'main-ui/vue'
import App from './App.vue'

// ① 环境策略（浏览器/Electron 统一）
installShellPolicy(resolveShellPolicy(detectEnvironment()))

// ② 工作台 runtime
const runtime = createMainUiRuntime()
// … registerXxxEditor(runtime, { allowedWorkspaceIds: ['my-workspace'] })

createApp(App).provide('mainUiRuntime', runtime).mount('#root')
```

```js
// electron/preload.mjs（仅 Electron 壳需要）
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('__mainUiRuntime', {
  kind: 'electron',
  platform: process.platform,
  electronVersion: process.versions.electron,
})
```

## 6. 相关文档

| 想知道 | 读 |
| ------ | -- |
| 环境抽象（探测/策略/桥） | `ENVIRONMENT_GUIDE.md` |
| 工作台接入（注册/取数/意图） | `HOST_INTEGRATION_GUIDE.md` |
| 视图模板 API | `PRESET_VIEWS_GUIDE.md` |
| 版本迁移 | `MIGRATION_GUIDE_<ver>.md` |
| 宿主适配（mount adapter） | `HOST_ADAPTER_GUIDE.md` |
