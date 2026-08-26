# support advice (updates-outbox): main-ui -> matheshop

## Context

`main-ui` supports `matheshop` because `matheshop` depends on `main-ui`.

## Adaptation Advice

`main-ui 0.1.1` 已发布（本地版本包 `main-ui-0.1.1.tgz`），为一次 patch 修复，无 breaking change。

本次修复：`MenuBar` 顶层扁平命令项（未配置 `submenu`、直接挂 `commandId`）此前点击仅切换展开状态、不执行命令；现已改为点击即执行对应命令。配置 `submenu` 的下拉菜单项行为不变。

## Suggested Steps

- Required change: 将本地 `file:../main-ui` 依赖替换为 `main-ui-0.1.1.tgz` 后运行 `pnpm install`（或保持 `file:../main-ui` 源码级联调）。
- Compatibility note: 公开 API、`WorkbenchDocument` schema、渲染入口均未变化；仅菜单点击行为增强。
- Validation command: `pnpm build:deps && pnpm build`（或宿主的常规验证命令）。
- Deadline or release note: 升级为自愿、显式操作；遇到问题请通过 relay mailbox 反馈。
