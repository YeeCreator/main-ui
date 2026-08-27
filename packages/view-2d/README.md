# @main-ui/view-2d

main-ui 官方视图模板：**2D 画布**。在 `@main-ui/viewport-2d-kit` 的 pixi 入口（`PixiViewportCanvas`）之上包一层实现 `MainUiViewLifecycle` 的 docking-ready 视图——**相机状态进 `getViewState`**，随浮动窗口拖出/拖回、会话恢复完整回放。

> 遵循 v0.3 模板包红线：数据经 Props 注入（含 `loading` / `error` 三态），操作经 Emits 抛出，包内不发起任何网络请求；DOM 颜色消费 `--mui-*` 主题变量（pixi 画布背景默认读取 `--mui-color-panel` 换算）；核心层不引入 pixi。

## 安装

```bash
pnpm add @main-ui/view-2d @main-ui/viewport-2d-kit main-ui pixi.js vue
```

## 组件用法

```ts
import { View2dCanvas } from '@main-ui/view-2d';
import { Graphics } from 'pixi.js';

h(View2dCanvas, {
  viewBox: { x: -160, y: -120, width: 680, height: 420 },
  onReady: (viewport) => {
    // 世界绘制在宿主侧：拿到 world 容器后画世界坐标内容
    const box = new Graphics().rect(0, 0, 120, 56).fill(0xd9ebff);
    viewport.world.addChild(box);
  },
  onCameraChange: (camera) => { /* { scale, pan } */ },
})
```

### Props

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `viewBox` | `View2dViewBox` | `DEFAULT_VIEW_2D_VIEWBOX` | 首次打开相机 fit 的世界范围 |
| `minScale` / `maxScale` | `number` | `0.25` / `4` | 缩放边界 |
| `paddingPx` | `number` | `56` | fit 时的留白 |
| `background` | `number \| null` | `null` | pixi 数值色；`null` 时读取 `--mui-color-panel` 换算（主题跟随） |
| `loading` | `boolean` | `false` | 加载三态：不挂载 pixi，显示 Loading 占位 |
| `error` | `string \| null` | `null` | 加载三态：显示错误文案 |
| `editorInstanceId` | `string \| null` | `null` | 传入则自动挂载 `MainUiViewLifecycle`，相机进快照回放 |

### Emits

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `ready` | `(viewport: PixiViewport)` | pixi 内核就绪；宿主在此绘制世界内容 |
| `camera-change` | `(camera: View2dCameraState)` | 相机变化（平移/缩放） |

### 视图状态（`View2dState`）

`getViewState` 返回 `{ camera: { scale, pan } }`；`restoreViewState` 接受同形态快照。pixi 为异步初始化，快照先入「待应用相机」队列，内核就绪后自动回放（非法快照经 `sanitizeCameraState` 回退）。

### 纯函数助手

- `isValidCameraState(raw)` / `sanitizeCameraState(raw, fallback?)`：快照相机校验与规范化。
- `parseCssColorToNumber(css)`：CSS 颜色 → pixi 数值色（`#rgb` / `#rrggbb` / `rgb()`）。

## 一键注册为 main-ui 编辑器

```ts
import { registerView2dEditor } from '@main-ui/view-2d';

registerView2dEditor(runtime, {
  allowedWorkspaceIds: ['demo'],
  title: '2D Canvas',
});
```

- `createView2dEditorDescriptor(options)`：只生成 descriptor（默认开启 `allowFloatingWindow`）。
- `createView2dEditorRenderer(resolveProps?)`：生成 renderer 适配器；`resolveProps` 为宿主适配层扩展点，默认从 `editor.payload` 读取 `{ viewBox, loading, error }`。

## 宿主适配层职责

模板包不做取数与世界绘制。宿主适配层负责：取数 → 经 `payload`/props 注入 `viewBox` 与三态，并在 `ready` 事件里把领域数据画进 `viewport.world`。参考 `demo` 中的模拟后端适配层示范。
