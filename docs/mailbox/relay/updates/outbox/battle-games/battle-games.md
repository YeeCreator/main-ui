# support advice (updates-outbox): main-ui -> battle-games

## Context

`main-ui` supports `battle-games` because `battle-games` depends on `main-ui`.

本信件为 **main-ui 0.6.0 世代发布通知 + 从 0.1.1 到 0.6.0 的完整升级改造计划**，随附联合改造任务组邀请。这也是贵方接入 mailbox/relay 多项目联动治理体系后收到的第一封正式信件。请通读后再行动；任何一步有疑问，通过 `feedback/outbox/main-ui/` 回信即可。

---

## 1. 发布摘要

- **发布物**：`main-ui-0.6.0.tgz`（位于 `/Users/ethan/CoreFiles/ProjectsFile/main-ui/main-ui-0.6.0.tgz`），包内携带全套文档（见 §8）。
- **版本跨度**：`battle-games` 当前依赖 `"main-ui": "file:../main-ui/main-ui-0.1.1.tgz"`，本次跨越 **0.2.0 / 0.3.0 / 0.4.0 / 0.5.0 / 0.6.0 五个世代**。
- **兼容性结论**：五个世代全部遵循「公开 API 只增不改、持久化自动迁移」原则。贵方既有接入**理论上零破坏升级**；真正的工作量在「是否消费新能力」（见 §5 改造线）。
- **主包版本号**：`main-ui` 主包从 `0.4.0` 统一升至 `0.6.0`（与模板库世代对齐），导出面与行为无任何差异。

## 2. 五个世代发生了什么（速览）

| 世代 | 主题 | 对 battle-games 的关键点 |
|---|---|---|
| 0.2.0 | 契约先行 + 工程底座 | 仓库转 monorepo（包名/导出面不变）；`viewport-2d-kit` 改名 `@main-ui/viewport-2d-kit`；主题根属性 `data-mui-theme`；快照降级占位；Tab 溢出收纳 |
| 0.3.0 | 浮动窗口 + 模板一期 | 浮动窗口（Window 层）；`view-tree / view-inspector / view-2d / view-table` 四个官方模板；持久化升至 v3（自动迁移） |
| 0.4.0 | 停靠引导 + 模板二期 | 五向停靠引导指示器 + Ghost 预览；`view-form / view-node / view-console`；`@main-ui/core` 表单基座；主题密度变量 |
| 0.5.0 | 模板库大规模建设 | **`@main-ui/view-flow`（流程/状态机文档编辑器）**；虚拟滚动基座；`EmbeddedViewHost` 嵌套保护；schema 数组字段 + 条件显隐 |
| 0.6.0 | 旗舰复合模板 | **`@main-ui/view-sandbox`（自由沙盘画布，对战推演沙盘直接对口）**、**`@main-ui/view-host-engine`（外部引擎桥接）** |

## 3. 双线改造模型（必读）

- **升级线（低风险，预计半天内）**：仅换版本号 + 安装 + 验证，既有功能行为不变。见 §4。
- **改造线（深度、自愿、分批）**：用官方模板库与停靠新能力重构自研部分。见 §5。**建议放入联合改造任务组执行（§7）。**

## 4. 升级线：详细步骤（0.1.1 → 0.6.0）

1. **改依赖**：`battle-games/package.json` 中 `"main-ui": "file:../main-ui/main-ui-0.1.1.tgz"` 二选一：
   - **方案 A（推荐，源码联调）**：`"main-ui": "file:../main-ui/packages/main-ui"`。注意：0.2.0 起主包源码已从仓库根迁入 `packages/main-ui/`，旧式指向仓库根的 `file:../main-ui` 不再可用；
   - **方案 B（版本包）**：`"main-ui": "file:../main-ui/main-ui-0.6.0.tgz"`。
2. **安装**：`pnpm install`。
3. **安装官方模板包（按需）**：贵方暂无 `pnpm-workspace.yaml`，推荐直链形式，如 `"@main-ui/view-console": "file:../main-ui/packages/view-console"`（其余模板同理）；若后续希望统一 workspace 管理，可新建 `pnpm-workspace.yaml` 并纳入 `.`、`../main-ui`、`../main-ui/packages/*`。
4. **验证**：`pnpm typecheck && pnpm test && pnpm build`，另跑一遍主流程冒烟（工作区切换、布局保存/恢复、对战画布、前后端联通）。
5. **必须检查项**：
   - **持久化**：`WorkbenchDocument.version` 现为 `3`（新增 `floatingWindows` 字段）。自实现持久化层且做严格 schema 校验时需接受该字段；旧快照自动迁移。
   - **主题变量**：新代码应消费 `--mui-*` 令牌；旧变量名仍兼容，无强制迁移。
   - **demo 端口**：main-ui demo 端口已改为 **4183**（仅影响联调脚本）。
   - **行为增强感知**：未注册视图类型渲染占位表面（不再丢弃）；Tab 超宽出现滚动/溢出菜单。均属增强。
   - **后端无关性**：main-ui 自身零网络请求（无 fetch/axios/XMLHttpRequest/WebSocket），贵方 `ws` 后端交互全部在宿主适配层，升级不受影响；前后端结合规范见包内 `HOST_INTEGRATION_GUIDE.md` §10。

