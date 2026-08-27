# support advice (out-down): viewport-2d-kit -> yeegames

## Context

`viewport-2d-kit` supports `yeegames` because `yeegames` depends on `viewport-2d-kit`.

## Adaptation Advice

**viewport-2d-kit 已发布 pixi 内核化（方案 B 定稿，2026-08-26）。** 架构对齐
V3D（three.js 内核 + 薄壳）：渲染/交互/功能全部由 pixi.js 内核（`PixiViewport`）
唯一承载，V2D 对外只是能放进 main-ui 标签页的薄连接器（`ViewportMainUiEditor`）。

对 yeegames 的影响（棋盘 / 地图视口、`game-session`）：

1. 棋盘/地图视口底座推荐迁移到 `viewport-2d-kit/pixi` 的 `PixiViewportCanvas`（Vue）：
   棋子/地形以世界坐标 Graphics/Sprite 绘制进 `world` 容器，相机由内核唯一管理
   （参考 battle-games 的 `PixiRenderer` 已先行接入并通过实测）。
2. 若使用 `viewport-2d-kit/main-ui` 连接器：注册契约不变，升级依赖即可。
3. 点击命中使用 `viewport.screenToWorld({ x, y })`（相对 canvas 的 CSS 像素）。
4. 新依赖：`pixi.js@^8` 为 peerDependency，需自行安装。

## Suggested Steps

- Required change: 升级 `viewport-2d-kit` 依赖；`pixi.js` 加入依赖。
- Compatibility note: 相机/坐标 API 与 core 一致；`Viewport2DCanvas` 保留但不再扩展。
- Validation command: `pnpm typecheck && pnpm build`；验证对局视口渲染、拖拽、缩放与点击落子。
- Deadline or release note: 无强制截止；battle-games 已作为同构参考实现完成迁移。
