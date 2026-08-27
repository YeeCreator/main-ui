import { useMemo, useState } from 'react';
import { Viewport3D } from './lib/react';
import type { EntityTransformMap } from './lib/react';
import { createDemoEntities } from './lib/core/scene/scene-state';
import type { SelectedEntityId } from './lib/core/selection/selection-state';
import type { TransformMode } from './lib/core/gizmo/transform-mode';
import type { ViewportCameraState } from './lib/core/camera';
import type { ViewportDisplayMode, ViewportWorkMode } from './lib/core/viewport';

/**
 * 示例应用根组件。
 *
 * @returns 示例页面。
 */
export function App() {
  const entities = useMemo(() => createDemoEntities(), []);
  const [miniMapEnabled, setMiniMapEnabled] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<SelectedEntityId>(null);
  const [transformMode, setTransformMode] = useState<TransformMode>('translate');
  const [entityTransforms, setEntityTransforms] = useState<EntityTransformMap>({});
  const [cameraState, setCameraState] = useState<ViewportCameraState | null>(null);
  const [workMode, setWorkMode] = useState<ViewportWorkMode>('runtime');
  const [displayMode, setDisplayMode] = useState<ViewportDisplayMode>('rendered');
  const [unrealRuntimeNavigation, setUnrealRuntimeNavigation] = useState(true);
  const [modifierMiddlePresetEnabled, setModifierMiddlePresetEnabled] = useState(false);

  return (
    <main className="app-root">
      <h1 className="app-title">viewport-3d-kit-react</h1>
      <p className="app-description">当前示例展示通用 3D 视口与可选小地图能力。</p>

      <label className="app-checkbox app-row">
        <input
          type="checkbox"
          checked={miniMapEnabled}
          onChange={(event) => setMiniMapEnabled(event.currentTarget.checked)}
        />
        显示小地图
      </label>

      <div className="app-row">
        <span>宿主工具模式：</span>
        <button
          type="button"
          onClick={() => setTransformMode('translate')}
          className={`app-mode-button ${transformMode === 'translate' ? 'is-active' : ''}`}
        >
          平移
        </button>
        <button
          type="button"
          onClick={() => setTransformMode('rotate')}
          className={`app-mode-button ${transformMode === 'rotate' ? 'is-active' : ''}`}
        >
          旋转
        </button>
        <button
          type="button"
          onClick={() => setTransformMode('scale')}
          className={`app-mode-button ${transformMode === 'scale' ? 'is-active' : ''}`}
        >
          缩放
        </button>
        <span>宿主选中对象：{selectedEntityId ?? '无'}</span>
      </div>

      <div className="app-row app-camera-row">
        <span>工作模式：{workMode === 'runtime' ? '运行' : '编辑'}</span>
        <span>显示模式：{displayMode}</span>
      </div>

      <div className="app-row app-camera-row">
        <span>
          当前相机位置：
          {cameraState
            ? `${cameraState.position[0].toFixed(2)}, ${cameraState.position[1].toFixed(2)}, ${cameraState.position[2].toFixed(2)}`
            : '初始化中'}
        </span>
      </div>

      <Viewport3D
        entities={entities}
        miniMapEnabled={miniMapEnabled}
        selectedEntityId={selectedEntityId}
        onSelectedEntityIdChange={setSelectedEntityId}
        transformMode={transformMode}
        onTransformModeChange={setTransformMode}
        entityTransforms={entityTransforms}
        onEntityTransformsChange={setEntityTransforms}
        onCameraStateChange={setCameraState}
        workMode={workMode}
        onWorkModeChange={setWorkMode}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        unrealRuntimeNavigation={unrealRuntimeNavigation}
        onUnrealRuntimeNavigationChange={setUnrealRuntimeNavigation}
        modifierMiddlePresetEnabled={modifierMiddlePresetEnabled}
        onModifierMiddlePresetEnabledChange={setModifierMiddlePresetEnabled}
        miniMapMode="top-down"
        className="app-viewport"
      />
    </main>
  );
}
