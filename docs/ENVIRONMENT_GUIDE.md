# ENVIRONMENT_GUIDE

> **运行环境抽象指南**（浏览器 / Electron）。面向 MUI 下游宿主，说明如何**一次接入、两壳通用**。
> 适用包：`@main-ui/core/environment`（v0.6.0 起）。

## 1. 定位

MUI 以 Vue3 + 浏览器渲染为主，同时面向后续 **Electron 独立应用**模式。两者差异**不在渲染**（同源 Chromium），而在**外壳能力**：

| 维度 | 浏览器 | Electron |
| ---- | ------ | -------- |
| 页面缩放（Ctrl/Cmd+wheel） | 须抑制 | 须抑制 |
| 原生右键菜单 | 须抑制（游戏/画布） | 交原生菜单 |
| 文本选区 / 图片拖拽 | 须抑制（拖拽场景） | 可保留（需复制） |
| 浏览器快捷键（Cmd+W 等） | 须拦截 | 不适用 |
| 窗口控制（最小化/关闭） | 无 | 有 |
| 文件读写 / 原生菜单 | 无 | 有 |

**目标**：把这些差异收敛为**单一真相源**，使下游**切换外壳时 `src/` 业务代码零改动**。

## 2. 三层结构

```
① 探测 detectEnvironment()      —— 自动判定 browser / electron
② 策略 resolveShellPolicy()      —— 手势/缩放/右键/快捷键差异的单一真相源
   +  installShellPolicy()       —— 一次性安装到 window/document
③ 桥  getNativeBridge()         —— 原生能力（窗口/文件/菜单），浏览器降级为 none
```

## 3. 接入（下游三步，一次性）

### 步骤 1：Electron 侧 preload 注入统一合约

MUI 定义**统一键名** `window.__mainUiRuntime`，下游只需在 `electron/preload` 中暴露它：

```js
// electron/preload.mjs（或 .cjs）
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('__mainUiRuntime', {
  kind: 'electron',
  platform: process.platform,
  electronVersion: process.versions.electron,
  native: {
    // 按需暴露；不暴露的能力在浏览器/Electron 下统一视为不可用
    window: {
      minimize: () => ipcRenderer.send('window:minimize'),
      maximize: () => ipcRenderer.send('window:maximize'),
      close: () => ipcRenderer.send('window:close'),
    },
    // fs: { readText, writeText },
    // menu: { set },
  },
})
```

> **注意**：`preload` 必须保持 `contextIsolation: true` / `nodeIntegration: false`（各仓既有基线）。

### 步骤 2：应用入口安装外壳策略（一行）

```ts
// src/main.ts
import { createApp } from 'vue'
import { detectEnvironment, installShellPolicy, resolveShellPolicy } from '@main-ui/core/environment'
import App from './App.vue'

// 一次性：按环境安装手势/缩放/右键/快捷键策略（返回 dispose，通常无需调用）
installShellPolicy(resolveShellPolicy(detectEnvironment()))

createApp(App).mount('#root')
```

### 步骤 2b：右键被屏蔽后，如何弹自己的菜单

浏览器策略下 `suppressContextMenu = true`，原生菜单会被拦截——这正是「Web 构建
表现得像桌面 App」的关键。宿主若要自己的右键菜单，监听自定义事件即可：

```ts
window.addEventListener('main-ui-contextmenu', (event) => {
  const { clientX, clientY, target } = (event as CustomEvent).detail
  // 在此打开你自己的上下文菜单（例如 MUI 的 ContextMenu 组件）
  showMyContextMenu({ x: clientX, y: clientY, target })
})
```

**豁免**：若某块区域需自行处理右键（例如自定义菜单容器内部再次右键），
在其元素或祖先上加标记即可放行原生行为：

```html
<div data-main-ui-contextmenu="own">…</div>
```

也可直接用导出的处理器自定义安装范围：

```ts
import { createContextMenuHandler } from '@main-ui/core/environment'
someElement.addEventListener('contextmenu', createContextMenuHandler(window))
```

