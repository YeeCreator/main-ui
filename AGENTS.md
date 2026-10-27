# main-ui 项目指令（canonical）

<!-- aoc:agents-skeleton 请补充本项目专有规则后删除本行 -->

> 本文件是本项目 AI 指令的唯一正文源；CLAUDE.md、.github/copilot-instructions.md 为薄转发壳。
> 详细多根工作区导航见同目录 WORKSPACE_GUIDE.md。

## 身份与写边界（本文件适用范围）

- **本文件适用根**：`${PROJECTS_ROOT}/main-ui`（绝对路径，唯一）。多根工作区里其他根的指令文件不适用于本根。
- **根清单真源**：`main-ui.code-workspace`（VSCode 为真源）；工作区增删根后须同步本节，勿凭记忆改。
- **本根可写**：本仓库根目录内的全部内容（源码、`docs/`、配置）；以及下列对应笔记区。
- **对应笔记区（可写）**：
  - Engs 笔记 Main UI → `${OBSIDIAN_ROOT}/Notebook/Projects/MainUI`
  - Engs 笔记 Main UI Kit → `${OBSIDIAN_ROOT}/Notebook/Projects/Main UI Kit`
- **只读依赖（挂载但不可写）**：
  - 画布型宿主 → `${PROJECTS_ROOT}/画布型宿主`
  - 对局宿主 → `${PROJECTS_ROOT}/对局宿主`
  - 多资料管理型宿主 → `${PROJECTS_ROOT}/多资料管理型宿主`
  - 画廊型宿主 → `${PROJECTS_ROOT}/画廊型宿主`
  - 场景编辑型宿主 → `${PROJECTS_ROOT}/场景编辑型宿主`
  - 用户级 Copilot 之 Skills → `${HOME}/.copilot/skills`
  - 用户级 Copilot 之 Agents → `${HOME}/.copilot/agents`
- **禁止写入**：任何未在本节列出的兄弟根；禁止按文档正文出现频次推断归属。
- **归属判据**：笔记项目的工程仓库以其 `_docs-mirror/<仓库名>/` 目录名为准，远程一律取 `git config --get remote.origin.url`（联合体 唯一总设计 §9.16）。

## 项目概述
<!-- TODO: 一到两句说明本项目是什么、技术栈、入口 -->

## 构建与测试
<!-- TODO: 只写非标准命令；AI 搜得到的通用信息不要写 -->

## 禁止与易踩坑

### 包边界四条判据（可机械校验，替代品牌黑名单）

1. `packages/main-ui` 主包与 `@main-ui/core`：**零强制第三方运行时依赖**。可声明 optional peer（不装不报错），但三方类型不得出现在公开签名里。
2. `@main-ui/view-*` 与 `@main-ui/render-*`：各自声明其渲染后端依赖，走正式选型流程（四维度评估含包体积与许可证；先例 pixi / katex / vue-flow / three）。
3. **不承载宿主业务语义**（业务数据 / 数据库 / 规则引擎 / 画布内部语义）。
4. 命名 lane：`view-*` = 视图模板（有 editorKind、可注册为编辑器）；`render-*` = 渲染后端（无 editorKind、只实现 `ViewportBackend`）。**维度是后端属性，不是包名属性**。

> **为什么是四条判据而不是品牌黑名单**：原禁令（历史上写成「不导入 React / p5 / Konva / Three.js」）的原始动机见 `archive/main-ui全新工作台内核功能设计-设计-20260430-001.md:532` —— 当年 画布型宿主 与 对局宿主 仍是 React 应用，故「支持通用外部内容挂载协议，但不把 React 写入 main-ui 依赖」。真因是**框架无关内核 + 多宿主中立 + 不吞宿主业务语义**，不是包体积也不是许可证。
>
> 它选错了维度：React 是**框架**（与 Vue 抢 DOM、双运行时、每个宿主被迫买单），p5 / Konva / Three 是**渲染库**（放进哪个包由那个包的依赖声明负责）。两类塞进同一条禁止句，正是动机失传的直接原因；而且那条黑名单**已被绕过一次** —— `@main-ui/core` 把 pixi 声明为 optional peer 并真实 import 它。

### 渲染与视图

1. **`view-world` 的二维能力不是兼容层、不是待废弃**。教训：`viewport-3d-kit` 2026-09-05 删除后坑空一年多无人接。二维档是 `render-3d` 里写死的预设，永久一等公民。
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
3. 跨仓消费方走 `反馈通道` 或直接同轮适配（同联合体成员）；不擅自改他人仓库。

## 项目结构（速查，详情见 WORKSPACE_GUIDE.md）

- 💻 本项目 · main-ui → `./`

