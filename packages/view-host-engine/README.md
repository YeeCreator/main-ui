# @main-ui/view-host-engine

外部引擎桥接模板（v0.6.0）。第三方引擎「转播窗口」：布局归我方、渲染归外部引擎。面向游戏舞台（Y 型/battle-games 型）及任何需要嵌入外部渲染的场景（CAD、第三方可视化同型）。

模板**零渲染零业务**：不画任何内容，只提供纯净 DOM 挂载点 + 尺寸通知 + 标准视图生命周期；渲染、输入、物理全部由宿主的外部引擎负责。

## 安装

```bash
pnpm add @main-ui/view-host-engine main-ui vue
```

## 用法

本包只导出组件与契约（无一键注册器——引擎与宿主强相关，注册由宿主自行组装）：

```ts
import { HostEngineView, type ExternalEngineApi } from '@main-ui/view-host-engine'

// 宿主实现引擎适配（示例：pixi / 自研引擎 / Unity WebGL）
const engine: ExternalEngineApi = {
  mount: (container) => myEngine.attach(container),
  onResize: (w, h) => myEngine.resize(w, h),
  destroy: () => myEngine.dispose(),
}
```

```vue
<HostEngineView :engine="engine" editor-instance-id="stage-1" />
```

- 传入 `editorInstanceId` 时自动实现 `MainUiViewLifecycle`（视图状态为容器尺寸 `{ containerWidth, containerHeight }`）；
- Slot 尺寸变化经 `ResizeObserver` 通知引擎 `onResize`；
- 组件销毁时调用 `engine.destroy()`（引擎侧需幂等）。

## Props

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `engine` | `ExternalEngineApi \| null` | 外部引擎实现（宿主提供；`null` 时呈现空容器） |
| `loading` / `error` | — | 三态 |
| `editorInstanceId` | `string \| null` | 传入则自动挂载视图生命周期 |

## 红线

模板不发起网络请求、不渲染业务内容；颜色消费 `--mui-*`。
