# MIGRATION_GUIDE · main-ui 1.0.0-alpha

> 适用对象：所有 main-ui 下游项目（autodo / matheshop / yeegames / scene-kit / scene-studio 等）。
> 触发：2026-09-05 联合项目组引擎选型会 + 无畏版架构大改造。
> 基调：联合项目组优先，一次性彻底重构，下游按本指南一次性适配。

---

## 一、版本跳变概览

| 包 | 旧版 | 新版 |
|---|---|---|
| `main-ui` | `^0.6.0` | `^1.0.0-alpha` |
| `@main-ui/core` | `^0.5.0` | `^1.0.0-alpha` |
| `@main-ui/preset-views` | `^0.6.0` | `^1.0.0-alpha` |
| `@main-ui/view-*`（全部 11 个模板） | `^0.3.0` ~ `^0.6.0` | `^1.0.0-alpha` |

**操作**：下游 `package.json` 中所有 `workspace:^0.x` / `^0.x` 范围统一更新为 `^1.0.0-alpha`（或 `workspace:^1.0.0-alpha`），然后 `pnpm install`。

---

## 二、已删除的包（Breaking）

以下包名已彻底消灭，不再存在：

| 包名 | 处置 | 替代 |
|---|---|---|
| `@main-ui/viewport-2d-kit` | 🗑️ 删除（含所有入口 ./core ./pixi ./vue ./main-ui ./react-legacy ./react-pixi） | 相机数学/约束/交互 → `@main-ui/core/rendering`；PixiJS WebGL 内核 → `@main-ui/core/rendering`（PixiViewport 类）；Vue 视口组件 → `@main-ui/view-world` |
| `@main-ui/viewport-3d-kit` | 🗑️ 删除 | 远期 3D 待重新设计（Three.js，v0.8+ 评估） |
| `@main-ui/view-2d` | 🗑️ 删除 | `@main-ui/view-world`（手动模式 `@ready` 逃生舱完全覆盖 view-2d 的能力） |

### 迁移示例

**旧**：
```ts
import { PixiViewport } from '@main-ui/viewport-2d-kit/pixi';
import { Camera2D, screenToWorld } from '@main-ui/viewport-2d-kit/core';
import { registerView2dEditor } from '@main-ui/view-2d';
```

**新**：
```ts
import { PixiViewport, type Camera2D, screenToWorld } from '@main-ui/core/rendering';
import { registerWorldViewEditor } from '@main-ui/view-world';
```

---

## 三、新增能力

### 3.1 `@main-ui/core/rendering`（独立子路径）

渲染基础设施，吸收自原 viewport-2d-kit。仅画布类视图需要，DOM 类视图（form/table）不会引入 PixiJS。

导出：
- 相机数学：`Camera2D`, `ViewBox`, `Vec2`, `screenToWorld`, `worldToScreen`, `panBy`, `zoomAtScreenPoint`, `fitCameraToViewBox`, `clamp`, `cameraToCssTransform`, `serializeCamera`, `deserializeCamera`
- 约束：`CameraConstraints`, `constrainCamera`
- 交互：`createViewportInteractions` 及相关类型
- PixiJS 内核：`PixiViewport`, `PixiViewportOptions`（管理 PIXI.Application + world 容器 + 相机矩阵）

peerDependency：`pixi.js ^8.0.0`（optional）

### 3.2 `@main-ui/core/primitives`（独立子路径）

图元系统。仅画布类视图需要。

导出：
- 类型：`EntitySnapshot`, `EntityBatch`, `EntityGeometry`, `WorldBounds`, `Color`, `GridSpec`, `TextItem`, `SpriteItem`, `PolygonItem`
- 图元渲染器：`createGrid`/`renderGrid`, `createText`/`createTextLayer`/`renderTexts`, `createSprite`/`createSpriteLayer`/`renderSprites` (含 TextureResolver), `createPolygon`/`createPolygonLayer`/`renderPolygons`
- 命中测试：`hitTestGrid`, `gridCellCenter`, `hitTestBounds`, `hitTestCircle`, `hitTestPolygon`
- 快照解析：`batchToTextItems`, `batchToSpriteItems`, `batchToPolygonItems`, `snapshotToItems`

### 3.3 `@main-ui/view-world`（新包）

2D 世界可视化视图模板（MUI L1 中级游戏引擎层）。

