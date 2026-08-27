# main-ui 0.3.0 migration guide

`0.3.0` 是「docking 深化 + 官方视图模板一期」版本：新增浮动窗口（Window 层）与一期四个官方视图模板包。公开 API 只增不改，持久化文档版本升为 3（附自动迁移）。宿主升级近零破坏。

## 新增能力（无需迁移，按需消费）

1. **浮动窗口（docking Window 层）**：允许浮动的 editor（`capability.allowFloatingWindow: true`）可经页面「拖出入口」移出为浮动窗口，拖回/关闭即回主布局。新增 `floatingWindow/popout` / `dockBack` / `updateGeometry` / `close` 四个 action 与 `clampFloatingGeometry` 纯函数助手（越界坐标归位，多显示器场景）。
2. **官方视图模板包**：`@main-ui/view-tree`、`@main-ui/view-inspector`、`@main-ui/view-2d`、`@main-ui/view-table` + 聚合包 `@main-ui/preset-views`。安装与接入见 `HOST_INTEGRATION_GUIDE.md` §9。
3. **视图状态完整串联**：布局保存时收集各活跃表面（含浮动窗口内）实现的 `MainUiViewLifecycle.getViewState()`，恢复时调用 `restoreViewState`；v0.2 预埋的契约在官方模板上全量落地。

## 持久化变更

- `WorkbenchDocument.version` 升为 `3`：`WorkspaceState` 新增 `floatingWindows: Record<FloatingWindowId, FloatingWindowState>`。
- 读取旧快照（v1/v2）自动迁移：补齐 `floatingWindows: {}`，其余结构不变；迁移函数与测试在 `packages/main-ui/src/core/persistence/migrations.ts`。
- 宿主若自实现持久化层，仅需接受 `version: 3` 的新字段；序列化兼容性无破坏（新字段为空对象时可省略）。

## 新增可选契约（opt-in）

- `EditorCapabilityPolicy.allowFloatingWindow` / `allowPopoutWindow`：标记查询经 Slot 能力方法统一走；默认 `false`，不开启则无任何行为变化。
- 模板包 `registerXxxEditor(runtime, options, resolveProps?, extraProps?)`：一键注册 descriptor + renderer；`resolveProps` 注入数据（含三态），`extraProps` 消费意图（Emits）。
- `FloatingWindowLayer`（Vue 渲染层自动挂载）：浏览器环境为窗内浮动层；Electron 真实顶层窗口升级路径见 `HOST_ADAPTER_GUIDE.md` §7。

## 必须检查

- 升级本地包后运行 `pnpm typecheck`、宿主测试与 demo smoke test。
- 若宿主自实现持久化层并对 `WorkbenchDocument` 做严格 schema 校验，需接受 `version: 3` 与 `floatingWindows` 字段。
- 若宿主使用 `@main-ui/view-2d`，需同时安装 `@main-ui/viewport-2d-kit` 与 `pixi.js ^8`（peer 依赖）。
- 模板 kind（`view-tree` 等）需并入对应 `WorkspaceDescriptor.allowedEditorKinds` 才会在该工作区可见。

## 迁移成本

近零破坏：公开 API、`rendererKey` 契约只增不改；持久化自动迁移；不消费浮动窗口与模板包的宿主行为完全不变。
