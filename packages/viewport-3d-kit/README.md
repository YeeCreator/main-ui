# viewport-3d-kit

通用 3D 视口工具包（Core + Vue3 主结构，React 兼容层保留），提供：

- Vue 主视口 `Viewport3D`（默认入口）
- 可选小地图 `MiniMap3D`
- React 兼容入口（用于已有 React 工程或 Three React 生态能力）

当前版本已支持：

- 视口导航（旋转/平移/缩放）
- 运行模式 / 编辑模式切换（默认运行模式）
- 对象选中与高亮
- 基础变换工具（平移/旋转/缩放）
- Blender 风格显示模式（Wireframe / Solid / Rendered）
- Unreal 风格运行导航（运行模式默认开启）
- 中键修饰键预设（中键平移、Alt+中键缩放、Ctrl+中键旋转）
- 小地图开关（受控/非受控）
- 相机状态受控/非受控（位置、目标点、FOV）
- 视角缩放、重置视角、聚焦选中对象

## 架构策略

1. 主结构固定为 Core + Vue3，作为工具包间联动的统一技术栈。
2. React 仅作为兼容层保留，在 Three React 生态能力更优或迁移阶段按需使用。
3. 新增交互能力优先沉淀到 Core，再由 Vue/React 适配层消费。

## 安装

```bash
npm install viewport-3d-kit-react three @react-three/fiber @react-three/drei react react-dom
```

## 快速接入（Vue3 最小示例）

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import { Viewport3D } from 'viewport-3d-kit/vue';
import { createDemoEntities } from 'viewport-3d-kit/core';

const entities = computed(() => createDemoEntities());
const miniMapEnabled = ref(false);
</script>

<template>
  <Viewport3D
    class-name="app-viewport"
    :entities="entities"
    :mini-map-enabled="miniMapEnabled"
    @update:mini-map-enabled="miniMapEnabled = $event"
  />
</template>
```

## 最小 API（`Viewport3D`）

```ts
interface Viewport3DProps {
	entities?: ViewportEntity[];

	miniMapEnabled?: boolean;
	defaultMiniMapEnabled?: boolean;
	miniMapMode?: 'top-down' | 'follow';
	onMiniMapEnabledChange?: (enabled: boolean) => void;

	selectedEntityId?: string | null;
	defaultSelectedEntityId?: string | null;
	onSelectedEntityIdChange?: (id: string | null) => void;

	transformMode?: 'translate' | 'rotate' | 'scale';
	defaultTransformMode?: 'translate' | 'rotate' | 'scale';
	onTransformModeChange?: (mode: 'translate' | 'rotate' | 'scale') => void;

	workMode?: 'runtime' | 'edit';
	defaultWorkMode?: 'runtime' | 'edit';
	onWorkModeChange?: (mode: 'runtime' | 'edit') => void;

	displayMode?: 'wireframe' | 'solid' | 'rendered';
	defaultDisplayMode?: 'wireframe' | 'solid' | 'rendered';
	onDisplayModeChange?: (mode: 'wireframe' | 'solid' | 'rendered') => void;

	unrealRuntimeNavigation?: boolean;
	defaultUnrealRuntimeNavigation?: boolean;
	onUnrealRuntimeNavigationChange?: (enabled: boolean) => void;

	modifierMiddlePresetEnabled?: boolean;
	defaultModifierMiddlePresetEnabled?: boolean;
	onModifierMiddlePresetEnabledChange?: (enabled: boolean) => void;

	entityTransforms?: EntityTransformMap;
	defaultEntityTransforms?: EntityTransformMap;
	onEntityTransformsChange?: (transforms: EntityTransformMap) => void;

	cameraState?: ViewportCameraState;
	defaultCameraState?: ViewportCameraState;
	onCameraStateChange?: (state: ViewportCameraState) => void;

	className?: string;
}
```

## 子入口使用示例

### `vue` 子入口（主路径）

```ts
import { Viewport3D } from 'viewport-3d-kit/vue';
import type { EntityTransformMap, Viewport3DVueProps } from 'viewport-3d-kit/vue';
```

### `react` 子入口

```ts
import { Viewport3D, MiniMap3D } from 'viewport-3d-kit/react';
import type { Viewport3DProps, MiniMapMode } from 'viewport-3d-kit/react';
```

### `core` 子入口

```ts
import {
	createDemoEntities,
	computeSceneBounds,
	resolveCameraStateForBounds,
	serializeViewportCameraState,
	deserializeViewportCameraState,
	zoomViewportCameraState,
	normalizeSelectedEntityId,
	TRANSFORM_MODES,
	} from 'viewport-3d-kit/core';
import type {
	ViewportEntity,
	ViewportEntityKind,
	SelectedEntityId,
	TransformMode,
	ViewportCameraState,
	} from 'viewport-3d-kit/core';
```

### `ui` 子入口

```ts
import { Viewport3DToolbar, Viewport3DContextMenu } from 'viewport-3d-kit/ui';
import type { Viewport3DToolbarProps, Viewport3DContextMenuProps } from 'viewport-3d-kit/ui';
```

## 导出结构

```txt
viewport-3d-kit
viewport-3d-kit/core
viewport-3d-kit/vue
viewport-3d-kit/react
viewport-3d-kit/ui
```

## 说明

- 小地图默认建议关闭，按业务场景按需开启。
- `ui` 子入口是可选层，不影响核心视口能力。
- 运行模式默认开启 Unreal 风格右键观察导航，编辑模式优先 Blender 风格术语和快捷键。

> **monorepo 说明（v0.2 起）**：本包已收编进 main-ui monorepo，包名改为 `@main-ui/viewport-3d-kit`。Vue 层为主线渲染路径；`./react` 导出的 React 层（基于 @react-three/fiber）仅作为**兼容层，非主线**，React 相关依赖均为可选安装。