**双模式**：
- 自动模式：传 `snapshot: EntitySnapshot` + `grid: GridSpec` → 自动渲染 Grid/Sprite/Text/Polygon 图元
- 手动模式：`@ready` 逃生舱，宿主拿到 `WorldReadyApi`（world/screenToWorld/worldToScreen/fitToBounds/getCamera/setCamera/getSize）后自行 addChild

**InteractionLayer**：
- `@cell-click` / `@cell-pointerdown`：网格命中意图（含 col/row + world/screen 坐标）
- `@world-click` / `@world-pointerdown` / `@world-pointerup`：世界坐标意图
- props：`interactive`（默认 true）、`panOnDrag`（默认 false，棋类推荐关闭）、`zoomOnWheel`（默认 true）

**注册**：`registerWorldViewEditor(runtime, options, resolveProps?, extraProps?)`

**F-3 安全**：`getViewState()` 只返回普通值，已验证 structuredClone 安全。

### 3.4 轻组件（main-ui/vue）

新增两个 opt-in 轻组件（纯壳，业务由宿主注入）：

```ts
import { SidebarView, ToolbarView } from 'main-ui/vue';
```

- `SidebarView`：侧栏布局（标题 + 默认插槽 + 页脚插槽；props：`title`/`width`/`side: 'left'|'right'`/`collapsible`/`collapsed`/`theme`；emit：`toggle`）
- `ToolbarView`：水平工具条（左/中/右三区插槽；props：`height`/`theme`）

---

## 四、F-3 / F-4 缺陷已根治

| 缺陷 | 旧现象 | 新状态 | 下游可移除的规避代码 |
|---|---|---|---|
| **F-3**（view-sandbox） | `camera: cameraState.value` 是 Proxy → `structuredClone` 崩工作台 | ✅ 已修（SandboxView 显式展开） | 薄壳组件不再需要"不传 `editorInstanceId`"的规避；沙盘可正常传 editorInstanceId 接入视图生命周期 |
| **F-4**（view-table） | `sort: internalSort.value` 非 null 时是 Proxy → 排序后崩 | ✅ 已修（TableView 显式展开） | 表格可安全开启 `sortable` 列 |

**浏览器实测**仍是必要验收：激活视图 → 连续多次 dispatch（切页签/切工作区）→ 0 DataCloneError。

---

## 五、`preset-views` 命名空间变化

```diff
- import { view2d } from '@main-ui/preset-views';
+ import { world } from '@main-ui/preset-views';
```

当前完整命名空间：`tree` / `inspector` / `world` / `table` / `form` / `node` / `consoleView` / `flow` / `sandbox` / `hostEngine`。

---

## 六、peerDependency 新增

- `@main-ui/view-world` 新增 `pixi.js ^8.0.0` peerDep。下游若使用 view-world 必须显式安装 `pixi.js`。
- `@main-ui/core` 新增 optional peerDep `pixi.js ^8.0.0`（仅当使用 `core/rendering` 或 `core/primitives` 子路径时需要；纯 DOM 类视图无需安装）。

---

## 七、推荐适配流程

1. **依赖升级**：`package.json` 中 main-ui / @main-ui/* 版本范围统一更新为 `^1.0.0-alpha`（或 `workspace:^1.0.0-alpha`），并新增 `pixi.js ^8.0.0`（若使用 view-world）。
2. **替换 import**：全文搜索 `viewport-2d-kit` / `view-2d` / `viewport-3d-kit`，按 §二 表替换。
3. **注册代码迁移**：`registerView2dEditor` → `registerWorldViewEditor`；旧的 `ViewportMainUiEditor` 手动注册代码改为 `registerWorldViewEditor(runtime, options)`。
4. **移除 F-3/F-4 规避代码**：见 §四。
5. **浏览器实测**：激活 view-sandbox / view-table（含排序）→ 切页签/切工作区 → 0 DataCloneError。
6. **运行 `pnpm install && pnpm build && pnpm test`** 确认全绿。

---

## 八、未变动 / 兼容

- `main-ui/core` / `main-ui/vue` / `main-ui/tokens` / `main-ui/adapters` / `main-ui/styles.css` 主包入口未变。
- 数据类视图模板（tree / table / inspector / form / console / node）接口未变。
- `view-flow` / `view-host-engine` 接口未变。
- `@vue-flow/core` 仍保留用于节点图（SVG 渲染），不属于渲染核心。

---

## 九、问题反馈

遇到迁移问题，请投入 `mailbox/relay/feedback/outbox/main-ui/`（走 mailbox 协议），或直接联系联合项目组。
