# support advice (out-down): viewport-2d-kit -> autodo

## Context

`viewport-2d-kit` supports `autodo` because `autodo` depends on `viewport-2d-kit`.

## Adaptation Advice

**viewport-2d-kit 已发布 pixi 内核化（方案 B 定稿，2026-08-26）。** 架构对齐
V3D（three.js 内核 + 薄壳）：渲染/交互/功能全部由 pixi.js 内核（`PixiViewport`）
唯一承载，V2D 对外只是能放进 main-ui 标签页的薄连接器（`ViewportMainUiEditor`）。

对 autodo 的影响（知识图谱 / TeX DAG 等 2D surface）：

1. 若已通过 `viewport-2d-kit/main-ui` 的 `ViewportMainUiEditor` 注册图谱编辑器：
   注册契约（descriptor 工厂 / `registerViewportMainUiEditor` / `VIEWPORT_MAIN_UI_*` 常量）
   **完全不变**，仅需升级依赖后重新构建，即可自动获得 pixi 高性能渲染。
2. 若直接使用 `viewport-2d-kit/vue` 的 `Viewport2D` / `Viewport2DCanvas`（CSS transform）：
   该路径保留为历史兼容层，**不推荐新增依赖**；新 surface 请迁移到
   `viewport-2d-kit/pixi`（`PixiViewportCanvas`，Vue）并向 `world` 容器添加世界坐标内容。
3. 若使用 React：新增 `viewport-2d-kit/react-pixi` 的 `PixiViewportReact`。
4. 新依赖：`pixi.js@^8` 为 peerDependency，需自行安装。

## Suggested Steps

- Required change: 升级 `viewport-2d-kit` 依赖（file: 引用时重新 `pnpm install`）；`pixi.js` 加入依赖。
- Compatibility note: `ViewportMainUiEditor` payload 契约不变（viewBox/minScale/maxScale/paddingPx/nodes/edges）；`Viewport2DCanvas` 仍可用但不再扩展。
- Validation command: `pnpm typecheck && pnpm build`；浏览器打开图谱/TeX DAG surface，确认平移缩放无报错。
- Deadline or release note: 无强制截止；建议下一个迭代窗口内随依赖升级切换。
