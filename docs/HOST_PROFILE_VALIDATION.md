# HOST_PROFILE_VALIDATION

## 验证版本

本文件当前验证基线为 `main-ui 0.1.0`，应优先使用 `main-ui-0.1.0.tgz` 或已构建的同版本 `dist` 进行验证。

验证日期：2026-04-30

## 1. 验证范围

本记录覆盖阶段 K 的 host profile 验证：

1. `autodo-profile`：资料管理型宿主。
2. `matheshop-profile`：强指针画布型宿主。
3. `yeegames-profile`：游戏广场与多对局宿主。
4. `viewport-foundation`：基于 `viewport-2d-kit/vue` 的 2D editor foundation smoke test。
5. `external-mount-demo`：外部内容 mount adapter smoke test。

## 2. Fixture 来源

fixture 定义在：

- `demo/src/runtime/hostProfiles.ts`

运行时注册在：

- `demo/src/runtime/createDemoRuntime.ts`

这些 fixture 只包含中性 descriptor、layout 和 payload，不包含宿主业务代码。

## 3. 自动验证

已增加单元测试：

- `tests/core/hostProfiles.test.ts`

覆盖内容：

1. workspace 引用的 editor kind 都已注册。
2. default open request 指向的 target group 均存在。
3. `yeegames-profile` 支持 `game-session` 多实例。
4. `matheshop-profile` 包含 `viewport-2d-kit` 画布型 editor surface。
5. `external-mount-demo` 的 rendererKey 是 framework-neutral adapter。
6. validation cases 覆盖三类首批宿主。

## 4. 浏览器验证步骤

启动 demo：

```bash
pnpm run demo:dev
```

若本地 pnpm 对带冒号脚本解析异常，使用：

```bash
/absolute/path/to/main-ui/node_modules/.bin/vite --config /absolute/path/to/main-ui/demo/vite.config.ts --host 127.0.0.1
```

手动路径：

1. 打开 `http://127.0.0.1:4173/`。
2. 点击 `Autodo`，确认三栏资料布局显示。
3. 点击 `Matheshop`，确认工具面板、Formula canvas、Inspector 显示。
4. 在 Formula canvas 内拖拽平移、使用 Ctrl/⌘+滚轮缩放，并点击 `Fit` 恢复视口。
5. 点击 `Yeegames`，确认游戏广场和 Board viewport 同时显示。
6. 点击 `Open chess` 与 `Open go`，确认可打开多个 `game-session` tab。
7. 回到 `Demo`，用 launcher 打开 `Adapter`，确认 external mount adapter 内容显示。
8. 点击 adapter 内容，确认 pointer 状态变化。
9. 打开 `Settings`，确认 overlay 可显示和关闭。

## 5. 当前验证结论

当前实现满足阶段 K 的核心要求：

1. `autodo-app` 可被解释为多 workspace 资料管理宿主。
2. `matheshop` 可被解释为由 `viewport-2d-kit` 承载的画布型宿主。
3. `yeegames` 可被解释为游戏库、对局实例与棋盘视口宿主。
4. 三者都不要求 `main-ui` 内置业务逻辑。
5. `viewport-2d-kit` 作为 demo 级 editor foundation 被组合进 renderer，没有向 `main-ui/core` 引入业务或 React 依赖。
6. 外部内容过渡路径通过通用 mount adapter 表达，没有向 `main-ui` 引入 React 依赖。

## 6. 非目标项

以下内容不在阶段 K 中实现：

1. 改造真实 `autodo-app` 业务代码。
2. 改造真实 `matheshop` React shell。
3. 改造真实 `yeegames` 游戏 screen。
4. 提供 React 兼容包。
