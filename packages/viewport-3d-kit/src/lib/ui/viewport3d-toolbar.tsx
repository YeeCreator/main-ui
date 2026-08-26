import * as Toolbar from '@radix-ui/react-toolbar';
import type { SelectedEntityId } from '../core/selection/selection-state';
import type { TransformMode } from '../core/gizmo/transform-mode';
import type { ViewportDisplayMode, ViewportWorkMode } from '../core/viewport';

/**
 * 视口工具栏属性。
 */
export interface Viewport3DToolbarProps {
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
  /** Unreal 运行导航开关回调。 */
  onUnrealRuntimeNavigationChange: (enabled: boolean) => void;
  /** 是否启用 Modifier 中键方案。 */
  modifierMiddlePresetEnabled: boolean;
  /** Modifier 中键方案开关回调。 */
  onModifierMiddlePresetEnabledChange: (enabled: boolean) => void;
  /** 当前变换模式。 */
  transformMode: TransformMode;
  /** 变换模式变化回调。 */
  onTransformModeChange: (mode: TransformMode) => void;
  /** 小地图开关状态。 */
  miniMapEnabled: boolean;
  /** 小地图开关回调。 */
  onMiniMapEnabledChange: (enabled: boolean) => void;
  /** 当前选中对象标识。 */
  selectedEntityId: SelectedEntityId;
  /** 视角放大命令。 */
  onZoomIn?: () => void;
  /** 视角缩小命令。 */
  onZoomOut?: () => void;
  /** 视角重置命令。 */
  onResetCamera?: () => void;
  /** 聚焦选中对象命令。 */
  onFocusSelection?: () => void;
}

/**
 * 视口工具栏。
 *
 * @param props 组件属性。
 * @returns 工具栏组件。
 */
export function Viewport3DToolbar(props: Viewport3DToolbarProps) {
  const {
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
    selectedEntityId,
    onZoomIn,
    onZoomOut,
    onResetCamera,
    onFocusSelection,
  } = props;

  return (
    <Toolbar.Root className="vk-toolbar" aria-label="Viewport 工具栏">
      <span className="vk-toolbar__label">工具</span>

      <Toolbar.Button
        type="button"
        className={`vk-toolbar__button ${workMode === 'runtime' ? 'is-active' : ''}`}
        onClick={() => onWorkModeChange('runtime')}
      >
        运行模式
      </Toolbar.Button>
      <Toolbar.Button
        type="button"
        className={`vk-toolbar__button ${workMode === 'edit' ? 'is-active' : ''}`}
        onClick={() => onWorkModeChange('edit')}
      >
        编辑模式
      </Toolbar.Button>

      <Toolbar.Separator className="vk-toolbar__separator" />

      <label className="vk-toolbar__checkbox">
        显示
        <select
          className="vk-toolbar__select"
          value={displayMode}
          onChange={(event) => onDisplayModeChange(event.currentTarget.value as ViewportDisplayMode)}
        >
          <option value="wireframe">Wireframe</option>
          <option value="solid">Solid</option>
          <option value="rendered">Rendered</option>
        </select>
      </label>

      <label className="vk-toolbar__checkbox">
        <input
          type="checkbox"
          checked={modifierMiddlePresetEnabled}
          onChange={(event) => onModifierMiddlePresetEnabledChange(event.currentTarget.checked)}
        />
        中键+修饰键方案
      </label>

      <label className="vk-toolbar__checkbox">
        <input
          type="checkbox"
          checked={unrealRuntimeNavigation}
          onChange={(event) => onUnrealRuntimeNavigationChange(event.currentTarget.checked)}
        />
        Unreal 运行导航
      </label>

      <Toolbar.Button
        type="button"
        className={`vk-toolbar__button ${transformMode === 'translate' ? 'is-active' : ''}`}
        onClick={() => onTransformModeChange('translate')}
        disabled={workMode !== 'edit'}
      >
        平移
      </Toolbar.Button>
      <Toolbar.Button
        type="button"
        className={`vk-toolbar__button ${transformMode === 'rotate' ? 'is-active' : ''}`}
        onClick={() => onTransformModeChange('rotate')}
        disabled={workMode !== 'edit'}
      >
        旋转
      </Toolbar.Button>
      <Toolbar.Button
        type="button"
        className={`vk-toolbar__button ${transformMode === 'scale' ? 'is-active' : ''}`}
        onClick={() => onTransformModeChange('scale')}
        disabled={workMode !== 'edit'}
      >
        缩放
      </Toolbar.Button>

      <Toolbar.Separator className="vk-toolbar__separator" />

      <Toolbar.Button type="button" className="vk-toolbar__button" onClick={onZoomOut}>
        视角-
      </Toolbar.Button>
      <Toolbar.Button type="button" className="vk-toolbar__button" onClick={onZoomIn}>
        视角+
      </Toolbar.Button>
      <Toolbar.Button type="button" className="vk-toolbar__button" onClick={onResetCamera}>
        重置视角
      </Toolbar.Button>
      <Toolbar.Button
        type="button"
        className="vk-toolbar__button"
        onClick={onFocusSelection}
        disabled={!selectedEntityId}
      >
        聚焦选中
      </Toolbar.Button>

      <Toolbar.Separator className="vk-toolbar__separator" />

      <label className="vk-toolbar__checkbox">
        <input
          type="checkbox"
          checked={miniMapEnabled}
          onChange={(event) => onMiniMapEnabledChange(event.currentTarget.checked)}
        />
        小地图
      </label>

      <span className="vk-toolbar__selected">选中：{selectedEntityId ?? '无'}</span>
    </Toolbar.Root>
  );
}
