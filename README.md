# main-ui-react

一个可复用的“主界面布局骨架”（UI Skeleton），适用于需要以下结构的应用：

- 顶部工具条
- 左/右侧边栏
- 中央内容区（棋盘/地图/画布/视口）

本包刻意保持“纯 UI、无业务”的边界：

- 不依赖 viewport-kit
- 不依赖 p5
- 不包含任何游戏逻辑

## 分层入口（推荐）

为了控制包体并支持按需引入，推荐使用子路径入口：

- `main-ui-react/layout`：布局层（`MatchFrame`、`Toolbar`、`Panel`、`Primitives`）
- `main-ui-react/data`：数据层（`DataTablePanel`）
- `main-ui-react/navigation`：导航层（`Sidebar`、`TreePanel`）
- `main-ui-react/form`：表单层（`InspectorFormPanel`）
- `main-ui-react/command`：命令层（`CommandPalette`）
- `main-ui-react/tokens`：设计令牌
- `main-ui-react/adapters`：适配器契约与注册实现

兼容说明：

- 根入口 `main-ui-react` 仍可用，但建议新代码优先使用分层入口。

## 核心概念

- `MatchFrame`：顶部工具条 + 左右侧边栏 + 中央内容区 的布局容器。
- `Toolbar`：插槽式工具条（`left` / `center` / `right`）。
- `Sidebar`：基于 `SidebarModel` 渲染侧边栏（内部控件已升级为 Radix 原语）。
- `DataTablePanel`：基于 TanStack Table 的数据列表语义壳层。
- `TreePanel`：基于 react-arborist 的树形导航语义壳层。
- `InspectorFormPanel`：基于 react-hook-form + zod 的属性编辑语义壳层。
- `CommandPalette`：基于 cmdk 的命令面板语义壳层。

## 快速示例

### 示例 1：游戏配置条目管理

```tsx
import { MatchFrame, Toolbar } from 'main-ui-react/layout';
import { DataTablePanel } from 'main-ui-react/data';

export function GameConfigPage() {
	return (
		<MatchFrame
			toolbar={<Toolbar center={<span>配置管理</span>} />}
			center={
				<DataTablePanel
					title="单位配置"
					data={[{ id: 'u001', name: '步兵', hp: 100 }]}
					columns={[
						{ accessorKey: 'id', header: 'ID' },
						{ accessorKey: 'name', header: '名称' },
						{ accessorKey: 'hp', header: '生命值' },
					]}
				/>
			}
		/>
	);
}
```

### 示例 2：笔记目录树 + 属性编辑

```tsx
import { MatchFrame } from 'main-ui-react/layout';
import { TreePanel } from 'main-ui-react/navigation';
import { InspectorFormPanel } from 'main-ui-react/form';

export function NoteEditorPage() {
	return (
		<MatchFrame
			leftSidebar={
				<TreePanel
					title="目录"
					nodes={[
						{ id: 'root', name: '我的笔记', children: [{ id: 'n-1', name: '周报' }] },
					]}
				/>
			}
			center={
				<InspectorFormPanel
					title="笔记属性"
					fields={[
						{ name: 'title', label: '标题', kind: 'text' },
						{ name: 'priority', label: '优先级', kind: 'number' },
					]}
					initialValues={{ title: '周报', priority: 1 }}
					onSubmitValues={(values) => {
						console.log(values);
					}}
				/>
			}
		/>
	);
}
```

### 示例 3：命令面板

```tsx
import { CommandPalette } from 'main-ui-react/command';

export function CommandDemo() {
	return (
		<CommandPalette
			title="命令"
			items={[
				{ id: 'save', label: '保存当前文档', onSelect: () => console.log('save') },
				{ id: 'open', label: '打开资源目录', onSelect: () => console.log('open') },
			]}
		/>
	);
}
```

## 迁移清单（根入口 -> 分层入口）

建议新代码按下面映射迁移导入路径：

- `import { MatchFrame, Toolbar, Panel } from 'main-ui-react'` -> `import { MatchFrame, Toolbar, Panel } from 'main-ui-react/layout'`
- `import { DataTablePanel } from 'main-ui-react'` -> `import { DataTablePanel } from 'main-ui-react/data'`
- `import { Sidebar, TreePanel } from 'main-ui-react'` -> `import { Sidebar, TreePanel } from 'main-ui-react/navigation'`
- `import { InspectorFormPanel } from 'main-ui-react'` -> `import { InspectorFormPanel } from 'main-ui-react/form'`
- `import { CommandPalette } from 'main-ui-react'` -> `import { CommandPalette } from 'main-ui-react/command'`
- `import { defaultTokens } from 'main-ui-react'` -> `import { defaultTokens } from 'main-ui-react/tokens'`
- `import { getAdapterRegistry } from 'main-ui-react'` -> `import { getAdapterRegistry } from 'main-ui-react/adapters'`

兼容说明：

- 根入口不会立即移除；但建议只用于历史代码兼容，新增功能请使用子路径入口。

## 产物体积分析

执行步骤：

- 先构建：`pnpm build`
- 再分析 dist：`pnpm analyze:dist`

输出会按体积降序列出 `dist/` 下的 `.js` 与 `.d.ts` 文件，便于定位重型入口。

## 本地开发（作为 `file:` 依赖被其他项目引用时）

本包对外**只导出** `dist/`（见 `main` / `types` / `exports`），因此：

- 使用者项目只有在 `dist/` 更新后，才会看到改动。

推荐工作流：

- 在本仓库运行 `pnpm dev`（tsup --watch），保持 `dist/` 持续更新。
- 在使用者项目运行其 dev server，需要时刷新页面即可看到变更。

备选工作流：

- 在本仓库运行 `pnpm build` 生成最新 `dist/`。
- 在使用者项目运行 `pnpm install`（某些 package manager 在 Windows + file 依赖场景下需要刷新链接/类型）。
