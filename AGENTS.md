# main-ui 项目指令（canonical）

> 本文件是本项目 AI 指令的唯一正文源；`CLAUDE.md`、`.github/copilot-instructions.md` 为薄转发壳。

## 仓库边界

1. **本仓是通用库**：`main-ui` 内核 + `@main-ui/view-*` 视图模板 + `@main-ui/render-*` 渲染后端。它面向**所有下游宿主**，不面向某一家。
2. **宿主业务不进本仓**：任何具体宿主的业务模型、数据源、领域规则、私有文件名都不写入本仓源码、文档、注释、测试数据与日志。
3. **语域中性**：本仓的读者是全体消费方，且消费方之间彼此不可见。因此不得出现任何单一消费方的身份——仓名、项目名、私有条目名、行业专有词。**公开契约（稳定键、导出名、类型名、枚举值、测试数据、错误文案）同样适用。**
4. **判据**：把它给另一个消费方看，会不会暴露第三方的存在？会 ⇒ 不合格。
5. **下游以形态表述**：需要举例时用形态（资料管理型 / 画布型 / 对局型 / 场景编辑型 / 画廊型等），不用仓名。

## 项目概述

Vue 3 + framework-free core 的工作台内核库。提供工作台文档模型（split tree / tab / editor / overlay / floating window）、命令与输入系统、持久化与迁移、官方视图模板库与可插拔渲染后端。不包含任何宿主业务逻辑，不兼容旧 `main-ui-react`。

## 构建与测试

1. `pnpm build`：全包构建。
2. `pnpm typecheck`：类型检查。
3. `pnpm test`：单元测试。
4. `pnpm test:e2e`：端到端测试。
5. `pnpm run demo:dev`：启动 demo（`http://127.0.0.1:4173`）。
6. `pnpm release:pack`：发布打包（会先跑 `scripts/copy-release-docs.mjs`）。

## 禁止与易踩坑

### 包边界四条判据（可机械校验，替代品牌黑名单）

1. `packages/main-ui` 主包与 `@main-ui/core`：**零强制第三方运行时依赖**。可声明 optional peer（不装不报错），但三方类型不得出现在公开签名里。
2. `@main-ui/view-*` 与 `@main-ui/render-*`：各自声明其渲染后端依赖，走正式选型流程（四维度评估含包体积与许可证；先例 pixi / katex / vue-flow / three）。
3. **不承载宿主业务语义**（业务数据 / 数据库 / 规则引擎 / 画布内部语义）。
4. 命名 lane：`view-*` = 视图模板（有 editorKind、可注册为编辑器）；`render-*` = 渲染后端（无 editorKind、只实现 `ViewportBackend`）。**维度是后端属性，不是包名属性**。

> **为什么是四条判据而不是品牌黑名单**：原禁令（历史上写成「不导入 React / p5 / Konva / Three.js」）的真实动机是**框架无关内核 + 多宿主中立 + 不吞宿主业务语义**，不是包体积也不是许可证。当年部分宿主仍是 React 应用，故有「支持通用外部内容挂载协议，但不把 React 写入 main-ui 依赖」。
>
> 品牌黑名单选错了维度：React 是**框架**（与 Vue 抢 DOM、双运行时、每个宿主被迫买单），p5 / Konva / Three 是**渲染库**（放进哪个包由那个包的依赖声明负责）。两类塞进同一条禁止句，正是动机失传的直接原因；而且那条黑名单**已被绕过一次**——`@main-ui/core` 把 pixi 声明为 optional peer 并真实 import 它。

### 渲染与视图

1. **`view-world` 的二维能力不是兼容层、不是待废弃**。教训：`viewport-3d-kit` 删除后坑空很久无人接。二维档是 `render-3d` 里写死的预设，永久一等公民。
2. **不新建 `view-3d` 模板**，不新建第二个内置三维后端。三维能力是 `view-world` 的可插拔后端。
3. **不复制 `-2d` 后缀目录做双轨备份**：复制的是目录、分叉的是规则与数据，撞「权威层单点」。改用保真对照 + 按条目声明能力。
4. **不写 GLSL、不用 `onBeforeCompile`**：自定义着色器一律 TSL。这是「一次到位用 WebGPU」能成立的前提。
5. **同类实体必须共享原型几何再实例化**：内容侧不得为每个实体生成独立几何。判据：一帧内 N 种几何对应 N 个同类实体 ⇒ 违规（`render-3d` 的 `findInstancingViolations()` 可断言）。
6. **线永远不独立成几何贴在平面上**：要么进着色器，要么抬高极小量，要么开多边形偏移（共面闪面）。
7. **快照与相机状态必须是可序列化纯值**（`world-state.ts` 的既有做法，防 `structuredClone` 崩溃）。
8. **三维类型不得出现在 `core` 与主包公开签名**；渲染库依赖止于 `render-*` 包内部。

### 其他

1. 禁改 `packages/*/dist`（构建产物），只改 `src`。
2. `main-ui` 主包与 `@main-ui/core` 的公开导出面变动需同步 `docs/API_MANUAL.md`。
3. 跨仓消费方走反馈通道或直接同轮适配；不擅自改他人仓库。
4. **提交前语域自查**：`git diff --cached -U0 | grep -E "^\+" | grep -niE "<本仓语域词表>"`，输出为空才可提交。词表见本文件「仓库边界」第 3 条。

## 项目结构

```
packages/
  main-ui/        主包（workbench 内核 + Vue 渲染层）
  core/           框架无关 core
  view-*/         官方视图模板
  render-*/       可插拔渲染后端
demo/             中性 demo（不含宿主业务）
docs/             当前有效文档（用户手册 / API / 接入与迁移指南）
scripts/          构建与发布脚本
```