## 5. 改造线：针对 battle-games 的建议（自愿、分批）

基于对 `battle-games` 技术栈的调研（pixi.js、viewport-2d-kit、ws 后端、vue）：

| 自研现状（推测） | 官方替代/增强 | 收益 |
|---|---|---|
| 对战预配置面板 | **`@main-ui/view-form`**（schema 驱动 + 数组字段 + 条件显隐） | 「按兵种/阵营动态出字段」直接可用，校验为纯函数可单测 |
| 全量事件日志 | **`@main-ui/view-console`**（等级过滤、文本过滤、自动跟随/锁滚、清空意图，虚拟滚动） | 高频对战事件流不卡，开箱即用 |
| 对战地图/棋盘画布 | `view-2d`（基于 `@main-ui/viewport-2d-kit` + pixi.js ^8，贵方已有 2d-kit 与 pixi 依赖，迁入成本极低）或 `view-host-engine` 桥接自研渲染 | 视口状态随布局保存/恢复 |
| 对战推演沙盘 | **`@main-ui/view-sandbox`**（shape / image / embed-view 异构元素 + 连线 + 相机 + 完整序列化） | 旗舰复合模板，L2 无头内核可接贵方推演逻辑 |
| 单位/战报清单 | `view-tree` / `view-table`（虚拟滚动） | 万级条目不卡 |
| 状态机/回合流程可视化 | `view-flow`（L2 无头内核 + FSM 层） | 对战规则/回合流转可视化 |

## 6. 建议的分批节奏

- **批次 1（升级线）**：本信件 §4，独立可完成，半天内。
- **批次 2（日志与配置）**：`view-console` + `view-form`（对对战调试价值最高）。
- **批次 3（画布）**：`view-2d` 或 `view-host-engine` 桥接（联合任务组会议定夺）。
- **批次 4（推演沙盘试点）**：`view-sandbox` + `view-flow`。

## 7. 联合改造任务组邀请

我方（main-ui 项目组）提议：**派出项目联络人驻场 `battle-games`，临时组建独立改造任务组**（与其他 5 家下游完全隔离、互不干扰），共同执行 §5/§6 的改造线。我方承诺：

- 提供本信件所述全部计划的落地支持、代码级适配协助与回归验证；
- 改造过程中发现的 main-ui 缺陷，最高优先级修复；
- 贵方随时可叫停任何批次，升级线成果不受影响。

回复方式：通过 `feedback/outbox/main-ui/` 回信（写明接受/暂缓 + 期望启动批次），我方即安排联络人。

## 8. 发布包内文档清单（均在 `main-ui-0.6.0.tgz` 的 `docs/` 下）

`USER_MANUAL.md`（用户使用指南）、`API_MANUAL.md`、`DEVELOPER_GUIDE.md`、`HOST_INTEGRATION_GUIDE.md`、`HOST_ADAPTER_GUIDE.md`、`PRESET_VIEWS_GUIDE.md`、`DEVELOPMENT_LOG.md`（完整开发日志）、`MIGRATION_GUIDE_0.1.0.md` ~ `MIGRATION_GUIDE_0.6.0.md`（五份世代迁移指南）、`HOST_UPGRADE_CHECKLIST_TEMPLATE.md`（升级检查清单模板）。本项目开源（MIT），文档可自由分发。

## Suggested Steps

- Required change: 升级线 §4（`file:` 依赖改指 `main-ui-0.6.0.tgz` 或 `packages/main-ui` 源码 + 安装 + 验证）；改造线自愿分批。
- Compatibility note: 公开 API、`rendererKey` 契约、`WorkbenchDocument` schema 只增不改；持久化自动迁移；无破坏性变更；注意 0.2.0 起源码路径迁入 `packages/main-ui/`。
- Validation command: `pnpm typecheck && pnpm test && pnpm build`。
- Deadline or release note: 无强制期限；建议先完成升级线。联合改造任务组邀请见 §7。
