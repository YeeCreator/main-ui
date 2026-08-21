# delivered dependency letter: scene-studio -> main-ui

## Delivery Metadata

- relation: `dependency`
- source_project: `scene-studio`
- target_project: `main-ui`
- source_path: `/Users/ethan/CoreFiles/ProjectsFile/scene-studio/docs/mailbox/relay/out-up/main-ui.md`
- delivered_at: `2026-08-15T04:38:51+00:00`
- content_hash: `220d26a2d18dee415216526c58a17306ff03331e32a41589f6924929b1f1e2ba`

## Letter Content

# dependency feedback (out-up): scene-studio -> main-ui

## Context

`scene-studio` depends on `main-ui/vue` for `MainUiProvider` and `WorkbenchShell`.

## Request Or Feedback

Studio v1.0.0-alpha.0 已在当前 main-ui 本地版本上完成类型检查和生产构建，并继续使用其工作台布局、分栏调整、最大化与重置布局能力。当前没有 API 缺陷需要修复；本信用于登记 Studio 已成为该布局契约的消费者。

## Suggested Coordination

- Proposed change: 保持 `main-ui/vue` 的公开入口及 Workbench layout action 兼容；如有重构请提前提供迁移说明。
- Compatibility concern: Studio 使用 `MainUiProvider` + `WorkbenchShell` 作为编辑器宿主，布局交互不应要求远程服务。
- Migration expectation: 保持 npm `exports` 中 `./vue` 可解析，避免破坏 file: 本地依赖安装。
- Validation needed: `pnpm --dir ../scene-studio typecheck && pnpm --dir ../scene-studio build`。

