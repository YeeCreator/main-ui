# main-ui 0.1.1 migration guide

`0.1.1` 是针对 `0.1.0` 的一次 patch 修复，无 breaking change。

## 修复内容

- **`MenuBar` 扁平命令项点击不执行**：此前 `menubar` 顶层菜单项若只挂 `commandId`（未配置 `submenu`），点击后仅切换展开状态、不触发命令。现在这类扁平项会直接执行对应命令；配置 `submenu` 的项行为不变（仍展开为下拉子菜单）。

## 必须检查

- 将本地包升级为 `main-ui-0.1.1.tgz`，运行 `pnpm typecheck`、宿主测试与 demo smoke test。
- 若宿主曾依赖「扁平 menubar 项点击无效」这一旧行为，请确认改为「点击即执行」后符合预期（通常这是期望的修复，无需迁移）。

## 迁移成本

零迁移成本：仅菜单点击行为增强，公开 API、`WorkbenchDocument` schema、渲染入口均未变化。
