# main-ui v0.6.0 六家下游联合改造纪要与下一步计划

> 状态：**进行中**（2026-08-31 更新）。本文档为 0.6.0 世代「发布 → 投递 → 驻场改造 → 反馈回流」全链路的主记录，新会话衔接时优先阅读本文档。

## 1. 来龙去脉

1. **版本跨度**：main-ui 从 0.1 一路演进到 0.6，经历 0.2（monorepo 化）/ 0.3（浮动窗口 + 模板一期）/ 0.4（停靠引导 + 模板二期）/ 0.5（view-flow + 虚拟滚动基座）/ 0.6（view-sandbox + view-host-engine）五个世代；全程「公开 API 只增不改、持久化自动迁移」。
2. **发布决策（2026-08-28）**：主包 `main-ui` 从 0.4.0 统一升至 **0.6.0**（与模板库世代号对齐）；11 个 `@main-ui/*` 子包 `main-ui` peer 同步 `^0.6.0`；根包名 `main-ui-workspace` → `main-ui`（对齐治理身份）；发布 `main-ui-0.6.0.tgz`（携带 20 份文档）。提交：`53b54e9`（dev-v0.5 分支，未 push）。
3. **三层触达模式**：发布包作底座 + 6 封逐户定制的详尽升级信件（升级线 + 改造线双线模型）作触达 + 联合改造任务组作保障。6 封信于 2026-08-28 全部投递（含新入网的 battle-games）。
4. **驻场顺序**（已定案）：① battle-games → ② matheshop → ③ scene-studio → ④ yeegames → ⑤ ComplexSystemGallery → ⑥ autodo。
5. **治理机制事故与修复（2026-08-29/31）**：治理后端升级为「时间戳命名信件」约定后，4 家下游沿用旧文件名导致投递静默失败；手动迁移并拉取后精读分析。修复收敛到治理主链（`m_多项目联动治理体系智能体_v1.agent` + 三 skill）：写信模板强制时间戳、新增 §4.5 写信闭环（自助投递不可跳过）、投递事务新增 `refresh-conventions` 操作（约定变更时全网刷新 `.ai-instructions.md`，无需写信通知）。**不另立 hook 层。**

## 2. 各家改造状态（截至 2026-08-31）

| # | 下游 | 起点 | 状态 | 反馈信 |
|---|---|---|---|---|
| ① | battle-games | tgz 0.1.1 | ✅ 升级线完成（源码联调，73/73 测试），改造线主动暂缓（玩法开发期，后续意向 view-console + view-form） | 已入箱已读 |
| ② | matheshop | ^0.1.1 | ✅ 升级线 + 批次 2/3 落地（view-inspector 兑现 FR-452、view-console + view-table）；批次 4 评估完成（保留 flow-graph-kit；view-2d 已装，KaTeX 接入待联合设计） | 已入箱已读 |
| ③ | scene-studio | ^0.1.0 | ✅ 升级线 + 批次 2（view-host-engine 桥接 @scene-kit）+ 批次 3（五模板全接入）；批次 4 给出 view-3d 共研四条设计输入；0.1.1 菜单缺陷闭环 | 已入箱已读 |
| ④ | yeegames | ^0.1.1 | ❌ **缺课**：依赖未升级、无提交、反馈信空模板——驻场会话未执行，待补做 | 无 |
| ⑤ | ComplexSystemGallery | ^0.1.1 | ✅ 全四批次完成（p5 桥接 + 画廊面板 + 沙盘展项 + 2d-kit 迁移），零缺陷 | 已入箱已读 |
| ⑥ | autodo | ^0.1.1 | ⏸️ 未启动（按序最后）。注意：其 8/29 "升级"提交为 0.1.0 时代旧事，与 0.6 无关 | 无 |

## 3. 下游反馈汇总（4 封已读）

**缺陷/建议（matheshop）**：
- D-1（中）迁移指南缺「宿主构建工具 alias 需跟随 monorepo 重构」检查项
- D-2（中）迁移指南缺「workspace 同名包冲突」说明（根包与子包同名 `main-ui`）
- D-3（低）view-inspector 的 InspectorSchema 缺 `readonly` 字段类型
- D-4（低）view-console 缺「追加时自动滚动到底」显式 prop 开关
- D-5（建议）HOST_UPGRADE_CHECKLIST_TEMPLATE 增加 alias / workspace 检查项模板

**发现事项（scene-studio）**：§6.1 workspace 解析需补 `packages/*` 路径（与 D-2 同类，独立踩中）；§6.2 旧主题变量仍在用（无强制迁移）。
**view-3d 共研输入（scene-studio）**：保持 ExternalEngineApi 最小契约；getViewState 含 3D 相机；WorldSnapshot 三轴扩展或 `dimensions: 3`；@scene-kit 无 3D 渲染器，需先定义 3D 渲染器契约；节奏为我方先出草案 → 对方反馈 → 迭代 2-3 轮。

