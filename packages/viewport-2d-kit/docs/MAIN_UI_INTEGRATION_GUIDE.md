# MAIN_UI_INTEGRATION_GUIDE

本文说明 `viewport-2d-kit` 在 `main-ui` 编辑器体系中的标准位置、推荐接法与边界约束。

结论先行：`viewport-2d-kit` 是 editor renderer 内部的 2D foundation，不是 `main-ui/core` 的一部分。**自方案 B（2026-08-26）起，渲染内核唯一化为 pixi.js，`main-ui` 连接器是薄壳。**

## 0. 接入前必读规范

任何宿主项目在把 `viewport-2d-kit` 组合进 `main-ui` 之前，都必须先阅读并遵守以下文档。这些不是背景材料，而是前置开发规范。

必须先阅读：

1. `main-ui/docs/DEVELOPER_GUIDE.md`
2. `main-ui/docs/HOST_INTEGRATION_GUIDE.md`
3. `viewport-2d-kit/docs/DEVELOPER_GUIDE.md`
4. `viewport-2d-kit/docs/MAIN_UI_INTEGRATION_GUIDE.md`

开始实现前，宿主至少应确认以下边界：

1. `main-ui` 只负责工作台生命周期。
2. `viewport-2d-kit` 只负责 viewport foundation。
3. 宿主业务 renderer 继续负责业务模型、规则与服务。
4. 任何业务语义都不应回灌到 `main-ui/core` 或 `viewport-2d-kit` 内部。

若没有先完成这一步，后续接入即使暂时可运行，也不能算符合正式接入规范。

## 1. 标准定位

在 `main-ui` 生态中，`viewport-2d-kit` 的推荐位置如下：

```text
main-ui workspace
-> main-ui editor descriptor
-> 薄连接器（viewport-2d-kit/main-ui：ViewportMainUiEditor）
-> pixi 渲染内核（viewport-2d-kit/pixi：PixiViewport，pixi.js）
-> 业务绘制内容（world 容器中的 Graphics/Sprite）
```

也就是说：

1. `main-ui` 负责工作台生命周期。
2. 薄连接器（`main-ui` 入口）只提供标签页窗口外观与注册。
3. pixi 内核（`pixi` 入口）负责 2D 世界空间、相机、平移、缩放、坐标换算与**全部渲染**。
4. 宿主业务 renderer 负责把业务模型画到这个视口里（向 `world` 添加世界坐标内容）。

## 2. `viewport-2d-kit` 解决什么问题

`viewport-2d-kit` 负责：

1. pixi 渲染内核（`PixiViewport`）：camera 模型、滚轮/拖拽平移、锚点缩放、world/screen 坐标换算、渲染。
2. Vue 薄封装 `PixiViewportCanvas` 与 React 薄封装 `PixiViewportReact`。
3. `main-ui` 薄连接器 `ViewportMainUiEditor` 与编辑器辅助注册。

`viewport-2d-kit` 不负责：

1. 宿主业务状态。
2. 宿主规则引擎。
3. 宿主数据库或服务调用。
4. `main-ui` 的 workspace、tab、overlay 生命周期。

## 3. 推荐接入方式

### 3.1 方式 A：薄连接器（推荐，pixi 内核）

当宿主需要一个中性且高性能的 viewport editor，直接使用薄连接器：

```ts
import { ViewportMainUiEditor } from 'viewport-2d-kit/main-ui'

runtime.vue.registerEditorRenderer('viewport-foundation-editor', ViewportMainUiEditor)
```

适用场景：

1. `main-ui` demo。
2. 中性编辑器底座验证。
3. 宿主先验证工作台与 viewport 的组合是否成立。

该连接器内部挂载 `PixiViewportCanvas`（pixi 渲染内核），payload 的 `nodes` / `edges` 以 Graphics 绘制进 world 容器。

### 3.2 方式 B：直接使用 pixi 内核，由宿主自定义 renderer

```ts
import { PixiViewportCanvas } from 'viewport-2d-kit/pixi'
// React 宿主：
import { PixiViewportReact } from 'viewport-2d-kit/react-pixi'
```

适用场景：

1. 宿主已有业务 renderer。
2. 宿主需要把业务节点、边、棋子、图形画在 viewport 内。
3. 宿主需要自己的 context、service、command bus 与 inspector 联动。

推荐做法：宿主业务 renderer 通过 `@ready`（Vue）或 `onReady`（React）拿到 `PixiViewport`，向 `world` 容器添加世界坐标内容，相机由内核唯一管理。

### 3.3 方式 C：宿主继续使用 React 或其他渲染栈，通过 `main-ui` mount adapter 承接

这种方式下：

