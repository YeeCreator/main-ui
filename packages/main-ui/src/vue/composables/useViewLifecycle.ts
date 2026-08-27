import { onBeforeUnmount, onMounted, toValue, type MaybeRefOrGetter } from 'vue';
import type { EditorInstanceId, MainUiViewLifecycle } from '../../core';
import { useWorkbench } from './useWorkbench';

/**
 * 视图生命周期契约挂载助手（模板库与宿主视图消费）：
 * 组件挂载时以编辑实例为键登记句柄（快照中若带待回放视图状态会立即回放），
 * 卸载时注销并销毁句柄（onDestroy 幂等）。
 *
 * 用法：在视图组件 `setup` 中调用
 * `useViewLifecycle(() => context.editor.id, () => myLifecycle)`。
 */
export const useViewLifecycle = (
  editorInstanceId: MaybeRefOrGetter<EditorInstanceId>,
  factory: () => MainUiViewLifecycle,
): void => {
  const { runtime } = useWorkbench();
  onMounted(() => runtime.core.attachViewLifecycle(toValue(editorInstanceId), factory()));
  onBeforeUnmount(() => runtime.core.viewLifecycles.detach(toValue(editorInstanceId)));
};
