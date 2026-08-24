# delivered dependency letter: scene-studio -> main-ui

## Delivery Metadata

- relation: `dependency`
- source_project: `scene-studio`
- target_project: `main-ui`
- source_path: `/Users/ethan/CoreFiles/ProjectsFile/scene-studio/docs/mailbox/relay/feedback/outbox/main-ui/main-ui.md`
- delivered_at: `2026-08-24T15:57:11+00:00`
- content_hash: `52f0aca2181136d72c87a78c862bc72a5f858cee10d16afde8e38f50bda04b28`

## Letter Content

# dependency feedback (feedback-outbox): scene-studio -> main-ui

## Context

`scene-studio` depends on `main-ui`（`main-ui/vue` 提供 `MainUiProvider` / `WorkbenchShell`）。

## Request Or Feedback

**发现 `main-ui@0.1.0`（dev-0.0.3）的 `MenuBar` 组件缺陷：menubar 顶层按钮不执行命令。**

`MenuBar.ts` 的顶层 trigger `onClick` 只切换下拉展开状态（`openMenu.value = ...`），命令只在弹出的 `children` 子项上执行。因此 `HOST_EXAMPLE_0.1.0.md` 中展示的扁平 menubar 用法（`registerMenu({ location: 'menubar', commandId: 'xxx' })` 且无 `submenu`）**点击后完全无响应**——菜单按钮既不展开也没有任何命令执行。

场景工坊 Studio 消费此契约注册了 5 个扁平 menubar 命令项（运行/暂停/单步/重置/打开场景…），实测点击无效，只能退回命令面板（Cmd/Cmd+Shift+P）触发。

## Suggested Coordination

- Proposed change: 在 `src/vue/components/MenuBar.ts` 的 trigger `onClick` 中按是否有子菜单分派：有 `children` 时切换下拉；无 `children`（扁平命令项）时直接执行命令。示意：
  ```ts
  onClick: () => {
    if (item.children?.length) {
      openMenu.value = openMenu.value === item.id ? null : item.id;
    } else if (item.commandId) {
      void run(item);
    }
  }
  ```
- Compatibility concern: 修复为纯行为增强——有 `submenu` 的宿主用法完全不变；扁平命令项从「点击无响应」变为「点击执行命令」，符合 `HOST_EXAMPLE_0.1.0.md` / `API_MANUAL.md` 既有文档预期，不破坏任何子菜单消费方。
- Migration expectation: 下游零迁移成本；修复后 scene-studio 等扁平 menubar 消费方即可直接用命令入口。
- Validation needed: `pnpm test`（现有 19 用例）应保持通过；任一宿主打开 menubar 点击扁平命令项验证命令执行；建议为扁平 menubar 点击补一个组件级测试。

> 附：scene-studio 当前已在本地对 main-ui 源码打了临时补丁（修改 `MenuBar.ts` 并重建 dist）以保证可运行。**待上游正式修复并发布新版后，scene-studio 将回退本地补丁并升级拉取新版。**


