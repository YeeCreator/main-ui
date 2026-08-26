import { defineComponent, h, type PropType } from 'vue';
import type { GroupId, TabId } from '../../core';
import { useWorkbench } from '../composables/useWorkbench';
import { renderIconToken } from './IconToken';

/**
 * 快照降级占位表面（missing-view）。
 *
 * 布局恢复时若引用的视图类型（editorKind / rendererKey）未注册，
 * 渲染本占位而不丢弃节点：保留原标题、提示「视图不可用（类型缺失）」、
 * 提供关闭命令。原 `EditorInstance` 的 payload 与 restoreKey 仍保留在
 * 工作区状态中，类型重新注册后节点可恢复打开。该机制同样服务插件卸载场景。
 */
export const MissingViewSurface = defineComponent({
  name: 'MissingViewSurface',
  props: {
    groupId: {
      type: String as PropType<GroupId>,
      required: true,
    },
    tabId: {
      type: String as PropType<TabId>,
      required: true,
    },
    /** 缺失的视图类型标识，用于提示与排查 */
    viewType: {
      type: String,
      required: true,
    },
    /** 占位原因的简短说明 */
    reason: {
      type: String as PropType<'unregistered-view' | 'missing-renderer'>,
      default: 'unregistered-view',
    },
  },
  setup(props) {
    const { document, dispatch } = useWorkbench();

    return () => {
      const workspace = document.value.workspaceStates[document.value.activeWorkspaceId];
      const tab = workspace?.tabs[props.tabId];
      const title = tab?.title ?? props.viewType;

      return h('div', {
        class: 'main-ui-editor-surface main-ui-missing-view',
        role: 'region',
        'aria-label': `Missing view: ${title}`,
        'data-view-type': props.viewType,
      }, [
        h('div', { class: 'main-ui-missing-view__card' }, [
          h('div', { class: 'main-ui-missing-view__icon' }, [renderIconToken('warning')]),
          h('h3', { class: 'main-ui-missing-view__title' }, title),
          h('p', { class: 'main-ui-missing-view__hint' }, [
            '视图不可用（类型缺失）',
            h('br'),
            h('code', { class: 'main-ui-missing-view__type' }, props.viewType),
          ]),
          h('p', { class: 'main-ui-missing-view__note' }, props.reason === 'missing-renderer'
            ? '视图类型已注册但渲染器未挂载；恢复渲染器后刷新即可显示。'
            : '布局已保留该节点与其状态，类型重新注册后可恢复打开。'),
          h('button', {
            class: 'main-ui-button',
            type: 'button',
            onClick: () => void dispatch({ type: 'editor/closeTab', groupId: props.groupId, tabId: props.tabId }),
          }, '关闭该页签'),
        ]),
      ]);
    };
  },
});