1. `main-ui` 只承载 editor surface。
2. `viewport-2d-kit` 仍可作为业务画布内部的 camera foundation。
3. React、Canvas、SVG 或其他运行时仍由宿主自己 mount。

## 4. 在 `main-ui` 中的最小注册方式

### 4.1 注册 renderer

```ts
runtime.vue.registerEditorRenderer('viewport-foundation-editor', ViewportMainUiEditor)
```

### 4.2 注册 editor descriptor

```ts
runtime.core.registerEditor({
  kind: 'viewport-foundation',
  rendererKey: 'viewport-foundation-editor',
  capability: {
    multiOpen: true,
    closable: true,
    movable: true,
  },
  presentation: {
    defaultSurface: 'tab',
  },
  availability: {
    workspaceIds: ['workspace-demo', 'workspace-analysis'],
  },
})
```

### 4.3 在 workspace 中打开它

```ts
runtime.core.registerWorkspace({
  id: 'workspace-demo',
  title: 'Demo',
  icon: 'VP',
  allowedEditorKinds: ['viewport-foundation'],
  createDefaultLayout: () => createSingleGroupLayout({ id: 'workspace-demo' }),
  defaultOpenRequests: [{ editorKind: 'viewport-foundation' }],
})
```

## 5. payload 约定

当 `viewport-2d-kit` 作为 `main-ui` editor 使用时，payload 应只保存轻量配置：

1. `viewBox`
2. `minScale`
3. `maxScale`
4. `paddingPx`
5. `nodes` / `edges`（demo 级轻量内容，绘制进 pixi world）
6. 轻量引用型业务参数

不应写入：

1. 大型节点树。
2. 完整图数据缓存。
3. 长生命周期服务实例。
4. 宿主业务模型本体。

## 6. 三个宿主中的推荐位置

### 6.1 `autodo-app`

推荐位置：知识图谱或 TeX DAG renderer 内部。

边界：

1. `viewport-2d-kit` 只负责图谱视口。
2. 图谱节点语义、筛选、详情、文献状态仍由 `autodo-app` 负责。

### 6.2 `matheshop`

推荐位置：`formula-canvas` editor 内部的唯一 camera foundation。

边界：

1. `viewport-2d-kit` 负责 camera、缩放、平移、坐标换算。
2. `CanvasBoard`、网格规则、公式对象、Inspector 仍由 `matheshop` 负责。

### 6.3 `yeegames`

推荐位置：`game-session` 内的棋盘或地图视口底座。

边界：

1. `viewport-2d-kit` 负责棋盘视口。
2. 棋类规则、输入、状态机与资源系统仍由 `yeegames` 负责。

## 7. 与 `main-ui` 的边界约束

以下约束必须长期保持：

1. `main-ui/core` 不反向依赖 `viewport-2d-kit`。
2. `main-ui` 不把 `viewport-2d-kit` 写成强制业务依赖。
3. `viewport-2d-kit` 不直接理解宿主业务模型。
4. `viewport-2d-kit` 可以提供 `main-ui` 组合入口，但不能接管工作台生命周期。

## 8. 常见错误接法

以下接法应避免：

1. 让 `main-ui/core` 直接 import `viewport-2d-kit`。
2. 把业务节点语义写入 `viewport-2d-kit`。
3. 将宿主服务实例放进 viewport payload。
4. 让 `viewport-2d-kit` 取代宿主 renderer 本身。
5. 新项目继续使用 CSS transform 的 `Viewport2DCanvas` / `Viewport2D` 或第三方 `pixi-viewport`（历史兼容层，渲染内核唯一化为 `PixiViewport`）。
6. 在宿主组件里手写多份 `clientX/clientY -> world` 胶水，而不统一走 `PixiViewport.screenToWorld`。
7. 在薄连接器（`src/main-ui/`）里承载业务渲染实现。

## 9. 最小验收清单

一轮 `main-ui` 组合接入至少应满足：

1. viewport editor 能作为普通 tab 打开（薄连接器内部 pixi canvas 已挂载）。
2. 平移、缩放、fit 行为正常（pixi 内核，无控制台报错）。
3. `main-ui` 的 workspace 切换不破坏 viewport state。
4. 宿主业务逻辑没有被写入 `main-ui/core` 或 `viewport-2d-kit`。
5. 宿主刷新后可恢复轻量 payload。

## 10. 推荐配套文档

建议与以下文档结合使用：

1. `README.md`
2. `使用指南.md`
3. `示例集成.md`
4. `main-ui/docs/HOST_INTEGRATION_GUIDE.md`

本文件的优先用途是：当宿主项目需要把 `viewport-2d-kit` 放进 `main-ui` 编辑器体系时，给出最直接的接入位置和边界说明。