# main-ui 0.1.0 migration guide

`0.1.0` 是兼容式能力扩展。旧的 workspace/editor/renderer、`registerCommand`、mount adapter 和 v1 persistence 数据无需大规模改造。

## 必须检查

- 将本地包升级为 `main-ui-0.1.0.tgz`，运行 `pnpm typecheck`、宿主测试和 demo smoke test。
- 若宿主读取 `WorkbenchDocument`，不要硬编码 `version === 1`；使用 runtime persistence 或 `migrateWorkbenchDocument`。
- 检查 CSS token 覆盖、全局快捷键冲突和 adapter cleanup。

## 可选启用

- `registerKeybinding`、`registerMenu`、`registerSettingSchema`、`registerViewContribution` / `registerPanelContribution`。
- `CommandPalette`、`QuickOpen`、`SettingsEditor`、`Sidebar`、`BottomPanel` 和 `FeedbackHost`。

## Breaking change

本次没有强制 breaking change。`WorkbenchDocument` 持久化 schema 从 v1 迁移为 v2，但迁移由库自动完成；新字段均有默认值。只有直接依赖内部 CSS class、手工序列化并拒绝未知字段的宿主需要调整。