**改进建议（ComplexSystemGallery）**：① 模板包首次接入需先 build（dist 未生成则 typecheck 缺类型）；② onResize 契约补充「宿主引擎自行处理 resize 后重绘」（p5 resizeCanvas 会重置画布）；③ FormSchema 是 `{fields}` 对象非数组，PRESET_VIEWS_GUIDE 需完整示例。并邀请我方抽检其构建可复现性。

**battle-games**：零破坏验证通过，无缺陷；改造线待玩法稳定后评估。

## 4. 下一步计划（优先级）

- **P0 — 文档债修复（我方仓库）**：✅ 全部完成（2026-08-31）
  1. ✅ `HOST_INTEGRATION_GUIDE.md` 新增 §8 workspace 同名包冲突说明 + `MIGRATION_GUIDE_0.2.0.md` 补「必须检查」项
  2. ✅ `HOST_UPGRADE_CHECKLIST_TEMPLATE.md` 新增 §2.1 构建工具 alias / workspace 检查项（vite/webpack/pnpm-workspace/build）
  3. ✅ `HOST_INTEGRATION_GUIDE.md` §10（原§9）模板包首次接入需先 `pnpm build`（确保 dist/ 类型声明已生成）
  4. ✅ `packages/view-host-engine/README.md` + `PRESET_VIEWS_GUIDE.md` §4.10：onResize 契约补充「宿主引擎自行处理 resize 后重绘」（p5 resizeCanvas / pixi renderer.resize 同理）
  5. ✅ `PRESET_VIEWS_GUIDE.md` §4.5 view-form 章节：FormSchema 完整示例（`{fields}` 或 `{groups}` 对象，非数组）
- **P1 — yeegames 补做（首次落地驻场机制）**：待启动。第 ④ 家驻场会话（升级线 + p5 桥接，复用已验证模式）；启动时执行驻场四步（见 §5）；P0 已完成，可启动。
- **P2 — v0.7 待办入账**：✅ 已完成（2026-08-31）。D-3（inspector readonly）、D-4（console 自动滚动 prop）已写入 `DEVELOPMENT_LOG.md` 远期清单。
- **P3 — 共研排期**：✅ 草案已发出（2026-08-31）。view-3d 接口草案 v0（ExternalEngine3dApi / View3dViewState / WorldSnapshot dimensions:3 / SceneRenderer3d）已发信给 scene-studio，含 5 条开放问题；KaTeX×view-2d 联合设计邀请（三方案 + 推荐方案 C 混合模式）已发信给 matheshop。等待对方反馈。
- **P4 — autodo 第 ⑥ 家驻场**：待启动。x6 三方案评估（view-flow / view-node / host-engine 桥接），模式成熟后启动。
- **P5 — CSG 抽检**：✅ 通过（2026-08-31）。`pnpm install`（17 workspace projects）+ `vue-tsc -b`（零错误）+ `vite build`（1.32s，仅 p5.js chunk 大小警告）均通过，构建可复现性已验证。

## 5. 联络模式（已定案：常态化驻场 + 信件留痕双轨制，2026-08-31）

联络人常态化驻场各下游快速原型项目组，正式跨项目沟通仍走 mailbox/relay 时间戳信件留痕。已固化进治理主链：注册事务技能新增 **liaison 模式**（见 `~/.agents/skills/m_多项目联动治理注册事务_v1/SKILL.md`），agent 层已登记。

**驻场启动四步**（每家一次性）：
1. 建驻场办公区 `{下游}/docs/main-ui-liaison/`（README 任务书 + ledger.md 台账）
2. 写/更新项目根 `AGENTS.md` 驻场段落（工具中立：Qoder CN、GitHub Copilot、Codex 等均识别）
3. 注入薄引用层：`.github/copilot-instructions.md` + `.qoder/rules/main-ui-liaison.md`
4. 发时间戳宣布信并自助投递留痕

**运作规则**：台账随会话持续更新（会话开始读台账、结束回写）；信件只在里程碑节点（驻场启动、批次完成、缺陷上报）发出。首次落地：P1 yeegames 补做会话。

## 6. 关键文件索引

- 发布包：`/Users/ethan/CoreFiles/ProjectsFile/main-ui/main-ui-0.6.0.tgz`
- 6 封升级信件（我方 outbox）：`docs/mailbox/relay/updates/outbox/{6家}/{6家}.md`
- 4 封反馈信（我方 inbox）：`docs/mailbox/relay/feedback/inbox/{4家}/main-ui-20260829132142.md`
- 治理主链：`~/.agents/agents/m_多项目联动治理体系智能体_v1.agent.md` + `~/.agents/skills/m_多项目联动治理*_v1/`
- 迁移指南：`docs/MIGRATION_GUIDE_0.1.0.md` ~ `docs/MIGRATION_GUIDE_0.6.0.md`
