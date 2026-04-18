# 开发者指南（main-ui-react）

本文档面向维护者与二次开发者，说明项目定位、架构边界、分层导出、预设机制和本地开发方式。

## 项目定位

`main-ui-react` 是一个“工作台主壳层组件库”，目标不是实现业务视口，而是为宿主项目提供一致的主界面骨架。

当前优先支持的界面结构是：

1. 顶部工具条。
2. 左侧导航树或资源树。
3. 中央视口宿主区。
4. 右侧属性与检查器面板。
5. 底部状态栏。

## 当前架构边界

### 本库负责什么

1. `MatchFrame` 主布局容器。
2. `Toolbar`、`StatusBar`、`Sidebar`、`Panel` 等壳层组件。
3. `ViewportHost` 这类稳定挂载位。
4. `TreePanel`、`DataTablePanel`、`InspectorFormPanel`、`CommandPalette` 等语义壳层。
5. 设计令牌与风格预设。

### 本库不负责什么

1. Konva、Three.js、X6、地图引擎等视口能力本体。
2. 业务状态管理。
3. 命令总线、撤销重做、文档模型、资源系统等业务中台能力。
4. 游戏规则、编辑器运行时、地图数据解析等领域逻辑。

## 关于 `vscodium` 与 `konva` 预设

当前项目已经明确把两者拆成不同层级：

1. `vscodium`：工作台视觉与信息架构风格参考。
2. `konva`：画布类工具台视觉参考。

它们在本仓库中都被实现为 `layout preset`，而不是直接嵌入第三方产品本体。

因此，宿主项目完全可以：

1. 使用 `vscodium` 预设，但在中间挂载自研 3D 视口。
2. 使用 `konva` 预设，但在中间挂载 X6 或地图视口。

## 分层导出结构

推荐使用子路径入口：

1. `main-ui-react/layout`
2. `main-ui-react/data`
3. `main-ui-react/navigation`
4. `main-ui-react/form`
5. `main-ui-react/command`
6. `main-ui-react/tokens`
7. `main-ui-react/adapters`

根入口仅用于历史兼容，不建议新增代码继续依赖扁平导出。

## 关键组件关系

### 布局层

1. `MatchFrame`：工作台总容器。
2. `ActivityRail`：左侧活动轨道。
3. `EditorTabs`：中心工作区顶部标签栏。
4. `Toolbar`：顶部插槽式工具条。
5. `BottomPanel`：中心工作区底部多标签面板。
6. `StatusBar`：底部双区状态栏。
7. `ViewportHost`：中间区挂载位。
8. `Panel`：通用内容块容器。
9. `Sidebar`：模型驱动侧栏。

### 语义壳层

1. `TreePanel`：树导航语义层。
2. `DataTablePanel`：数据条目管理语义层。
3. `InspectorFormPanel`：属性编辑语义层。
4. `CommandPalette`：命令检索语义层。

### 令牌层

1. `DesignTokens`：通用设计令牌。
2. `LayoutPreset`：主界面风格预设。
3. `getLayoutPresetStyles()`：预设视觉映射表。
4. `ThemeProvider` / `useTheme`：三态主题（light/dark/system）运行时能力。

## 预设联动原则

当前的视觉联动策略是：

1. `MatchFrame`、`Toolbar`、`StatusBar`、`ViewportHost` 负责工作台外层颜色与分隔线。
2. `ActivityRail`、`EditorTabs`、`BottomPanel` 负责工作台导航与编辑器附属区的结构语义。
3. `Sidebar` 和 `Panel` 负责内部区块、文本、控件边框与背景联动。
4. 更重的语义壳层目前仍主要通过 `style` 做宿主级补充，不强制全部自动联动。

这样处理的原因是：

1. 不破坏已有公共 API。
2. 避免一次性把所有语义壳层风格强绑定到单一预设系统。
3. 为未来的 `WorkbenchShell`、`ActivityRail` 等更细粒度抽象保留空间。

## 主题机制

当前主题系统采用“预设 + 运行时主题模式”的两层结构：

1. 预设层：`default` / `vscodium` / `konva` 提供视觉语义。
2. 主题层：`light` / `dark` / `system` 决定当前实际颜色分支。

实现要点：

1. `ThemeProvider` 在 `system` 模式下监听 `prefers-color-scheme`。
2. Provider 会把当前主题写入 CSS 变量，组件通过 `getLayoutPresetStyles()` 自动读取。
3. 旧代码不接 Provider 时仍可使用预设默认主题回退，不会破坏兼容。

接入建议：

1. 宿主根组件统一包裹 `ThemeProvider`。
2. 默认建议 `defaultMode='system'`，并设置独立 `storageKey`。
3. 业务设置面板通过 `useTheme().setThemeMode()` 切换主题。

## 本地开发与验证

### 常用命令

1. `pnpm install`
2. `pnpm dev`
3. `pnpm demo:dev`
4. `pnpm demo:build`
5. `pnpm build`
6. `pnpm typecheck`
7. `pnpm analyze:dist`

### 联调建议

如果本包被其他仓库以 `file:` 依赖方式引用，请使用：

1. 当前仓库运行 `pnpm dev`。
2. 宿主仓库运行自己的开发服务器。

如果不使用 watch：

1. 当前仓库运行 `pnpm build`。
2. 宿主仓库重新安装依赖或刷新链接。

## 示例代码位置

为了降低使用门槛，当前仓库已补充演示文件：

1. [docs/demos/VSCodiumWorkspaceDemo.tsx](docs/demos/VSCodiumWorkspaceDemo.tsx)
2. [docs/demos/KonvaWorkspaceDemo.tsx](docs/demos/KonvaWorkspaceDemo.tsx)
3. [docs/demos/EmbeddedViewportHostDemo.tsx](docs/demos/EmbeddedViewportHostDemo.tsx)

这些示例主要用于说明接入方式，不作为构建产物的一部分。

另外，仓库现在提供一个真正可运行的本地 demo 宿主：

1. 入口目录：`demo/`
2. 启动命令：`pnpm demo:dev`
3. 构建命令：`pnpm demo:build`

该宿主直接引用 `docs/demos/*.tsx` 中的示例组件，便于同步验证组件改动与文档效果。

当前 demo 已采用 `React.lazy` 懒加载三个示例，因此后续新增 demo 时不会强制把所有示例打进同一个首屏 chunk。

另外，`demo/vite.config.ts` 已增加 `manualChunks` 策略，用于把 React、Radix、react-arborist、react-hook-form/zod 等公共依赖拆分为更细粒度的共享 chunk。

## 维护建议

后续维护时，建议坚持以下原则：

1. 先稳定壳层语义，再扩展视觉预设。
2. 视口相关需求优先通过 `ViewportHost` 容纳，不把第三方视口引擎硬编码进库内。
3. 文档更新必须与 API 变更同步，尤其是 `layout`、`preset`、导出路径和示例。
4. 如果新增工作台区域抽象，优先放在 `layout` 层，而不是塞进具体业务面板组件中。
