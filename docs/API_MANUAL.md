# API 手册（main-ui-react）

本文档用于说明当前公开 API 的用途、关键属性和推荐用法。

## 导入入口

### 布局层

```ts
import {
  ActivityRail,
  BottomPanel,
  EditorTabs,
  MatchFrame,
  Toolbar,
  StatusBar,
  ViewportHost,
  Sidebar,
  Panel,
} from 'main-ui-react/layout';
```

### 数据层

```ts
import { DataTablePanel } from 'main-ui-react/data';
```

### 导航层

```ts
import { TreePanel } from 'main-ui-react/navigation';
```

### 表单层

```ts
import { InspectorFormPanel } from 'main-ui-react/form';
```

### 命令层

```ts
import { CommandPalette } from 'main-ui-react/command';
```

### 令牌层

```ts
import { defaultTokens, getLayoutPresetStyles } from 'main-ui-react/tokens';
```

## 布局层 API

### MatchFrame

主界面工作台容器。

关键属性：

1. `toolbar?: React.ReactNode`
2. `activityRail?: React.ReactNode`
3. `leftSidebar?: React.ReactNode`
4. `rightSidebar?: React.ReactNode`
5. `editorTabs?: React.ReactNode`
6. `center: React.ReactNode`
7. `bottomPanel?: React.ReactNode`
8. `statusbar?: React.ReactNode`
9. `preset?: 'default' | 'vscodium' | 'konva'`
10. `layout?: MatchFrameLayoutOptions`

推荐用途：

1. 作为应用首页主壳层。
2. 容纳外部视口工具包。
4. 统一工作台四区、编辑器标签区、底部 Panel 与状态区。

### ActivityRail

左侧活动轨道，适合 `VSCodium` 风格工作台。

关键属性：

1. `items: ActivityRailItem[]`
2. `bottomItems?: ActivityRailItem[]`
3. `preset?: LayoutPreset`
4. `width?: number`
5. `style?: React.CSSProperties`

### EditorTabs

编辑器标签栏，适合文件页签、资源页签或文档切换场景。

关键属性：

1. `tabs: EditorTabItem[]`
2. `preset?: LayoutPreset`
3. `trailing?: React.ReactNode`
4. `style?: React.CSSProperties`

### BottomPanel

底部工作台 Panel，适合“问题 / 输出 / 终端”这类多标签区域。

关键属性：

1. `tabs: BottomPanelTab[]`
2. `children?: React.ReactNode`
3. `actions?: React.ReactNode`
4. `height?: number`
5. `preset?: LayoutPreset`
6. `style?: React.CSSProperties`

### Toolbar

顶部工具条。

关键属性：

1. `left?: React.ReactNode`
2. `center?: React.ReactNode`
3. `right?: React.ReactNode`
4. `preset?: LayoutPreset`
5. `translucent?: boolean`

### StatusBar

底部状态栏。

关键属性：

1. `left?: StatusBarItem[]`
2. `right?: StatusBarItem[]`
3. `leftContent?: React.ReactNode`
4. `rightContent?: React.ReactNode`
5. `preset?: LayoutPreset`

### ViewportHost

中间区视口宿主容器。

关键属性：

1. `hostRef?: React.Ref<HTMLDivElement>`
2. `preset?: LayoutPreset`
3. `padding?: number`
4. `clip?: boolean`
5. `style?: React.CSSProperties`

推荐用途：

1. 挂载 Konva `Stage`。
2. 挂载 Three.js 渲染器。
3. 挂载 X6、地图引擎或自研视口。

### Sidebar

模型驱动通用侧栏。

关键属性：

1. `model: SidebarModel`
2. `width?: number`
3. `preset?: LayoutPreset`

#### SidebarModel

```ts
type SidebarModel = {
  title?: string;
  sections: SidebarSection[];
};
```

#### SidebarSection

```ts
type SidebarSection = {
  id: string;
  title: string;
  statusText?: string;
  controls?: SidebarControl[];
  actions?: ScreenAction[];
  copyFields?: CopyField[];
  footerHint?: string;
};
```

注意事项：

1. `SidebarSection.id` 必须稳定且唯一。
2. `preset` 会联动内部控件、按钮、文本和区块风格。

### Panel

通用面板容器。

关键属性：

1. `title?: string`
2. `actions?: React.ReactNode`
3. `children?: React.ReactNode`
4. `preset?: LayoutPreset`
5. `style?: React.CSSProperties`

## 语义壳层 API

### DataTablePanel

基于 TanStack Table 的数据条目管理面板。

关键属性：

1. `title?: string`
2. `data: TData[]`
3. `columns: ColumnDef<TData, unknown>[]`
4. `initialPageSize?: number`
5. `emptyText?: string`
6. `preset?: LayoutPreset`

### TreePanel

基于 react-arborist 的树导航面板。

关键属性：

1. `title?: string`
2. `nodes: TreePanelNode[]`
3. `height?: number`
4. `onSelectNode?: (node) => void`
5. `preset?: LayoutPreset`

### InspectorFormPanel

基于 react-hook-form + zod 的属性编辑面板。

关键属性：

1. `title?: string`
2. `fields: InspectorField[]`
3. `initialValues: Record<string, string | number>`
4. `onSubmitValues: (values) => void`
5. `preset?: LayoutPreset`

### CommandPalette

基于 cmdk 的命令面板。

关键属性：

1. `title?: string`
2. `placeholder?: string`
3. `emptyText?: string`
4. `items: CommandPaletteItem[]`
5. `defaultSelectedId?: string`
6. `onSelectedIdChange?: (id: string) => void`
7. `preset?: LayoutPreset`

## 预设相关 API

### LayoutPreset

```ts
type LayoutPreset = 'default' | 'vscodium' | 'konva';
```

### getLayoutPresetStyles

根据预设名称返回主界面颜色、边框、控件和文本视觉映射。

推荐用途：

1. 宿主侧需要自己做补充样式时，保持和布局层预设一致。
2. 二次封装自定义面板时复用统一视觉语义。

## 推荐组合方式

### 组合一：VSCodium 风格工作台

1. `MatchFrame preset="vscodium"`
2. `ActivityRail preset="vscodium"`
3. `Toolbar preset="vscodium"`
4. `TreePanel` 或 `Sidebar`
5. `ViewportHost preset="vscodium"`
6. `StatusBar preset="vscodium"`

### 组合二：Konva 风格工作台

1. `MatchFrame preset="konva"`
2. `Toolbar preset="konva"`
3. `Sidebar preset="konva"`
4. `Panel preset="konva"`
5. `ViewportHost preset="konva"`
6. `StatusBar preset="konva"`

## 参考示例

1. [docs/demos/VSCodiumWorkspaceDemo.tsx](docs/demos/VSCodiumWorkspaceDemo.tsx)
2. [docs/demos/KonvaWorkspaceDemo.tsx](docs/demos/KonvaWorkspaceDemo.tsx)
3. [docs/demos/EmbeddedViewportHostDemo.tsx](docs/demos/EmbeddedViewportHostDemo.tsx)