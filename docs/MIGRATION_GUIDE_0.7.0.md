# MIGRATION_GUIDE_0.7.0

> 0.6.0 → 0.7.0 迁移指南。本次为 **`@main-ui/view-world` 交互层契约增补**（联合体 契约 C11 / 议题 A11），
> 回应下游宿主关于 Web 端手势隔离的反馈。
> **公开 API 只增不改**：新增字段/prop 全部可选且有默认值；唯一**行为变更**为 `world-click` 默认仅左键抛。

## 一、总览：改了什么

| 层 | 改动 | 兼容性 |
| --- | ---- | ------ |
| `@main-ui/core/rendering` | `Camera2D` 增可选 `rotation`；相机数学支持旋转；新增 `rotateAtScreenPoint` / `cameraRotation` / `rotateVec` | ✅ 只增（缺省 0） |
| `@main-ui/core/rendering` | 新增 `classifyWheelIntent` / `wheelPanDelta` 纯函数 | ✅ 只增 |
| `@main-ui/view-world` | `WorldPointerPayload` 增可选 `button` / `modifiers` | ✅ 只增 |
| `@main-ui/view-world` | 新 prop：`wheelMode` / `clickButtonPolicy` / `nativeGestureGuard` / `rotateOnGesture` / `rotateStep` | ✅ 只增（有默认值） |
| `@main-ui/view-world` | 新 emit：`world-contextmenu` / `cell-contextmenu` | ✅ 只增 |
| `@main-ui/view-world` | **`world-click` 默认仅左键抛**（旧：任意键） | ⚠ 行为变更（可 opt-out） |
| `@main-ui/view-world` | 交互层内置原生手势隔离（默认开） | ⚠ 默认行为（可关） |
| `@main-ui/view-world` | `WorldCameraState` 增可选 `rotation`（进视图状态快照） | ✅ 只增（旧快照照常工作） |

## 二、唯一行为变更：`world-click` 默认仅左键

**背景**：旧版 `world-click` 对**任意鼠标键**都抛；右键一次点击的 `world-click` 先于 `contextmenu`，导致宿主误清选中（右键行军失效）。

**新行为（v0.7.0 默认 `clickButtonPolicy: 'left'`）**：

- 左键点击 → `world-click`
- 右键点击 → **不抛** `world-click`，改抛 **`world-contextmenu`**
- 中键点击 → 不抛（除非 `policy='any'`）

**宿主迁移动作（按情形）**：

| 你的现状 | 需要的动作 |
| -------- | ---------- |
| 只监听 `world-click` 做左键选中 | **无需改动** |
| 用 native `pointerdown` 记 button 忽略右键 `world-click`（如 某下游宿主） | **删除该 workaround**，改监听 `world-contextmenu` |
| 依赖右键也抛 `world-click` | 传 `click-button-policy="any"` opt-out，或改绑 `world-contextmenu` |

```vue
<!-- 推荐：左右键语义分离 -->
<WorldView
  @world-click="onSelect"          <!-- 左键 -->
  @world-contextmenu="onCommand"   <!-- 右键（原生菜单已由 nativeGestureGuard 抑制） -->
/>
```

## 三、滚轮/触控板分流：`wheelMode`

旧版 `onWheel` 一律缩放，触控板双指平移也变缩放。新增 `wheelMode`：

| 值 | 行为 |
| -- | ---- |
| `auto`（默认） | 捏合（`ctrlKey`）→ 缩放；非 `ctrlKey` wheel → 平移 |
| `zoom` | 一律缩放（旧行为） |
| `pan` | 一律平移 |

**兼容**：`zoomOnWheel=false` 仍等价于 `wheelMode='pan'`；未传 `wheelMode` 的旧宿主按 `zoomOnWheel` 决定（`true` → `auto`）。

## 四、相机旋转：`rotation`

`Camera2D` / `WorldCameraState` 增**可选** `rotation`（弧度，缺省 0）：

```ts
// 旧相机照常工作
const camera = { scale: 2, pan: { x: 0, y: 0 } };

// 新：带旋转
const camera = { scale: 2, pan: { x: 0, y: 0 }, rotation: Math.PI / 6 };
```

- `getViewState` / `restoreViewState` 已纳入 `rotation`；**旧快照无此字段照常工作**（回退 0）。
- 命令式旋转：`ready.api.rotateAtScreenPoint(deltaAngle, anchorScreen)`。
- 手势旋转：`:rotate-on-gesture="true"`（“单指按住 + 另一指拖动”）。

## 五、原生手势隔离：`nativeGestureGuard`

默认开，交互层内置：`user-select:none`、pointerdown `preventDefault`、右键原生菜单抑制、iOS `touch-action`。
宿主**无需再逐浏览器逐平台兜底**。若需自行控制，传 `:native-gesture-guard="false"`。

## 六、验证清单

- [ ] `pnpm install`（workspace 内 `@main-ui/core` / `@main-ui/view-world` 已更新）
- [ ] `pnpm typecheck` 零错误
- [ ] `pnpm build` 通过
- [ ] 左键点击 → `world-click`；右键点击 → `world-contextmenu`（且无原生菜单）
- [ ] 触控板双指平移 = 平移视口；捏合 = 缩放
- [ ] （若开 `rotateOnGesture`）双指旋转生效
- [ ] 删除 native `pointerdown` 记 button 的旧兜底