> **为什么要屏蔽**：Web 构建里露出浏览器右键菜单（"查看网页源代码"、"检查"等）
> 会立刻暴露"这是个网页"，破坏 App 观感。屏蔽后由宿主接管，观感与 Electron 一致，
> 而调试体验仍是 Web 的（Playwright 直连、HMR 免重启、console 直读）——
> 这是**刻意不引入 Electron** 的原因。

### 步骤 3：按需消费原生能力

```ts
import { getNativeBridge } from '@main-ui/core/environment'

const bridge = getNativeBridge()
if (bridge.kind === 'electron') {
  bridge.window?.minimize()
}
```

**完成。** 此后切换浏览器/Electron **不需要改任何 `src/` 业务代码**。

## 4. 画布模板的自动贴合

画布类模板（`@main-ui/view-world` / `@main-ui/view-canvas`）的内置手势隔离**缺省取自 ShellPolicy**：

```
组件 prop（显式覆盖） → 缺省取 ShellPolicy.canvasGestureGuard
ShellPolicy ← resolveShellPolicy(detectEnvironment())
```

故下游**无需逐组件配置** `nativeGestureGuard`；只在下游有特殊需要时显式传 prop 覆盖。

## 5. API 速查

### 探测

| API | 说明 |
| --- | ---- |
| `detectEnvironment({ force?, scope? })` | 探测环境；`scope` 供测试注入 |
| `setEnvironmentProvider(overrides \| null)` | 注入覆盖（宿主/测试） |
| `resetEnvironmentCache()` | 清除缓存 |
| `readRuntimePayload(scope?)` | 读取 preload 合约载荷 |
| `normalizePlatform(raw)` | 归一化平台字符串 |
| `MAIN_UI_RUNTIME_KEY` | 统一键名常量（`'__mainUiRuntime'`） |

判定顺序：**preload 合约 → 覆盖 → 启发式**。

### 策略

| API | 说明 |
| --- | ---- |
| `resolveShellPolicy(env?, overrides?)` | 按环境解析策略 |
| `installShellPolicy(policy, target?)` | 安装到 window/document，返回 dispose |
| `BROWSER_SHELL_POLICY` / `ELECTRON_SHELL_POLICY` | 两套默认基线 |

### 桥

| API | 说明 |
| --- | ---- |
| `getNativeBridge(scope?)` | 读取原生桥（浏览器恒为 `{ kind: 'none' }`） |
| `hasNativeBridge(scope?)` | 是否具备原生能力 |

## 6. 默认策略对照

| 字段 | 浏览器 | Electron |
| ---- | ------ | -------- |
| `preventPageZoom` | `true` | `true` |
| `suppressContextMenu` | `true`（并派发 `main-ui-contextmenu`） | `false`（交原生菜单） |
| `suppressTextSelection` | `true` | `false` |
| `suppressImageDrag` | `true` | `true` |
| `interceptShortcuts` | `['cmd+w','ctrl+w','cmd+p','ctrl+p','ctrl+shift+i']` | `[]` |
| `canvasGestureGuard` | `true` | `true` |

## 7. 一劳永逸的边界（诚实说明）

| 能力 | 一劳永逸？ | 说明 |
| ---- | --------- | ---- |
| 环境探测 | ✅ | MUI 自动，下游零代码 |
| 手势/缩放/右键/快捷键 | ✅ | 集中于 `installShellPolicy` |
| 画布模板手势缺省 | ✅ | 模板自动取 ShellPolicy |
| 键位适配（mac/win） | ✅ | MUI `detectPlatform` |
| 窗口/文件/菜单 | ⚠️ | MUI 定**合约**，下游须在 preload **一次性实现** |
| 打包/签名/更新 | ❌ | 各仓自管 |

> **一句话**：「两壳切换 + 交互行为统一」100% 一劳永逸；「原生能力」需下游一次性接合约。
