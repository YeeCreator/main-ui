import type { EditorInstanceId } from '../types';

/**
 * 视图生命周期契约（v0.2 预埋，模板库与插件可自愿实现）。
 *
 * - 契约为可选实现：未实现的既有 editor 不受影响。
 * - 纯类型 + 轻量收集槽，不依赖任何渲染层。
 * - 完整串联（保存布局时自动收集、恢复时自动回放）随 v0.3 浮动窗口一起落地。
 */
export interface MainUiViewLifecycle {
  /** 视图唯一类型标识，用于快照持久化与注册查找，对齐 rendererKey */
  readonly viewType: string;
  /** 收集视图内部状态（相机、展开节点、滚动、筛选等），布局保存时调用 */
  getViewState(): Record<string, unknown>;
  /** 从快照恢复视图内部状态 */
  restoreViewState(state: Record<string, unknown>): void;
  /** 关闭/迁移/销毁时释放资源，必须幂等 */
  onDestroy(): void;
}

/**
 * 视图状态收集槽：挂载面（EditorSurfaceHost / 未来浮动窗口表面）在挂载时
 * 以编辑实例为键登记生命周期句柄，持久化保存布局时可经 runtime 统一收集。
 */
export class ViewLifecycleRegistry {
  private readonly handles = new Map<EditorInstanceId, MainUiViewLifecycle>();

  /** 登记某编辑实例表面的生命周期句柄；重复登记时先销毁旧句柄，避免资源泄漏。 */
  attach(editorInstanceId: EditorInstanceId, lifecycle: MainUiViewLifecycle): void {
    const existing = this.handles.get(editorInstanceId);
    if (existing && existing !== lifecycle) {
      existing.onDestroy();
    }
    this.handles.set(editorInstanceId, lifecycle);
  }

  /** 注销并销毁句柄；幂等。 */
  detach(editorInstanceId: EditorInstanceId): void {
    const lifecycle = this.handles.get(editorInstanceId);
    if (!lifecycle) return;
    this.handles.delete(editorInstanceId);
    lifecycle.onDestroy();
  }

  get(editorInstanceId: EditorInstanceId): MainUiViewLifecycle | undefined {
    return this.handles.get(editorInstanceId);
  }

  /** 收集指定实例（默认全部已登记实例）的视图内部状态，供持久化消费。 */
  collect(editorInstanceIds?: EditorInstanceId[]): Record<EditorInstanceId, Record<string, unknown>> {
    const collected: Record<EditorInstanceId, Record<string, unknown>> = {};
    const targets = editorInstanceIds ?? [...this.handles.keys()];
    for (const id of targets) {
      const lifecycle = this.handles.get(id);
      if (lifecycle) {
        collected[id] = lifecycle.getViewState();
      }
    }
    return collected;
  }

  /** 向指定实例回放快照状态；未登记的实例静默跳过（视图未挂载时由宿主自行缓存）。 */
  restore(editorInstanceId: EditorInstanceId, state: Record<string, unknown>): void {
    this.handles.get(editorInstanceId)?.restoreViewState(state);
  }

  /** 销毁全部句柄（运行时重置场景）；幂等。 */
  clear(): void {
    for (const lifecycle of this.handles.values()) {
      lifecycle.onDestroy();
    }
    this.handles.clear();
  }
}
