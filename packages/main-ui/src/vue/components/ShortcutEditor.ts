/**
 * vue/ShortcutEditor —— 快捷键设置面板。
 *
 * 形态取 VSCode（列表 + 搜索 + 冲突徽标 + 导入导出），
 * 录制手感取 Blender（点进去按什么显示什么，含鼠标与手势）。
 *
 * 三条纪律：
 *
 * 1. **面板打开不注册全局单键绑定** —— 否则「改快捷键时触发快捷键」。
 * 2. **录制态切到 `modal` 作用域** —— 既有绑定完全暂停匹配。
 * 3. **阻断级诊断不允许保存** —— `conflict` 与 `modifier-press` 是「不可判定状态」，
 *    放行只会让用户以后遇到「改了没生效」而查不出原因。
 */
import { computed, defineComponent, h, onBeforeUnmount, ref, watch } from 'vue';
import { useWorkbench } from '../composables/useWorkbench';
import { formatBinding, isModifierCode, keyRefCode } from '@main-ui/core/input';
import type { Binding } from '@main-ui/core/input';

/** 面板内一行。 */
type ShortcutRow = {
  binding: Binding;
  commandTitle: string;
  commandCategory: string;
  display: string;
  conflict: boolean;
};

/** 录制态显示文本。 */
type CaptureView = {
  text: string;
  /** 原始事件调试行（`code` / `key` / 修饰键 / 按钮）。 */
  debug: string;
};

