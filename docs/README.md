# main-ui 文档入口

> 本文档对应 `main-ui 0.4.0`。安装 `main-ui` 后，可在包目录的 `docs/`（`node_modules/main-ui/docs/`）中直接查看全部文档；官方视图模板包（`@main-ui/view-*`）的文档随各包 README 分发。

## 我是谁，该读哪份文档

| 角色 | 推荐阅读路径 |
| --- | --- |
| 终端用户（试用 demo） | [USER_MANUAL.md](USER_MANUAL.md) |
| 宿主项目开发者（接入/升级） | [HOST_INTEGRATION_GUIDE.md](HOST_INTEGRATION_GUIDE.md) → [API_MANUAL.md](API_MANUAL.md) → [MIGRATION_GUIDE_0.4.0.md](MIGRATION_GUIDE_0.4.0.md) |
| 使用官方视图模板的开发者 | [PRESET_VIEWS_GUIDE.md](PRESET_VIEWS_GUIDE.md)（模板库统一指南）+ 各 `@main-ui/view-*` 包 README |
| main-ui 内核贡献者 | [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) → [API_MANUAL.md](API_MANUAL.md) |
| 需要对接后端的宿主 | [HOST_INTEGRATION_GUIDE.md](HOST_INTEGRATION_GUIDE.md) 附录 A「对接后端」 |
| 外部渲染/适配实现者 | [HOST_ADAPTER_GUIDE.md](HOST_ADAPTER_GUIDE.md) |

## 文档清单

### 核心文档

- [USER_MANUAL.md](USER_MANUAL.md)：用户手册。demo 启动、界面区域、基本操作、浮动窗口与停靠引导拖拽、官方模板演示。
- [API_MANUAL.md](API_MANUAL.md)：API 手册。Core 类型、Registry、Action、Vue API、Mount Adapter、Persistence、纯 UI 边界与数据契约、主题变量。
- [PRESET_VIEWS_GUIDE.md](PRESET_VIEWS_GUIDE.md)：官方视图模板库统一指南。七个模板包 + 聚合包的安装矩阵、接入契约、每模板 Props/Emits/视图状态全量 API。
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)：开发者指南。架构边界、目录地图、开发约定（reducer / renderer / 主题变量）、命令与测试。
- [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md)：完整开发记录（0.0.2 → 0.4.0 全部版本）。

### 宿主文档

- [HOST_INTEGRATION_GUIDE.md](HOST_INTEGRATION_GUIDE.md)：宿主接入指南（接入顺序、四类注册、模板接入、附录 A 对接后端）。
- [HOST_ADAPTER_GUIDE.md](HOST_ADAPTER_GUIDE.md)：外部 renderer/adapter 契约与首批宿主适配草案、浮动窗口能力边界。
- [HOST_PROFILE_VALIDATION.md](HOST_PROFILE_VALIDATION.md)：宿主 profile 验证口径。
- [HOST_FEEDBACK_TEMPLATE.md](HOST_FEEDBACK_TEMPLATE.md)：宿主反馈信模板。
- [HOST_UPGRADE_CHECKLIST_TEMPLATE.md](HOST_UPGRADE_CHECKLIST_TEMPLATE.md)：下游升级检查清单模板。
- [HOST_EXAMPLE_0.1.0.md](HOST_EXAMPLE_0.1.0.md)：0.1.0 时代宿主示例（历史参考）。

### 升级文档

- [MIGRATION_GUIDE_0.1.0.md](MIGRATION_GUIDE_0.1.0.md)：从旧版本升级到 0.1.0。
- [MIGRATION_GUIDE_0.1.1.md](MIGRATION_GUIDE_0.1.1.md)：0.1.0 → 0.1.1（MenuBar 扁平命令项修复，无 breaking change）。
- [MIGRATION_GUIDE_0.2.0.md](MIGRATION_GUIDE_0.2.0.md)：0.1.1 → 0.2.0（monorepo 结构变更、Slot/占位/溢出收纳，API 只增不改）。
- [MIGRATION_GUIDE_0.3.0.md](MIGRATION_GUIDE_0.3.0.md)：0.2.0 → 0.3.0（浮动窗口、一期四模板、持久化 v3）。
- [MIGRATION_GUIDE_0.4.0.md](MIGRATION_GUIDE_0.4.0.md)：0.3.0 → 0.4.0（停靠引导、二期三模板、`@main-ui/core`、密度变量）。

### 归档

- [RELEASE_ARCHIVE.md](RELEASE_ARCHIVE.md)：旧版本文档与发布包归档说明（0.0.2 原始包未带 docs 的补救方案）。

## 包内文档地图

| 安装来源 | 文档位置 |
| --- | --- |
| `main-ui` | `node_modules/main-ui/docs/`（本目录）+ 包根 README |
| `@main-ui/view-*`（七个模板） | `node_modules/@main-ui/view-*/README.md` |
| `@main-ui/preset-views`（聚合包） | `node_modules/@main-ui/preset-views/README.md` |
| `@main-ui/core`（表单基座） | `node_modules/@main-ui/core/README.md` |
| `@main-ui/viewport-2d-kit` | `node_modules/@main-ui/viewport-2d-kit/README.md`（另含 `docs/` 子目录） |
