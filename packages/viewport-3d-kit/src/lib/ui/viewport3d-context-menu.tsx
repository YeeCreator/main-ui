import * as ContextMenu from '@radix-ui/react-context-menu';
import type { ReactNode } from 'react';
import type { TransformMode } from '../core/gizmo/transform-mode';
import type { ViewportDisplayMode, ViewportWorkMode } from '../core/viewport';

/**
 * 视口右键菜单属性。
 */
export interface Viewport3DContextMenuProps {
  /** 子元素。 */
  children: ReactNode;
  /** 当前工作模式。 */
  workMode: ViewportWorkMode;
  /** 工作模式变化回调。 */
  onWorkModeChange: (mode: ViewportWorkMode) => void;
  /** 当前显示模式。 */
  displayMode: ViewportDisplayMode;
  /** 显示模式变化回调。 */
  onDisplayModeChange: (mode: ViewportDisplayMode) => void;
  /** 是否启用 Unreal 运行导航。 */
  unrealRuntimeNavigation: boolean;
  /** Unreal 运行导航变化回调。 */
  onUnrealRuntimeNavigationChange: (enabled: boolean) => void;
  /** 是否启用 Modifier 中键方案。 */
  modifierMiddlePresetEnabled: boolean;
  /** Modifier 中键方案变化回调。 */
  onModifierMiddlePresetEnabledChange: (enabled: boolean) => void;
  /** 当前变换模式。 */
  transformMode: TransformMode;
  /** 变换模式变化回调。 */
  onTransformModeChange: (mode: TransformMode) => void;
  /** 小地图开关状态。 */
  miniMapEnabled: boolean;
  /** 小地图开关回调。 */
  onMiniMapEnabledChange: (enabled: boolean) => void;
  /** 视角放大命令。 */
  onZoomIn?: () => void;
  /** 视角缩小命令。 */
  onZoomOut?: () => void;
  /** 视角重置命令。 */
  onResetCamera?: () => void;
  /** 聚焦选中对象命令。 */
  onFocusSelection?: () => void;
  /** 是否允许聚焦选中对象。 */
  canFocusSelection?: boolean;
  /** 清空选中回调。 */
  onClearSelection: () => void;
}

/**
 * 视口右键菜单容器。
 *
 * @param props 组件属性。
 * @returns 右键菜单组件。
 */
export function Viewport3DContextMenu(props: Viewport3DContextMenuProps) {
  const {
    children,
    workMode,
    onWorkModeChange,
    displayMode,
    onDisplayModeChange,
    unrealRuntimeNavigation,
    onUnrealRuntimeNavigationChange,
    modifierMiddlePresetEnabled,
    onModifierMiddlePresetEnabledChange,
    transformMode,
    onTransformModeChange,
    miniMapEnabled,
    onMiniMapEnabledChange,
    onZoomIn,
    onZoomOut,
    onResetCamera,
    onFocusSelection,
    canFocusSelection = false,
    onClearSelection,
  } = props;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="vk-context-menu" alignOffset={4}>
          <ContextMenu.Label className="vk-context-menu__label">视口菜单</ContextMenu.Label>
          <ContextMenu.Separator className="vk-context-menu__separator" />

          <ContextMenu.RadioGroup value={workMode} onValueChange={(value) => onWorkModeChange(value as ViewportWorkMode)}>
            <ContextMenu.RadioItem className="vk-context-menu__item" value="runtime">
              运行模式
            </ContextMenu.RadioItem>
            <ContextMenu.RadioItem className="vk-context-menu__item" value="edit">
              编辑模式
            </ContextMenu.RadioItem>
          </ContextMenu.RadioGroup>

          <ContextMenu.Separator className="vk-context-menu__separator" />

          <ContextMenu.RadioGroup value={displayMode} onValueChange={(value) => onDisplayModeChange(value as ViewportDisplayMode)}>
            <ContextMenu.RadioItem className="vk-context-menu__item" value="wireframe">
              Wireframe
            </ContextMenu.RadioItem>
            <ContextMenu.RadioItem className="vk-context-menu__item" value="solid">
              Solid
            </ContextMenu.RadioItem>
            <ContextMenu.RadioItem className="vk-context-menu__item" value="rendered">
              Rendered
            </ContextMenu.RadioItem>
          </ContextMenu.RadioGroup>

          <ContextMenu.Separator className="vk-context-menu__separator" />

          <ContextMenu.CheckboxItem
            className="vk-context-menu__item"
            checked={unrealRuntimeNavigation}
            onCheckedChange={(checked) => onUnrealRuntimeNavigationChange(checked === true)}
          >
            Unreal 运行导航
          </ContextMenu.CheckboxItem>
          <ContextMenu.CheckboxItem
            className="vk-context-menu__item"
            checked={modifierMiddlePresetEnabled}
            onCheckedChange={(checked) => onModifierMiddlePresetEnabledChange(checked === true)}
          >
            中键+修饰键方案
          </ContextMenu.CheckboxItem>

          <ContextMenu.Separator className="vk-context-menu__separator" />

          <ContextMenu.RadioGroup value={transformMode} onValueChange={(value) => onTransformModeChange(value as TransformMode)}>
            <ContextMenu.RadioItem className="vk-context-menu__item" value="translate">
              平移模式
            </ContextMenu.RadioItem>
            <ContextMenu.RadioItem className="vk-context-menu__item" value="rotate">
              旋转模式
            </ContextMenu.RadioItem>
            <ContextMenu.RadioItem className="vk-context-menu__item" value="scale">
              缩放模式
            </ContextMenu.RadioItem>
          </ContextMenu.RadioGroup>

          <ContextMenu.Separator className="vk-context-menu__separator" />

          <ContextMenu.CheckboxItem
            className="vk-context-menu__item"
            checked={miniMapEnabled}
            onCheckedChange={(checked) => onMiniMapEnabledChange(checked === true)}
          >
            显示小地图
          </ContextMenu.CheckboxItem>

          <ContextMenu.Separator className="vk-context-menu__separator" />

          <ContextMenu.Item className="vk-context-menu__item" onSelect={onZoomIn}>
            视角放大
          </ContextMenu.Item>
          <ContextMenu.Item className="vk-context-menu__item" onSelect={onZoomOut}>
            视角缩小
          </ContextMenu.Item>
          <ContextMenu.Item className="vk-context-menu__item" onSelect={onResetCamera}>
            重置视角
          </ContextMenu.Item>
          <ContextMenu.Item
            className="vk-context-menu__item"
            disabled={!canFocusSelection}
            onSelect={onFocusSelection}
          >
            聚焦选中对象
          </ContextMenu.Item>

          <ContextMenu.Item className="vk-context-menu__item" onSelect={onClearSelection}>
            取消选中
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