export const ShortcutEditor = defineComponent({
  name: 'ShortcutEditor',
  props: {
    /** 初始搜索词。 */
    search: { type: String, default: '' },
    /** 是否只显示冲突项。 */
    onlyConflicts: { type: Boolean, default: false },
  },
  setup(props) {
    const { runtime } = useWorkbench();

    const query = ref(props.search);
    const category = ref('');
    const onlyConflicts = ref(props.onlyConflicts);
    const recordingId = ref<string | null>(null);
    const captureView = ref<CaptureView | null>(null);
    const notice = ref('');
    let cancelCapture: (() => void) | undefined;

    /** 命令标题映射。 */
    const commandIndex = computed(() => {
      const map = new Map<string, { title: string; category: string; exists: boolean }>();
      for (const command of runtime.core.commands.list()) {
        map.set(command.id, { title: command.title, category: command.category ?? '其他', exists: true });
      }
      return map;
    });

    /** 冲突绑定 id 集合。 */
    const conflictIds = computed(() => {
      const ids = new Set<string>();
      for (const diagnostic of runtime.core.input.diagnose()) {
        if (diagnostic.code !== 'conflict') continue;
        for (const id of diagnostic.bindingIds) ids.add(id);
      }
      return ids;
    });

    /** 诊断消息（按绑定 id 索引）。 */
    const messagesById = computed(() => {
      const map = new Map<string, string[]>();
      for (const diagnostic of runtime.core.input.diagnose()) {
        for (const id of diagnostic.bindingIds) {
          const list = map.get(id) ?? [];
          list.push(diagnostic.message);
          map.set(id, list);
        }
      }
      return map;
    });

    /** 当前所有行。 */
    const rows = computed<ShortcutRow[]>(() => {
      const index = commandIndex.value;
      const list: ShortcutRow[] = [];
      for (const binding of runtime.core.input.list()) {
        const command = index.get(binding.commandId);
        const title = command?.title ?? binding.commandId;
        const commandCategory = binding.category ?? command?.category ?? '其他';
        const display = formatBinding(binding);
        const conflict = conflictIds.value.has(binding.id);
        list.push({ binding, commandTitle: title, commandCategory, display, conflict });
      }
      return list;
    });

    /** 分类列表。 */
    const categories = computed(() => [...new Set(rows.value.map((row) => row.commandCategory))].sort());

    /** 过滤后的行。 */
    const filtered = computed(() => {
      const needle = query.value.trim().toLowerCase();
      return rows.value
        .filter((row) => (category.value ? row.commandCategory === category.value : true))
        .filter((row) => (onlyConflicts.value ? row.conflict : true))
        .filter((row) => {
          if (!needle) return true;
          return (
            row.commandTitle.toLowerCase().includes(needle) ||
            row.binding.commandId.toLowerCase().includes(needle) ||
            row.display.toLowerCase().includes(needle)
          );
        })
        .sort((a, b) => a.commandCategory.localeCompare(b.commandCategory) || a.commandTitle.localeCompare(b.commandTitle));
    });

    /** 冲突总数。 */
    const conflictCount = computed(() => rows.value.filter((row) => row.conflict).length);

    /** 退出录制态。 */
    const stopRecording = () => {
      cancelCapture?.();
      cancelCapture = undefined;
      recordingId.value = null;
      captureView.value = null;
      runtime.core.input.popScope('modal');
    };

    /**
     * 进入录制态。
     *
     * 关键点：先 push `modal` 作用域（既有绑定暂停），再调用 `captureOnce`。
     * 顺序反了会让首个按键既被录制又被分发。
     */
    const startRecording = async (bindingId: string) => {
      if (recordingId.value) stopRecording();
      runtime.core.input.pushScope('modal');
      recordingId.value = bindingId;
      captureView.value = { text: '等待输入…', debug: '' };
      notice.value = '';

      let cancelled = false;
      const promise = runtime.core.input.captureOnce({ timeoutMs: 8000 });
      cancelCapture = () => {
        cancelled = true;
        runtime.core.input.cancelCapture();
      };

      const draft = await promise;
      if (cancelled) return;
      cancelCapture = undefined;
      runtime.core.input.popScope('modal');
      recordingId.value = null;

      if (!draft) {
        captureView.value = null;
        notice.value = '录制超时或已取消，未改动绑定';
        return;
      }

      try {
        runtime.core.input.setUserOverride(bindingId, { binding: formatBinding(draft) });
        captureView.value = null;
        notice.value = `已更新为「${formatBinding(draft)}」`;
      } catch (error) {
        captureView.value = null;
        notice.value = error instanceof Error ? error.message : '保存失败';
      }
    };

    /** 清除（解绑）。 */
    const clearBinding = (bindingId: string) => {
      runtime.core.input.setUserOverride(bindingId, { binding: null });
      notice.value = '已解绑（可随时「恢复默认」）';
    };

    /** 恢复该绑定默认。 */
    const resetBinding = (bindingId: string) => {
      runtime.core.input.resetUserOverride(bindingId);
      notice.value = '已恢复默认绑定';
    };

    /** 全部重置。 */
    const resetAll = () => {
      runtime.core.input.resetAll();
      notice.value = '已清除全部自定义';
    };

    /** 导出。 */
    const exportJson = () => {
      notice.value = runtime.core.input.exportJson();
    };

    /** 导入。 */
    const importJson = (text: string) => {
      const result = runtime.core.input.importJson(text);
      notice.value = `导入完成：应用 ${result.applied} 条，跳过 ${result.skipped} 条`;
    };

    /** 定位冲突对端（滚动并高亮）。 */
    const locateConflict = (bindingId: string) => {
      const diagnostic = runtime.core.input.diagnose().find(
        (item) => item.code === 'conflict' && item.bindingIds.includes(bindingId),
      );
      const other = diagnostic?.bindingIds.find((id) => id !== bindingId);
      if (other) {
        const target = document.querySelector<HTMLElement>(`[data-shortcut-id="${other}"]`);
        target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        target?.classList.add('main-ui-shortcut-row--flash');
        setTimeout(() => target?.classList.remove('main-ui-shortcut-row--flash'), 1200);
      }
      const message = diagnostic?.message ?? '未找到冲突对端';
      notice.value = message;
    };

    /** 录制态实时显示：监听输入会话，把已按住的键转成可读文本。 */
    const syncCaptureView = () => {
      if (!recordingId.value) return;
      const snapshot = runtime.core.input.sessionSnapshot();
      const keys = [...snapshot.pressedKeys].filter((code) => !isModifierCode(code));
      const mods = snapshot.mods;
      const parts: string[] = [];
      if (mods.ctrl) parts.push('⌃');
      if (mods.meta) parts.push('⌘');
      if (mods.alt) parts.push('⌥');
      if (mods.shift) parts.push('⇧');
      if (keys.length > 0) parts.push(keys.map(readableCode).join('+'));
      captureView.value = {
        text: parts.length > 0 ? parts.join('') : '等待输入…',
        debug: `code=${keys.join(',') || '-'} mods=${modifiersDebug(mods)}`,
      };
    };

    /** 键位可读化。 */
    const readableCode = (code: string): string => {
      if (code.startsWith('Key')) return code.slice(3);
      if (code.startsWith('Digit')) return code.slice(5);
      return code;
    };

    /** 修饰键调试串。 */
    const modifiersDebug = (mods: { ctrl: boolean; meta: boolean; alt: boolean; shift: boolean }): string =>
      [mods.ctrl ? 'ctrl' : '', mods.meta ? 'meta' : '', mods.alt ? 'alt' : '', mods.shift ? 'shift' : '']
        .filter(Boolean)
        .join('+') || '-';

    /** 录制期间订阅会话变化（面板每秒轮询一次足够，避免过度重渲染）。 */
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    watch(recordingId, (value) => {
      if (value) {
        pollTimer = setInterval(syncCaptureView, 100);
      } else if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
    });

    onBeforeUnmount(() => {
      if (pollTimer) clearInterval(pollTimer);
      stopRecording();
    });

    return () => {
      const toolbar = h('header', { class: 'main-ui-shortcut-editor__toolbar' }, [
        h('input', {
          class: 'main-ui-shortcut-editor__search',
          value: query.value,
          placeholder: '搜索命令或快捷键',
          'aria-label': '搜索命令或快捷键',
          onInput: (event: Event) => {
            query.value = (event.target as HTMLInputElement).value;
          },
        }),
        h(
          'select',
          {
            value: category.value,
            'aria-label': '按分类筛选',
            onChange: (event: Event) => {
              category.value = (event.target as HTMLSelectElement).value;
            },
          },
          [h('option', { value: '' }, '全部分类'), ...categories.value.map((item) => h('option', { value: item }, item))],
        ),
        h('label', { class: 'main-ui-shortcut-editor__toggle' }, [
          h('input', {
            type: 'checkbox',
            checked: onlyConflicts.value,
            onChange: (event: Event) => {
              onlyConflicts.value = (event.target as HTMLInputElement).checked;
            },
          }),
          h('span', null, '仅看冲突'),
        ]),
      ]);

      const rowsView = filtered.value.map((row) => {
        const recording = recordingId.value === row.binding.id;
        const messages = messagesById.value.get(row.binding.id) ?? [];
        return h(
          'div',
          {
            class: [
              'main-ui-shortcut-row',
              row.conflict ? 'main-ui-shortcut-row--conflict' : null,
              recording ? 'main-ui-shortcut-row--recording' : null,
            ],
            key: row.binding.id,
            'data-shortcut-id': row.binding.id,
          },
          [
            h('div', { class: 'main-ui-shortcut-row__info' }, [
              h('strong', null, row.commandTitle),
              h('small', null, `${row.commandCategory} · ${row.binding.origin}`),
              messages.length > 0 ? h('em', { class: 'main-ui-shortcut-row__warning' }, messages[0]) : null,
            ]),
            h(
              'code',
              { class: 'main-ui-shortcut-row__keys', 'aria-live': 'polite' },
              recording ? captureView.value?.text ?? '等待输入…' : row.display,
            ),
            h('div', { class: 'main-ui-shortcut-row__actions' }, [
              row.conflict
                ? h(
                    'button',
                    { type: 'button', onClick: () => locateConflict(row.binding.id) },
                    '定位冲突',
                  )
                : null,
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => (recording ? stopRecording() : void startRecording(row.binding.id)),
                },
                recording ? '取消' : '录制',
              ),
              h('button', { type: 'button', onClick: () => clearBinding(row.binding.id) }, '清除'),
              h('button', { type: 'button', onClick: () => resetBinding(row.binding.id) }, '恢复'),
            ]),
          ],
        );
      });

      const footer = h('footer', { class: 'main-ui-shortcut-editor__footer' }, [
        h('button', { type: 'button', onClick: resetAll }, '全部重置'),
        h('button', { type: 'button', onClick: exportJson }, '导出 JSON'),
        h('label', { class: 'main-ui-shortcut-editor__import' }, [
          '导入 JSON',
          h('input', {
            type: 'file',
            accept: 'application/json',
            onChange: (event: Event) => {
              const file = (event.target as HTMLInputElement).files?.[0];
              if (!file) return;
              void file.text().then((text) => importJson(text));
            },
          }),
        ]),
        h(
          'span',
          { class: 'main-ui-shortcut-editor__summary' },
          `共 ${rows.value.length} 条 / ${conflictCount.value} 冲突`,
        ),
      ]);

      return h('section', { class: 'main-ui-shortcut-editor' }, [
        toolbar,
        notice.value
          ? h('div', { class: 'main-ui-shortcut-editor__notice', role: 'status' }, notice.value)
          : null,
        h('div', { class: 'main-ui-shortcut-editor__list' }, rowsView),
        footer,
      ]);
    };
  },
});

/** 供测试与外部判断：记录是否为纯修饰键绑定。 */
export function isModifierBinding(binding: Binding): boolean {
  const gesture = binding.gesture;
  if (!('target' in gesture)) return false;
  return isModifierCode(keyRefCode(gesture.target));
}
