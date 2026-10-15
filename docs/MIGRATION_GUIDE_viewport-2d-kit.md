# MIGRATION_GUIDE_viewport-2d-kit

> **`viewport-2d-kit` 已整包删除**（2026-09，随 `view-world` 新建一并进行）。本指南给出替代路径与逐步迁移动作。
> 面向仍引用该包的下游（`多资料管理型宿主` · `画廊型宿主` 已完成迁移）。

## 一、包去哪了

| 原包 | 状态 | 替代 |
| ---- | ---- | ---- |
| `viewport-2d-kit`（整个 monorepo 包） | **已删除**（`main-ui/packages/viewport-2d-kit` 不存在） | 见下表按用途分流 |
| `viewport-3d-kit` | **已删除** | 远期 3D 待重新设计 |
| `view-2d` | **已删除** | 并入 `@main-ui/view-world` 手动模式 |
| `@main-ui/viewport-2d-kit`（main-ui 内别名） | **已删除** | 悬空声明，须移除 |

**症状**：仍引用它的仓库**无法 fresh install**（`file:../viewport-2d-kit` 路径不存在 / `workspace:*` 无匹配版本），此前靠 `node_modules` 残留目录续命，一旦 `rm -rf node_modules` 即失败。

## 二、按用途选替代（关键分流）

| 你原来用它做什么 | 迁移到 | 说明 |
| ---------------- | ------ | ---- |
| **PixiJS 图元自动渲染**（`EntitySnapshot` → Grid/Sprite/Text/Polygon） | `@main-ui/view-world` | PixiJS 渲染器 |
| **手动 PixiJS 绘制**（拿 world 容器自己 addChild） | `@main-ui/view-world`（`@ready` 逃生舱） | 同上 |
| **宿主自绘 SVG/DOM**（相机 + 交互，内容自己画） | **`@main-ui/view-canvas`** | **纯 DOM/SVG**；`ViewportCanvas` + `ViewportCanvasShell` + `useViewportHostBridge` |
| **只用相机数学**（`screenToWorld` 等纯函数） | `@main-ui/core/rendering` | 相机纯函数（原 viewport-2d-kit 的 `core` 已吸收至此） |
| **三栏业务画布壳**（左面板 + 舞台 + 右面板） | `@main-ui/view-canvas`（`ViewportCanvasShell`） | 纯布局壳，不含业务 |

## 三、`viewport-2d-kit/vue` → `@main-ui/view-canvas`（API 兼容）

**只需改名，无需改逻辑**：

| 原 | 新 |
| -- | -- |
| `Viewport2DCanvas` | `ViewportCanvas` |
| `Viewport2DCanvasExpose` | `ViewportCanvasExpose` |
| `ViewportContainerSize` | `ViewportContainerSize`（不变） |
| `ViewportBusinessCanvasShell` | `ViewportCanvasShell` |
| `useViewportHostBridge` | `useViewportHostBridge`（不变） |
| `Camera2D` | `Camera2D`（不变，来自 `@main-ui/core/rendering`） |

Props / Emits / exposes / 插槽**全部一致**：

- Props：`viewBox` / `minScale` / `maxScale` / `paddingPx` / `disablePan`（+ 新增 `zoomOnWheel`）。
- Emits：`zoomPercentChange` / `interactingChange` / `cameraChange`。
- 默认插槽：`{ width, height, cameraTransform, scale, camera }`。
- Exposes：`fitToBounds` / `zoomIn` / `zoomOut` / `getCamera` / `setCamera` / `screenToWorld` / `worldToScreen` / `getSize`。
- Shell 插槽：`left` / `default` / `right` / `toolbarLeading` / `toolbarCenter` / `toolbarTrailing`。

### 迁移步骤

```bash
# 1. 移除旧依赖、安装新包
pnpm remove viewport-2d-kit          # 或 @main-ui/viewport-2d-kit
pnpm add @main-ui/view-canvas@^0.7.0 main-ui@^0.7.0

# 2. 改导入（三处改名）
#   - import { Viewport2DCanvas, type Viewport2DCanvasExpose } from 'viewport-2d-kit/vue'
#   + import { ViewportCanvas, type ViewportCanvasExpose } from '@main-ui/view-canvas'
#   - <Viewport2DCanvas ... />   + <ViewportCanvas ... />
#   - <ViewportBusinessCanvasShell>  + <ViewportCanvasShell>

# 3. 清理构建脚本中指向已删包的进程
#   dev:deps 里的 'pnpm -C ../viewport-2d-kit dev' 必须删除

# 4. 删除残留 node_modules（否则会掩盖真实失败）
rm -rf node_modules && pnpm install

# 5. 验证
pnpm build   # tsc -b / vue-tsc -b && vite build
grep -c "viewport-2d-kit" pnpm-lock.yaml   # 应为 0
```

## 四、验证清单

- [ ] `package.json` 无 `viewport-2d-kit` / `@main-ui/viewport-2d-kit` 任何形式
- [ ] 源码无 `viewport-2d-kit` 导入
- [ ] 构建脚本（`dev:deps` 等）无指向已删包的进程
- [ ] `rm -rf node_modules && pnpm install` 成功（**这一步才证明真迁移**）
- [ ] `pnpm-lock.yaml` 中 `viewport-2d-kit` 引用数 = 0
- [ ] `pnpm build` 通过
