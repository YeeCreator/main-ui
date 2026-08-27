import { defineComponent, h, onErrorCaptured, ref, type PropType, type VNode } from 'vue';

export const EditorErrorBoundary = defineComponent({
  name: 'EditorErrorBoundary',
  props: { content: { type: Function as PropType<() => VNode>, required: true } },
  setup(props) {
    const error = ref<string | null>(null); const key = ref(0);
    onErrorCaptured((caught) => { error.value = caught instanceof Error ? caught.message : String(caught); return false; });
    return () => error.value ? h('div', { class: 'main-ui-editor-error', role: 'alert' }, [h('strong', 'Editor failed to render'), h('p', error.value), h('button', { type: 'button', onClick: () => { error.value = null; key.value += 1; } }, 'Retry')]) : h('div', { key: key.value, class: 'main-ui-editor-boundary' }, [props.content()]);
  },
});
