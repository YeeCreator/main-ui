# main-ui 0.4.0 migration guide

`0.4.0` 是「停靠引导拖拽 + 官方视图模板二期」版本：新增五向停靠引导指示器与 Ghost 预览、二期三个官方视图模板包（form/node/console）与表单基座包 `@main-ui/core`、主题密度变量。公开 API 只增不改，持久化文档版本不变（仍为 3）。宿主升级近零破坏。

## 新增能力（无需迁移，按需消费）

1. **停靠引导指示器 + Ghost 预览**：tab 拖拽至目标组时呈现五向落点指示器（center/left/right/top/bottom）与 Ghost 预览；落点确认后经 `moveTabToNewSplit` 落 action（支持浮动窗口子树），取消拖拽布局树零残留。红线约束：指示器仅做视觉提示，不修改布局树中间态。
2. **二期官方视图模板包**：
   - `@main-ui/view-form`：schema 驱动表单，提交/预设存取以意图抛出；
   - `@main-ui/view-node`：`@vue-flow/core`（peer `^1.48`）薄封装节点图，视口与选中进视图状态；
   - `@main-ui/view-console`：自研虚拟滚动追加列表（等级/文本过滤、自动跟随/锁滚、清空意图）。
3. **表单基座包**：`@main-ui/core` 提供 `FormFieldSchema` / `FormValues` 与校验纯函数，供 `view-form` 与 `view-inspector` 共用；宿主自定义表单亦可单独消费。
4. **主题密度变量**：`--mui-row-height` / `--mui-row-height-dense` / `--mui-density-gap` / `--mui-control-height` / `--mui-toolbar-height` / `--mui-font-mono`；根元素（或任意祖先）设置 `data-mui-density="compact"` 即切换紧凑模式，不设置则行为与 0.3.0 完全一致。

## 持久化变更

无。`WorkbenchDocument.version` 仍为 `3`，无迁移函数变更。

## 新增可选契约（opt-in）

- 模板包注册沿用一期模式：`registerFormEditor` / `registerNodeEditor` / `registerConsoleEditor`（`resolveProps` 注入数据与三态，`extraProps` 消费意图）；聚合包 `@main-ui/preset-views` 已扩入 `form` / `node` / `consoleView` 命名空间。
- `view-node` 的 CSS 为 vendored `view-flow.css`，经运行时 `<link>` 幂等注入（带 `document` 守卫）；SSR/非浏览器环境自动跳过，无需宿主处理。

## 必须检查

- 升级本地包后运行 `pnpm typecheck`、宿主测试与 demo smoke test。
- 模板 kind（`view-form` / `view-node` / `view-console`）需并入对应 `WorkspaceDescriptor.allowedEditorKinds` 才会在该工作区可见。
- 使用 `@main-ui/view-node` 的宿主需同时安装 `@vue-flow/core ^1.48`（peer 依赖）。
- 模板包 `main-ui` peer 已统一为 `^0.4.0`；`pnpm install` 时请确保主包同步升级。

## 顺延项说明

- **`view-asset`（资产网格模板）顺延至 v0.5**：截至本版本，下游信箱（mailbox/relay）未收到宿主对缩略图契约的回执；为避免在契约未确认前固化设计，本版本不交付。任务文件 `tasks/v04-drag-guide-preset-views-2.md` 已同步状态。

## 迁移成本

近零破坏：公开 API、`rendererKey` 契约只增不改；无持久化变更；不消费停靠引导与二期模板的宿主行为完全不变。
